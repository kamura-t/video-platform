import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR', 'VIEWER']);
    if (authResult.error) {
      return authResult.error;
    }
    const currentUser = authResult.user!;

    // URLパラメータを取得
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const sortBy = searchParams.get('sortBy') || 'lastWatchedAt'; // lastWatchedAt, completionRate, watchDuration
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc
    const minCompletionRate = searchParams.get('minCompletionRate') 
      ? parseFloat(searchParams.get('minCompletionRate')!) 
      : undefined;

    // ソート条件の検証
    const validSortFields = ['lastWatchedAt', 'completionRate', 'watchDuration'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'lastWatchedAt';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    // フィルタ条件
    const whereConditions: any = {
      userId: parseInt(currentUser.userId)
    };

    if (minCompletionRate !== undefined) {
      whereConditions.completionRate = {
        gte: minCompletionRate
      };
    }

    // 視聴履歴を取得
    const [viewHistory, totalCount] = await Promise.all([
      prisma.viewHistory.findMany({
        where: whereConditions,
        include: {
          video: {
            include: {
              uploader: {
                select: {
                  id: true,
                  displayName: true,
                  username: true
                }
              },
              categories: {
                include: {
                  category: {
                    select: {
                      id: true,
                      name: true,
                      slug: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          [sortField]: sortDirection
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.viewHistory.count({
        where: whereConditions
      })
    ]);

    // レスポンスデータの整形
    const formattedHistory = viewHistory.map(item => ({
      id: item.id,
      watchDuration: item.watchDuration,
      completionRate: item.completionRate ? parseFloat(item.completionRate.toString()) : 0,
      lastWatchedAt: item.lastWatchedAt,
      video: {
        id: item.video.id,
        videoId: item.video.videoId,
        title: item.video.title,
        description: item.video.description,
        duration: item.video.duration,
        thumbnailUrl: item.video.thumbnailUrl,
        createdAt: item.video.createdAt,
        uploadType: item.video.uploadType,
        youtubeUrl: item.video.youtubeUrl,
        creator: item.video.uploader,
        categories: item.video.categories.map((cat: any) => cat.category)
      }
    }));

    // ページネーション情報
    const totalPages = Math.ceil(totalCount / limit);

    return createSuccessResponse({
      viewHistory: formattedHistory,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      filters: {
        sortBy: sortField,
        sortOrder: sortDirection,
        minCompletionRate
      }
    });

  } catch (error) {
    console.error('視聴履歴取得エラー:', error);
    return createErrorResponse('視聴履歴の取得に失敗しました', 500);
  }
}