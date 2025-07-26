import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkInternalVideoAccess } from '@/lib/auth-access-control'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)

    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: '無効なユーザーIDです' },
        { status: 400 }
      )
    }

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        createdAt: true,
        isActive: true
      }
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'ユーザーが見つかりません' },
        { status: 404 }
      )
    }

    // クエリパラメータの取得
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'latest'

    const skip = (page - 1) * limit

    // 学内限定動画へのアクセス権限をチェック
    const hasInternalAccess = await checkInternalVideoAccess(request)

    // 基本的な検索条件
    const baseWhere: any = {
      creatorId: userId,
      // 公開されているプレイリストのみ表示
      posts: {
        some: hasInternalAccess ? {
          visibility: {
            in: ['PUBLIC', 'PRIVATE']
          }
        } : {
          visibility: 'PUBLIC'
        }
      }
    }

    // 検索条件を追加
    if (search) {
      baseWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // ソート条件
    let orderBy: any = {}
    switch (sortBy) {
      case 'title':
        orderBy = { title: 'asc' }
        break
      case 'videos':
        orderBy = { videoCount: 'desc' }
        break
      case 'duration':
        orderBy = { totalDuration: 'desc' }
        break
      case 'latest':
      default:
        orderBy = { createdAt: 'desc' }
        break
    }

    // 総件数を取得
    const totalCount = await prisma.playlist.count({
      where: baseWhere
    })

    // ページネーション付きでプレイリストを取得
    const playlists = await prisma.playlist.findMany({
      where: baseWhere,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            department: true
          }
        },
        videos: {
          include: {
            video: {
              select: {
                videoId: true,
                title: true,
                thumbnailUrl: true,
                duration: true
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          },
          take: 3 // プレビュー用に最初の3つの動画のみ
        },
        posts: {
          select: {
            postId: true,
            visibility: true,
            publishedAt: true
          }
        },
        _count: {
          select: {
            videos: true
          }
        }
      },
      orderBy,
      skip,
      take: limit,
    })

    // レスポンス用にデータを変換
    const transformedPlaylists = playlists.map(playlist => ({
      id: playlist.playlistId,
      title: playlist.title,
      description: playlist.description,
      thumbnail: playlist.thumbnailUrl || playlist.videos[0]?.video.thumbnailUrl || '/images/default-thumbnail.jpg',
      videoCount: playlist.videoCount,
      totalDuration: playlist.totalDuration,
      creator: {
        id: playlist.creator.id.toString(),
        name: playlist.creator.displayName,
        username: playlist.creator.username,
        avatar: playlist.creator.profileImageUrl,
        department: playlist.creator.department
      },
      previewVideos: playlist.videos.slice(0, 3).map(pv => ({
        id: pv.video.videoId,
        title: pv.video.title,
        thumbnail: pv.video.thumbnailUrl,
        duration: pv.video.duration
      })),
      posts: playlist.posts.map(post => ({
        postId: post.postId,
        visibility: post.visibility,
        publishedAt: post.publishedAt
      })),
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt
    }))

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        memberSince: user.createdAt,
        totalPlaylists: totalCount
      },
      playlists: transformedPlaylists,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('User Playlists API Error:', error)
    return NextResponse.json(
      { success: false, error: 'プレイリストの取得に失敗しました' },
      { status: 500 }
    )
  }
} 