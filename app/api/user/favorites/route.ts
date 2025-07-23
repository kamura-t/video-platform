import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR', 'VIEWER']);
    if (authResult.error) {
      return authResult.error;
    }
    const currentUser = authResult.user!;
    const userId = parseInt(currentUser.userId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50);
    const offset = (page - 1) * limit;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const minDuration = searchParams.get('minDuration');
    const maxDuration = searchParams.get('maxDuration');

    // 並び替えオプションを設定
    let orderBy: any = {};
    switch (sortBy) {
      case 'title':
        orderBy = { video: { title: sortOrder } };
        break;
      case 'videoCreatedAt':
        orderBy = { video: { createdAt: sortOrder } };
        break;
      case 'duration':
        orderBy = { video: { duration: sortOrder } };
        break;
      case 'viewCount':
        orderBy = { video: { viewCount: sortOrder } };
        break;
      case 'createdAt':
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    // フィルタ条件を構築
    const whereCondition: any = { userId };
    const videoFilters: any = {};

    if (categoryId) {
      videoFilters.categories = {
        some: {
          categoryId: parseInt(categoryId)
        }
      };
    }

    if (search) {
      videoFilters.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (dateFrom || dateTo) {
      const dateFilter: any = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      whereCondition.createdAt = dateFilter;
    }

    if (minDuration || maxDuration) {
      const durationFilter: any = {};
      if (minDuration) durationFilter.gte = parseInt(minDuration);
      if (maxDuration) durationFilter.lte = parseInt(maxDuration);
      videoFilters.duration = durationFilter;
    }

    if (Object.keys(videoFilters).length > 0) {
      whereCondition.video = videoFilters;
    }

    const [favorites, totalCount] = await Promise.all([
      prisma.favorite.findMany({
        where: whereCondition,
        include: {
          video: {
            include: {
              uploader: {
                select: {
                  displayName: true
                }
              },
              categories: {
                include: {
                  category: true
                }
              }
            }
          }
        },
        orderBy,
        skip: offset,
        take: limit
      }),
      prisma.favorite.count({
        where: whereCondition
      })
    ]);

    const formattedFavorites = favorites.map(favorite => ({
      id: favorite.id,
      createdAt: favorite.createdAt,
      video: {
        id: favorite.video.id,
        videoId: favorite.video.videoId,
        title: favorite.video.title,
        description: favorite.video.description,
        thumbnailUrl: favorite.video.thumbnailUrl,
        duration: favorite.video.duration,
        viewCount: favorite.video.viewCount,
        createdAt: favorite.video.createdAt,
        uploader: {
          displayName: favorite.video.uploader.displayName
        },
        categories: favorite.video.categories.map(vc => ({
          id: vc.category.id,
          name: vc.category.name,
          slug: vc.category.slug,
          color: vc.category.color
        }))
      }
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return createSuccessResponse({
      favorites: formattedFavorites,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('お気に入り一覧取得エラー:', error);
    return createErrorResponse('お気に入り一覧の取得に失敗しました', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR', 'VIEWER']);
    if (authResult.error) {
      return authResult.error;
    }
    const currentUser = authResult.user!;
    const userId = parseInt(currentUser.userId);

    const body = await request.json();
    const { videoId } = body;

    console.log('Favorites add request body:', body);
    console.log('videoId:', videoId, 'type:', typeof videoId);

    if (!videoId && videoId !== 0) {
      return createErrorResponse('動画IDが必要です', 400);
    }

    const parsedVideoId = parseInt(videoId);
    if (isNaN(parsedVideoId)) {
      return createErrorResponse('無効な動画IDです', 400);
    }

    // 動画の存在確認
    const video = await prisma.video.findUnique({
      where: { id: parsedVideoId }
    });

    if (!video) {
      return createErrorResponse('指定された動画が見つかりません', 404);
    }

    // 既にお気に入りに追加されているかチェック
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId: parsedVideoId
        }
      }
    });

    if (existingFavorite) {
      return createErrorResponse('既にお気に入りに追加されています', 409);
    }

    // お気に入りに追加
    const favorite = await prisma.favorite.create({
      data: {
        userId,
        videoId: parsedVideoId
      },
      include: {
        video: {
          select: {
            videoId: true,
            title: true
          }
        }
      }
    });

    return createSuccessResponse({
      id: favorite.id,
      videoId: favorite.videoId,
      createdAt: favorite.createdAt,
      message: `「${favorite.video.title}」をお気に入りに追加しました`
    }, 201);

  } catch (error) {
    console.error('お気に入り追加エラー:', error);
    return createErrorResponse('お気に入りの追加に失敗しました', 500);
  }
}