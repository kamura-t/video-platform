import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const sort = searchParams.get('sort') || 'popular';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 検索条件を構築
    const where: any = {
      // 動画を投稿しているユーザーのみ
      videos: {
        some: {}
      }
    };

    if (query) {
      where.OR = [
        { username: { contains: query, mode: 'insensitive' } },
        { displayName: { contains: query, mode: 'insensitive' } },
        { bio: { contains: query, mode: 'insensitive' } }
      ];
    }

    // ソート条件を構築
    let orderBy: any = {};
    switch (sort) {
      case 'latest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'name':
        orderBy = { displayName: 'asc' };
        break;
      case 'videos':
        // 動画数でのソートは後でJavaScriptで処理
        orderBy = { createdAt: 'desc' };
        break;
      case 'popular':
      default:
        // 人気順（動画数でソート）
        orderBy = { createdAt: 'desc' };
        break;
    }

    // ユーザーを取得（動画数と総視聴回数も含める）
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        profileImageUrl: true,
        bio: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            videos: true
          }
        },
        videos: {
          select: {
            viewCount: true
          }
        }
      },
      orderBy,
      skip: offset,
      take: limit
    });

    // レスポンス用のデータを整形
    let formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.profileImageUrl,
      bio: user.bio,
      videoCount: user._count.videos,
      totalViews: user.videos.reduce((sum: number, video: any) => sum + (video.viewCount || 0), 0),
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastLoginAt?.toISOString()
    }));

    // JavaScriptでソート処理
    if (sort === 'videos') {
      formattedUsers.sort((a, b) => b.videoCount - a.videoCount);
    } else if (sort === 'popular') {
      formattedUsers.sort((a, b) => b.totalViews - a.totalViews);
    }

    // 総件数も取得
    const totalCount = await prisma.user.count({
      where
    });

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 