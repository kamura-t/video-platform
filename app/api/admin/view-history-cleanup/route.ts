import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    // 管理者権限チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN']);
    if (authResult.error) {
      return authResult.error;
    }

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
      return createErrorResponse('視聴履歴の自動クリーンアップが無効化されています', 400);
    }

    // 削除対象の期限日を計算
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    console.log(`視聴履歴クリーンアップ開始: ${cutoffDate.toISOString()} より古い履歴を削除`);

    // 削除対象の件数を確認
    const totalCount = await prisma.viewHistory.count({
      where: {
        lastWatchedAt: {
          lt: cutoffDate
        }
      }
    });

    if (totalCount === 0) {
      return createSuccessResponse({
        message: '削除対象の視聴履歴はありません',
        deletedCount: 0,
        totalBatches: 0,
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      });
    }

    let deletedCount = 0;
    let batchCount = 0;
    const maxBatches = Math.ceil(totalCount / batchSize);

    // バッチ処理で削除実行
    while (deletedCount < totalCount) {
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
      
      console.log(`バッチ ${batchCount}/${maxBatches}: ${result.count}件削除 (累計: ${deletedCount}/${totalCount})`);

      // パフォーマンス配慮のため少し待機
      if (batchCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`視聴履歴クリーンアップ完了: 合計 ${deletedCount} 件削除`);

    return createSuccessResponse({
      message: `視聴履歴のクリーンアップが完了しました`,
      deletedCount,
      totalBatches: batchCount,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      batchSize
    });

  } catch (error) {
    console.error('視聴履歴クリーンアップエラー:', error);
    return createErrorResponse('視聴履歴のクリーンアップに失敗しました', 500);
  }
}

// 削除対象の履歴を取得する（実行前の確認用）
export async function GET(request: NextRequest) {
  try {
    // 管理者権限チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN']);
    if (authResult.error) {
      return authResult.error;
    }

    // システム設定を取得
    const retentionSetting = await prisma.systemSetting.findUnique({
      where: { settingKey: 'view_history_retention_days' }
    });

    const retentionDays = retentionSetting?.settingValue ? parseInt(retentionSetting.settingValue) : 1825;
    const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

    // 削除対象の統計情報を取得
    const [totalCount, oldestRecord, newestInRange] = await Promise.all([
      prisma.viewHistory.count({
        where: {
          lastWatchedAt: {
            lt: cutoffDate
          }
        }
      }),
      prisma.viewHistory.findFirst({
        where: {
          lastWatchedAt: {
            lt: cutoffDate
          }
        },
        orderBy: { lastWatchedAt: 'asc' },
        select: { lastWatchedAt: true }
      }),
      prisma.viewHistory.findFirst({
        where: {
          lastWatchedAt: {
            lt: cutoffDate
          }
        },
        orderBy: { lastWatchedAt: 'desc' },
        select: { lastWatchedAt: true }
      })
    ]);

    // ユーザー別の削除対象件数
    const userStats = await prisma.$queryRaw`
      SELECT 
        u.username,
        u.display_name,
        COUNT(vh.id) as delete_count
      FROM view_history vh
      JOIN users u ON vh.user_id = u.id
      WHERE vh.last_watched_at < ${cutoffDate}
      GROUP BY u.id, u.username, u.display_name
      ORDER BY delete_count DESC
      LIMIT 20
    `;

    return createSuccessResponse({
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      targetCount: totalCount,
      oldestRecordDate: oldestRecord?.lastWatchedAt?.toISOString() || null,
      newestTargetDate: newestInRange?.lastWatchedAt?.toISOString() || null,
      userStats: Array.isArray(userStats) ? userStats.map((stat: any) => ({
        username: stat.username,
        displayName: stat.display_name,
        deleteCount: parseInt(stat.delete_count)
      })) : []
    });

  } catch (error) {
    console.error('視聴履歴クリーンアップ情報取得エラー:', error);
    return createErrorResponse('視聴履歴クリーンアップ情報の取得に失敗しました', 500);
  }
}