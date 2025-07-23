import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';

/**
 * 予約投稿一覧取得API
 * GET /api/admin/scheduled-videos
 */
export async function GET(request: NextRequest) {
  try {
    // 管理者認証チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR']);
    if (authResult.error) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || 'all'; // 'publish', 'unpublish', 'all'
    const status = searchParams.get('status') || 'all'; // 'pending', 'completed', 'all'
    
    const offset = (page - 1) * limit;

    // 予約投稿動画の取得
    const scheduledVideosWhere: any = {};
    
    if (type === 'publish') {
      scheduledVideosWhere.isScheduled = true;
      scheduledVideosWhere.scheduledPublishAt = { not: null };
    } else if (type === 'unpublish') {
      scheduledVideosWhere.scheduledUnpublishAt = { not: null };
    } else {
      scheduledVideosWhere.OR = [
        { isScheduled: true, scheduledPublishAt: { not: null } },
        { scheduledUnpublishAt: { not: null } }
      ];
    }

    if (status === 'pending') {
      const now = new Date();
      scheduledVideosWhere.OR = scheduledVideosWhere.OR ? [
        ...scheduledVideosWhere.OR.map((condition: any) => ({
          ...condition,
          OR: [
            { scheduledPublishAt: { gt: now } },
            { scheduledUnpublishAt: { gt: now } }
          ]
        }))
      ] : [
        { scheduledPublishAt: { gt: now } },
        { scheduledUnpublishAt: { gt: now } }
      ];
    }

    const [scheduledVideos, totalVideos] = await Promise.all([
      prisma.video.findMany({
        where: scheduledVideosWhere,
        select: {
          id: true,
          videoId: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          duration: true,
          visibility: true,
          isScheduled: true,
          scheduledPublishAt: true,
          scheduledUnpublishAt: true,
          createdAt: true,
          uploader: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
            },
          },
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: [
          { scheduledPublishAt: 'asc' },
          { scheduledUnpublishAt: 'asc' },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.video.count({ where: scheduledVideosWhere }),
    ]);

    // 予約投稿の投稿も取得
    const scheduledPostsWhere: any = {};
    
    if (type === 'publish') {
      scheduledPostsWhere.isScheduled = true;
      scheduledPostsWhere.scheduledPublishAt = { not: null };
    } else if (type === 'unpublish') {
      scheduledPostsWhere.scheduledUnpublishAt = { not: null };
    } else {
      scheduledPostsWhere.OR = [
        { isScheduled: true, scheduledPublishAt: { not: null } },
        { scheduledUnpublishAt: { not: null } }
      ];
    }

    const [scheduledPosts, totalPosts] = await Promise.all([
      prisma.post.findMany({
        where: scheduledPostsWhere,
        select: {
          id: true,
          postId: true,
          title: true,
          description: true,
          postType: true,
          visibility: true,
          isScheduled: true,
          scheduledPublishAt: true,
          scheduledUnpublishAt: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
            },
          },
          video: {
            select: {
              id: true,
              videoId: true,
              title: true,
              thumbnailUrl: true,
            },
          },
        },
        orderBy: [
          { scheduledPublishAt: 'asc' },
          { scheduledUnpublishAt: 'asc' },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.post.count({ where: scheduledPostsWhere }),
    ]);

    // データを統合してフォーマット
    const formattedVideos = scheduledVideos.map((video) => ({
      id: video.id,
      type: 'video' as const,
      itemId: video.videoId,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      visibility: video.visibility,
      isScheduled: video.isScheduled,
      scheduledPublishAt: video.scheduledPublishAt?.toISOString(),
      scheduledUnpublishAt: video.scheduledUnpublishAt?.toISOString(),
      createdAt: video.createdAt.toISOString(),
      user: video.uploader,
      categories: video.categories.map(vc => vc.category),
    }));

    const formattedPosts = scheduledPosts.map((post) => ({
      id: post.id,
      type: 'post' as const,
      itemId: post.postId,
      title: post.title,
      description: post.description,
      thumbnailUrl: post.video?.thumbnailUrl,
      duration: null,
      visibility: post.visibility,
      isScheduled: post.isScheduled,
      scheduledPublishAt: post.scheduledPublishAt?.toISOString(),
      scheduledUnpublishAt: post.scheduledUnpublishAt?.toISOString(),
      createdAt: post.createdAt.toISOString(),
      user: post.creator,
      categories: [],
      video: post.video,
    }));

    // 時刻順でソート
    const allItems = [...formattedVideos, ...formattedPosts].sort((a, b) => {
      const aTime = a.scheduledPublishAt || a.scheduledUnpublishAt || a.createdAt;
      const bTime = b.scheduledPublishAt || b.scheduledUnpublishAt || b.createdAt;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });

    return NextResponse.json({
      success: true,
      data: {
        items: allItems.slice(0, limit),
        pagination: {
          page,
          limit,
          total: totalVideos + totalPosts,
          totalPages: Math.ceil((totalVideos + totalPosts) / limit),
        },
        stats: {
          totalVideos,
          totalPosts,
          totalItems: totalVideos + totalPosts,
        },
      },
    });

  } catch (error) {
    console.error('Scheduled videos fetch error:', error);
    return NextResponse.json(
      { success: false, error: '予約投稿の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 予約投稿の一括操作API
 * POST /api/admin/scheduled-videos
 */
export async function POST(request: NextRequest) {
  try {
    // 管理者認証チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN']);
    if (authResult.error) {
      return authResult.error;
    }

    const body = await request.json();
    const { action, items } = body;

    if (!action || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: '不正なリクエストです' },
        { status: 400 }
      );
    }

    let results: any[] = [];

    switch (action) {
      case 'cancel_scheduled':
        // 予約投稿をキャンセル
        for (const item of items) {
          try {
            if (item.type === 'video') {
              await prisma.video.update({
                where: { id: item.id },
                data: {
                  isScheduled: false,
                  scheduledPublishAt: null,
                },
              });
            } else if (item.type === 'post') {
              await prisma.post.update({
                where: { id: item.id },
                data: {
                  isScheduled: false,
                  scheduledPublishAt: null,
                },
              });
            }
            results.push({ id: item.id, success: true });
          } catch (error) {
            results.push({ id: item.id, success: false, error: String(error) });
          }
        }
        break;

      case 'cancel_unpublish':
        // 予約非公開をキャンセル
        for (const item of items) {
          try {
            if (item.type === 'video') {
              await prisma.video.update({
                where: { id: item.id },
                data: {
                  scheduledUnpublishAt: null,
                },
              });
            } else if (item.type === 'post') {
              await prisma.post.update({
                where: { id: item.id },
                data: {
                  scheduledUnpublishAt: null,
                },
              });
            }
            results.push({ id: item.id, success: true });
          } catch (error) {
            results.push({ id: item.id, success: false, error: String(error) });
          }
        }
        break;

      case 'execute_now':
        // 予約投稿を即座に実行
        for (const item of items) {
          try {
            if (item.type === 'video') {
              await prisma.video.update({
                where: { id: item.id },
                data: {
                  visibility: 'PUBLIC',
                  isScheduled: false,
                  scheduledPublishAt: null,
                  publishedAt: new Date(),
                },
              });
            } else if (item.type === 'post') {
              await prisma.post.update({
                where: { id: item.id },
                data: {
                  visibility: 'PUBLIC',
                  isScheduled: false,
                  scheduledPublishAt: null,
                  publishedAt: new Date(),
                },
              });
            }
            results.push({ id: item.id, success: true });
          } catch (error) {
            results.push({ id: item.id, success: false, error: String(error) });
          }
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: '不正なアクションです' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        results,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length,
      },
    });

  } catch (error) {
    console.error('Scheduled videos batch operation error:', error);
    return NextResponse.json(
      { success: false, error: 'バッチ操作に失敗しました' },
      { status: 500 }
    );
  }
}