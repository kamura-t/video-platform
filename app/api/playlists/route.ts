import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// プレイリスト一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const creatorId = searchParams.get('creatorId')
    const visibility = searchParams.get('visibility')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    // 検索条件を構築
    const where: any = {}

    // 作成者フィルター
    if (creatorId) {
      where.creatorId = parseInt(creatorId)
    }

    // 検索フィルター
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    // 公開設定フィルター（投稿テーブルと結合）
    if (visibility) {
      where.posts = {
        some: {
          visibility: visibility.toUpperCase()
        }
      }
    } else {
      // デフォルトでは公開されているプレイリストのみ
      where.posts = {
        some: {
          visibility: {
            in: ['PUBLIC', 'PRIVATE']
          }
        }
      }
    }

    const [playlists, totalCount] = await Promise.all([
      prisma.playlist.findMany({
        where,
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
            take: 3 // 最初の3つの動画のみ（プレビュー用）
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
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.playlist.count({ where })
    ])

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
      data: {
        playlists: transformedPlaylists,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    })

  } catch (error) {
    console.error('Playlists API Error:', error)
    return NextResponse.json(
      { success: false, error: 'プレイリストの取得に失敗しました' },
      { status: 500 }
    )
  }
}

// プレイリスト作成
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const currentUser = verifyToken(token)
    if (!currentUser || !['ADMIN', 'CURATOR'].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: '管理者またはキュレーター権限が必要です' },
        { status: 403 }
      )
    }

    const { title, description, videoIds, visibility = 'PUBLIC' } = await request.json()

    // 入力検証
    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'タイトルは必須です' },
        { status: 400 }
      )
    }

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '少なくとも1つの動画を選択してください' },
        { status: 400 }
      )
    }

    // プレイリストIDを生成（11文字のYouTube形式）
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    const playlistId = Array.from({length: 11}, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')

    // 投稿IDも生成
    const postId = Array.from({length: 11}, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')

    // 選択された動画の存在確認と権限チェック
    const videos = await prisma.video.findMany({
      where: {
        videoId: {
          in: videoIds
        },
        // 公開済みの動画のみ選択可能
        posts: {
          some: {
            visibility: {
              in: ['PUBLIC', 'PRIVATE']
            }
          }
        }
      },
      include: {
        uploader: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    })

    if (videos.length !== videoIds.length) {
      return NextResponse.json(
        { success: false, error: '選択された動画の一部が見つからないか、非公開です' },
        { status: 400 }
      )
    }

    // 合計再生時間を計算
    const totalDuration = videos.reduce((sum, video) => sum + (video.duration || 0), 0)

    // 代表サムネイルを設定（最初の動画のサムネイル）
    const thumbnailUrl = videos[0]?.thumbnailUrl

    // トランザクションでプレイリストと投稿を作成
    const result = await prisma.$transaction(async (tx) => {
      // プレイリスト作成
      const playlist = await tx.playlist.create({
        data: {
          playlistId,
          title: title.trim(),
          description: description?.trim() || null,
          thumbnailUrl,
          videoCount: videos.length,
          totalDuration,
          creatorId: parseInt(currentUser.userId)
        }
      })

      // プレイリスト動画関連を作成
      for (let i = 0; i < videos.length; i++) {
        await tx.playlistVideo.create({
          data: {
            playlistId: playlist.id,
            videoId: videos[i].id,
            sortOrder: i + 1
          }
        })
      }

      // 投稿を作成
      const post = await tx.post.create({
        data: {
          postId,
          title: title.trim(),
          description: description?.trim() || null,
          postType: 'PLAYLIST',
          playlistId: playlist.id,
          visibility: visibility.toUpperCase() as any,
          creatorId: parseInt(currentUser.userId),
          publishedAt: visibility.toUpperCase() !== 'DRAFT' ? new Date() : null
        }
      })

      return { playlist, post }
    })

    return NextResponse.json({
      success: true,
      data: {
        playlist: {
          id: result.playlist.playlistId,
          title: result.playlist.title,
          description: result.playlist.description,
          videoCount: result.playlist.videoCount,
          totalDuration: result.playlist.totalDuration
        },
        post: {
          id: result.post.postId,
          visibility: result.post.visibility
        }
      },
      message: 'プレイリストを作成しました'
    })

  } catch (error) {
    console.error('Playlist Creation Error:', error)
    return NextResponse.json(
      { success: false, error: 'プレイリストの作成に失敗しました' },
      { status: 500 }
    )
  }
} 