import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 個別予約投稿取得API
 * GET /api/admin/scheduled-videos/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 管理者認証チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR']);
    if (authResult.error) {
      return authResult.error;
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'video'; // 'video' or 'post'

    let item;

    if (type === 'video') {
      item = await prisma.video.findUnique({
        where: { id: parseInt(id) },
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
          updatedAt: true,
          publishedAt: true,
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
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    } else {
      item = await prisma.post.findUnique({
        where: { id: parseInt(id) },
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
          updatedAt: true,
          publishedAt: true,
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
              duration: true,
            },
          },
        },
      });
    }

    if (!item) {
      return NextResponse.json(
        { success: false, error: '予約投稿が見つかりません' },
        { status: 404 }
      );
    }

    // データをフォーマット
    const formattedItem = {
      id: item.id,
      type,
      itemId: type === 'video' ? (item as any).videoId : (item as any).postId,
      title: item.title,
      description: item.description,
      thumbnailUrl: type === 'video' ? (item as any).thumbnailUrl : (item as any).video?.thumbnailUrl,
      duration: type === 'video' ? (item as any).duration : (item as any).video?.duration,
      visibility: item.visibility,
      isScheduled: item.isScheduled,
      scheduledPublishAt: item.scheduledPublishAt?.toISOString(),
      scheduledUnpublishAt: item.scheduledUnpublishAt?.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      publishedAt: item.publishedAt?.toISOString(),
      user: type === 'video' ? (item as any).uploader : (item as any).creator,
      categories: type === 'video' ? (item as any).categories.map((vc: any) => vc.category) : [],
      tags: type === 'video' ? (item as any).tags.map((vt: any) => vt.tag) : [],
      video: type === 'post' ? (item as any).video : undefined,
    };

    return NextResponse.json({
      success: true,
      data: formattedItem,
    });

  } catch (error) {
    console.error('Scheduled video fetch error:', error);
    return NextResponse.json(
      { success: false, error: '予約投稿の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 個別予約投稿更新API
 * PUT /api/admin/scheduled-videos/[id]
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // 管理者認証チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR']);
    if (authResult.error) {
      return authResult.error;
    }

    const { id } = await params;
    const body = await request.json();
    const { type, scheduledPublishAt, scheduledUnpublishAt, visibility } = body;

    // バリデーション
    if (scheduledPublishAt) {
      const publishTime = new Date(scheduledPublishAt);
      const now = new Date();
      
      if (publishTime <= now) {
        return NextResponse.json(
          { success: false, error: '予約投稿時刻は現在時刻より後である必要があります' },
          { status: 400 }
        );
      }
    }

    if (scheduledUnpublishAt) {
      const unpublishTime = new Date(scheduledUnpublishAt);
      const now = new Date();
      
      if (unpublishTime <= now) {
        return NextResponse.json(
          { success: false, error: '予約非公開時刻は現在時刻より後である必要があります' },
          { status: 400 }
        );
      }

      if (scheduledPublishAt) {
        const publishTime = new Date(scheduledPublishAt);
        if (unpublishTime <= publishTime) {
          return NextResponse.json(
            { success: false, error: '予約非公開時刻は予約投稿時刻より後である必要があります' },
            { status: 400 }
          );
        }
      }
    }

    const updateData: any = {};
    
    if (scheduledPublishAt !== undefined) {
      updateData.scheduledPublishAt = scheduledPublishAt ? new Date(scheduledPublishAt) : null;
      updateData.isScheduled = !!scheduledPublishAt;
    }
    
    if (scheduledUnpublishAt !== undefined) {
      updateData.scheduledUnpublishAt = scheduledUnpublishAt ? new Date(scheduledUnpublishAt) : null;
    }
    
    if (visibility !== undefined) {
      updateData.visibility = visibility;
    }

    let updatedItem;

    if (type === 'video') {
      updatedItem = await prisma.video.update({
        where: { id: parseInt(id) },
        data: updateData,
        select: {
          id: true,
          videoId: true,
          title: true,
          visibility: true,
          isScheduled: true,
          scheduledPublishAt: true,
          scheduledUnpublishAt: true,
          updatedAt: true,
        },
      });
    } else {
      updatedItem = await prisma.post.update({
        where: { id: parseInt(id) },
        data: updateData,
        select: {
          id: true,
          postId: true,
          title: true,
          visibility: true,
          isScheduled: true,
          scheduledPublishAt: true,
          scheduledUnpublishAt: true,
          updatedAt: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedItem.id,
        type,
        itemId: type === 'video' ? (updatedItem as any).videoId : (updatedItem as any).postId,
        title: updatedItem.title,
        visibility: updatedItem.visibility,
        isScheduled: updatedItem.isScheduled,
        scheduledPublishAt: updatedItem.scheduledPublishAt?.toISOString(),
        scheduledUnpublishAt: updatedItem.scheduledUnpublishAt?.toISOString(),
        updatedAt: updatedItem.updatedAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('Scheduled video update error:', error);
    return NextResponse.json(
      { success: false, error: '予約投稿の更新に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 個別予約投稿削除（キャンセル）API
 * DELETE /api/admin/scheduled-videos/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // 管理者認証チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN']);
    if (authResult.error) {
      return authResult.error;
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'video';
    const action = searchParams.get('action') || 'cancel_scheduled'; // 'cancel_scheduled', 'cancel_unpublish'

    const updateData: any = {};

    if (action === 'cancel_scheduled') {
      updateData.isScheduled = false;
      updateData.scheduledPublishAt = null;
    } else if (action === 'cancel_unpublish') {
      updateData.scheduledUnpublishAt = null;
    }

    let updatedItem;

    if (type === 'video') {
      updatedItem = await prisma.video.update({
        where: { id: parseInt(id) },
        data: updateData,
        select: {
          id: true,
          videoId: true,
          title: true,
          isScheduled: true,
          scheduledPublishAt: true,
          scheduledUnpublishAt: true,
        },
      });
    } else {
      updatedItem = await prisma.post.update({
        where: { id: parseInt(id) },
        data: updateData,
        select: {
          id: true,
          postId: true,
          title: true,
          isScheduled: true,
          scheduledPublishAt: true,
          scheduledUnpublishAt: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedItem.id,
        type,
        action,
        title: updatedItem.title,
        isScheduled: updatedItem.isScheduled,
        scheduledPublishAt: updatedItem.scheduledPublishAt?.toISOString(),
        scheduledUnpublishAt: updatedItem.scheduledUnpublishAt?.toISOString(),
      },
    });

  } catch (error) {
    console.error('Scheduled video cancel error:', error);
    return NextResponse.json(
      { success: false, error: '予約投稿のキャンセルに失敗しました' },
      { status: 500 }
    );
  }
}