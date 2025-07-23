import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPrivateVideoAccess } from '@/lib/ip-access-control';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const idOrUsername = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const sortBy = searchParams.get('sortBy') || 'latest';
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const userId = parseInt(idOrUsername);
    let user;

    // IDが数値の場合はIDで検索、そうでなければusernameで検索
    if (!isNaN(userId)) {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          profileImageUrl: true,
          createdAt: true,
        }
      });
    } else {
      user = await prisma.user.findUnique({
        where: { username: idOrUsername },
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          profileImageUrl: true,
          createdAt: true,
        }
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // プライベート動画のアクセス権限をチェック
    const hasPrivateAccess = await checkPrivateVideoAccess(request);

    // 基本クエリ条件
    const baseWhere: any = {
      uploaderId: user.id,
      status: 'COMPLETED',
    };

    // プライベート動画のアクセス制御
    if (!hasPrivateAccess) {
      baseWhere.visibility = 'PUBLIC';
    }

    // 検索条件を追加
    if (search) {
      baseWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // カテゴリフィルター
    if (category && category !== 'all') {
      baseWhere.categories = {
        some: {
          category: {
            slug: category
          }
        }
      };
    }

    // ソート条件
    let orderBy: any = {};
    switch (sortBy) {
      case 'popular':
        orderBy = { viewCount: 'desc' };
        break;
      case 'title':
        orderBy = { title: 'asc' };
        break;
      case 'duration':
        orderBy = { duration: 'desc' };
        break;
      case 'latest':
      default:
        orderBy = { publishedAt: 'desc' };
        break;
    }

    // 総件数を取得
    const totalCount = await prisma.video.count({
      where: baseWhere
    });

    // ページネーション付きで動画を取得
    const videos = await prisma.video.findMany({
      where: baseWhere,
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
          }
        },
        categories: {
          include: {
            category: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        posts: {
          select: {
            postId: true
          }
        },
        _count: {
          select: {
            viewLogs: true
          }
        }
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    // レスポンス用にデータを変換
    const transformedVideos = videos.map(video => ({
      videoId: video.videoId,
      id: video.videoId,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      thumbnail: video.thumbnailUrl,
      duration: video.duration,
      viewCount: video.viewCount,
      uploadedAt: video.createdAt,
      publishedAt: video.publishedAt,
      youtubeUrl: video.youtubeUrl,
      author: {
        id: video.uploader.id,
        name: video.uploader.displayName || video.uploader.username,
        avatar: video.uploader.profileImageUrl,
        profileImageUrl: video.uploader.profileImageUrl,
      },
      uploader: {
        id: video.uploader.id.toString(),
        username: video.uploader.username,
        displayName: video.uploader.displayName,
        profileImageUrl: video.uploader.profileImageUrl,
      },
      categories: video.categories.map(vc => ({
        id: vc.category.id.toString(),
        name: vc.category.name,
        slug: vc.category.slug,
        color: vc.category.color
      })),
      tags: video.tags.map(vt => ({
        id: vt.tag.id.toString(),
        name: vt.tag.name
      })),
      posts: video.posts.map(post => ({
        postId: post.postId
      }))
    }));

    // プレイリスト数を公開設定別に取得（Postテーブル経由）
    const publicPlaylists = await prisma.playlist.count({
      where: { 
        creatorId: user.id,
        posts: {
          some: {
            visibility: 'PUBLIC'
          }
        }
      }
    });

    const internalPlaylists = await prisma.playlist.count({
      where: { 
        creatorId: user.id,
        posts: {
          some: {
            visibility: 'PRIVATE'
          }
        }
      }
    });

    const totalPlaylists = publicPlaylists + internalPlaylists;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        memberSince: user.createdAt,
        totalVideos: totalCount,
        totalPlaylists,
        publicPlaylists,
        internalPlaylists
      },
      videos: transformedVideos,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching user videos:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 