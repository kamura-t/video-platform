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
    const sortBy = searchParams.get('sortBy') || 'viewTime'; // viewTime, viewDate, watchDuration, completionRate
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc
    const fromDate = searchParams.get('fromDate'); // YYYY-MM-DD
    const toDate = searchParams.get('toDate'); // YYYY-MM-DD
    const minCompletionRate = searchParams.get('minCompletionRate') 
      ? parseFloat(searchParams.get('minCompletionRate')!) 
      : undefined;
    const groupByDate = searchParams.get('groupByDate') === 'true'; // 日付でグループ化

    // ソート条件の検証
    const validSortFields = ['viewTime', 'viewDate', 'watchDuration', 'completionRate', 'sessionCount'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'viewTime';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    // フィルタ条件
    const whereConditions: any = {
      userId: parseInt(currentUser.userId)
    };

    // 日付範囲フィルタ
    if (fromDate || toDate) {
      whereConditions.viewDate = {};
      if (fromDate) {
        whereConditions.viewDate.gte = new Date(fromDate);
      }
      if (toDate) {
        whereConditions.viewDate.lte = new Date(toDate);
      }
    }

    // 完了率フィルタ
    if (minCompletionRate !== undefined) {
      whereConditions.completionRate = {
        gte: minCompletionRate
      };
    }

    if (groupByDate) {
      // 日付でグループ化した履歴を取得
      const groupedHistory = await prisma.dailyViewHistory.groupBy({
        by: ['viewDate'],
        where: whereConditions,
        _count: {
          id: true
        },
        _sum: {
          watchDuration: true,
          sessionCount: true
        },
        _avg: {
          completionRate: true
        },
        orderBy: {
          viewDate: sortDirection
        },
        skip: (page - 1) * limit,
        take: limit
      });

      // 各日付の詳細な視聴履歴を取得
      const detailedHistory = await Promise.all(
        groupedHistory.map(async (group) => {
          const dailyVideos = await prisma.dailyViewHistory.findMany({
            where: {
              ...whereConditions,
              viewDate: group.viewDate
            },
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
              viewTime: 'desc'
            }
          });

          return {
            date: group.viewDate,
            totalVideos: group._count.id,
            totalWatchTime: group._sum.watchDuration || 0,
            totalSessions: group._sum.sessionCount || 0,
            avgCompletionRate: group._avg.completionRate ? parseFloat(group._avg.completionRate.toString()) : 0,
            videos: dailyVideos.map(item => ({
              id: item.id,
              viewTime: item.viewTime,
              watchDuration: item.watchDuration,
              completionRate: item.completionRate ? parseFloat(item.completionRate.toString()) : 0,
              sessionCount: item.sessionCount,
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
            }))
          };
        })
      );

      const totalCount = await prisma.dailyViewHistory.groupBy({
        by: ['viewDate'],
        where: whereConditions,
        _count: {
          id: true
        }
      });

      const totalPages = Math.ceil(totalCount.length / limit);

      return createSuccessResponse({
        dailyHistory: detailedHistory,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount: totalCount.length,
          limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        },
        filters: {
          sortBy: sortField,
          sortOrder: sortDirection,
          fromDate,
          toDate,
          minCompletionRate,
          groupByDate: true
        }
      });

    } else {
      // 通常の視聴履歴を取得（日付グループ化なし）
      const [dailyHistory, totalCount] = await Promise.all([
        prisma.dailyViewHistory.findMany({
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
        prisma.dailyViewHistory.count({
          where: whereConditions
        })
      ]);

      // レスポンスデータの整形
      const formattedHistory = dailyHistory.map(item => ({
        id: item.id,
        viewDate: item.viewDate,
        viewTime: item.viewTime,
        watchDuration: item.watchDuration,
        completionRate: item.completionRate ? parseFloat(item.completionRate.toString()) : 0,
        sessionCount: item.sessionCount,
        deviceType: item.deviceType,
        referrer: item.referrer,
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

      const totalPages = Math.ceil(totalCount / limit);

      return createSuccessResponse({
        dailyHistory: formattedHistory,
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
          fromDate,
          toDate,
          minCompletionRate,
          groupByDate: false
        }
      });
    }

  } catch (error) {
    console.error('日付単位視聴履歴取得エラー:', error);
    return createErrorResponse('日付単位視聴履歴の取得に失敗しました', 500);
  }
}