import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 });
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // 管理者権限チェック
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD形式
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // ログディレクトリ
    const logDir = path.join(process.cwd(), 'storage', 'logs');

    let allLogs: any[] = [];

    if (date) {
      // 特定の日付のログを取得
      const logFilePath = path.join(logDir, `deleted_videos_${date}.json`);
      try {
        const logContent = await fs.readFile(logFilePath, 'utf-8');
        allLogs = JSON.parse(logContent);
      } catch {
        // ファイルが存在しない場合は空配列
      }
    } else {
      // 全ての削除ログを取得（最新30日分）
      try {
        const files = await fs.readdir(logDir);
        const logFiles = files
          .filter(file => file.startsWith('deleted_videos_') && file.endsWith('.json'))
          .sort()
          .reverse()
          .slice(0, 30); // 最新30日分

        for (const file of logFiles) {
          try {
            const logContent = await fs.readFile(path.join(logDir, file), 'utf-8');
            const logs = JSON.parse(logContent);
            allLogs.push(...logs);
          } catch (error) {
            console.error(`ログファイル読み込みエラー: ${file}`, error);
          }
        }
      } catch (error) {
        console.error('ログディレクトリ読み込みエラー:', error);
      }
    }

    // 削除日時でソート（新しい順）
    allLogs.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    // ページネーション
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = allLogs.slice(startIndex, endIndex);

    // 削除者情報を取得
    const deletedByIds = Array.from(new Set(paginatedLogs.map((log: any) => log.deletedBy)));
    const deleters = await prisma.user.findMany({
      where: { id: { in: deletedByIds } },
      select: { id: true, username: true, displayName: true }
    });

    const deletersMap = deleters.reduce((acc: any, user: any) => {
      acc[user.id] = user;
      return acc;
    }, {} as any);

    // アップロード者情報を取得
    const uploaderIds = Array.from(new Set(paginatedLogs.map((log: any) => log.uploaderId)));
    const uploaders = await prisma.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, username: true, displayName: true }
    });

    const uploadersMap = uploaders.reduce((acc: any, user: any) => {
      acc[user.id] = user;
      return acc;
    }, {} as any);

    // ログにユーザー情報を追加
    const enrichedLogs = paginatedLogs.map(log => ({
      ...log,
      deleter: deletersMap[log.deletedBy] || null,
      uploader: uploadersMap[log.uploaderId] || null
    }));

    const totalPages = Math.ceil(allLogs.length / limit);

    return NextResponse.json({
      success: true,
      data: {
        logs: enrichedLogs,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount: allLogs.length,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        }
      }
    });

  } catch (error) {
    console.error('削除ログ取得エラー:', error);
    return NextResponse.json(
      { error: '削除ログの取得に失敗しました' },
      { status: 500 }
    );
  }
} 