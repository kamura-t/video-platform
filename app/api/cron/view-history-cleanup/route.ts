import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 自動実行用のクリーンアップエンドポイント
// cron jobまたは外部スケジューラーから呼び出される
export async function POST(request: NextRequest) {
  try {
    // セキュリティ: 内部からの呼び出しのみ許可
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('自動視聴履歴クリーンアップ開始:', new Date().toISOString());

    // システム設定を取得
    const [retentionSetting, enabledSetting, batchSizeSetting] = await Promise.all([
      prisma.systemSetting.findUnique({
        where: { settingKey: 'view_history_retention_days' }
      }),
      prisma.systemSetting.findUnique({
        where: { settingKey: 'view_history_cleanup_enabled' }
      }),
      prisma.systemSetting.findUnique({
        where: { settingKey: 'view_history_cleanup_batch_size' }
      })
    ]);

    // デフォルト値の設定
    const retentionDays = retentionSetting?.settingValue ? parseInt(retentionSetting.settingValue) : 1825; // 5年
    const cleanupEnabled = enabledSetting?.settingValue !== 'false';
    const batchSize = batchSizeSetting?.settingValue ? parseInt(batchSizeSetting.settingValue) : 1000;

    if (!cleanupEnabled) {
      console.log('視聴履歴自動クリーンアップは無効化されています');
      return NextResponse.json({
        success: true,
        message: '視聴履歴自動クリーンアップは無効化されています',
        deletedCount: 0
      });
    }

    // 削除対象の期限日を計算
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    // 削除対象の件数を確認
    const totalCount = await prisma.viewHistory.count({
      where: {
        lastWatchedAt: {
          lt: cutoffDate
        }
      }
    });

    if (totalCount === 0) {
      console.log('削除対象の視聴履歴はありません');
      return NextResponse.json({
        success: true,
        message: '削除対象の視聴履歴はありません',
        deletedCount: 0,
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      });
    }

    let deletedCount = 0;
    let batchCount = 0;
    const maxBatches = Math.ceil(totalCount / batchSize);
    
    // 大量削除の場合は制限を設ける（パフォーマンス保護）
    const maxDeletePerExecution = 10000;
    const actualTarget = Math.min(totalCount, maxDeletePerExecution);

    // バッチ処理で削除実行
    while (deletedCount < actualTarget) {
      batchCount++;
      
      // 削除対象のIDを取得
      const targetRecords = await prisma.viewHistory.findMany({
        where: {
          lastWatchedAt: {
            lt: cutoffDate
          }
        },
        select: { id: true },
        take: batchSize,
        orderBy: { lastWatchedAt: 'asc' }
      });

      if (targetRecords.length === 0) {
        break;
      }

      // バッチ削除実行
      const result = await prisma.viewHistory.deleteMany({
        where: {
          id: {
            in: targetRecords.map(record => record.id)
          }
        }
      });

      deletedCount += result.count;
      
      console.log(`自動クリーンアップ バッチ ${batchCount}: ${result.count}件削除 (累計: ${deletedCount})`);

      // パフォーマンス配慮のため待機
      if (batchCount % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // 実行時間制限（5分以内）
      if (batchCount > 100) {
        console.log('実行時間制限により中断します');
        break;
      }
    }

    const remainingCount = totalCount - deletedCount;
    
    console.log(`自動視聴履歴クリーンアップ完了: ${deletedCount}件削除, 残り${remainingCount}件`);

    return NextResponse.json({
      success: true,
      message: `視聴履歴の自動クリーンアップが完了しました`,
      deletedCount,
      remainingCount,
      totalBatches: batchCount,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      executionTime: new Date().toISOString()
    });

  } catch (error) {
    console.error('自動視聴履歴クリーンアップエラー:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '自動視聴履歴クリーンアップに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ヘルスチェック用
export async function GET() {
  try {
    const retentionSetting = await prisma.systemSetting.findUnique({
      where: { settingKey: 'view_history_retention_days' }
    });

    const enabledSetting = await prisma.systemSetting.findUnique({
      where: { settingKey: 'view_history_cleanup_enabled' }
    });

    const retentionDays = retentionSetting?.settingValue ? parseInt(retentionSetting.settingValue) : 1825;
    const cleanupEnabled = enabledSetting?.settingValue !== 'false';
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    const targetCount = await prisma.viewHistory.count({
      where: {
        lastWatchedAt: {
          lt: cutoffDate
        }
      }
    });

    return NextResponse.json({
      success: true,
      cleanupEnabled,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      pendingCleanupCount: targetCount,
      lastCheck: new Date().toISOString()
    });

  } catch (error) {
    console.error('自動クリーンアップ状態確認エラー:', error);
    return NextResponse.json(
      { success: false, error: 'Status check failed' },
      { status: 500 }
    );
  }
}