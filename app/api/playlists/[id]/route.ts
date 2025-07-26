import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// プレイリスト詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const playlistId = resolvedParams.id

    const playlist = await prisma.playlist.findUnique({
      where: { playlistId },
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
              include: {
                uploader: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    profileImageUrl: true
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
                    postId: true,
                    visibility: true
                  }
                }
              }
            }
          },
          orderBy: {
            sortOrder: 'asc'
          }
        },
        posts: {
          select: {
            postId: true,
            visibility: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    })

    if (!playlist) {
      return NextResponse.json(
        { success: false, error: 'プレイリストが見つかりません' },
        { status: 404 }
      )
    }

    // レスポンス用にデータを変換
    const transformedPlaylist = {
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
      videos: playlist.videos.map(pv => ({
        video: {
          id: pv.video.videoId,
          title: pv.video.title,
          description: pv.video.description,
          thumbnail: pv.video.thumbnailUrl || '/images/default-thumbnail.jpg',
          duration: pv.video.duration,
          viewCount: pv.video.viewCount,
          uploadType: pv.video.uploadType,
          youtubeUrl: pv.video.youtubeUrl,
          author: {
            id: pv.video.uploader.id.toString(),
            name: pv.video.uploader.displayName,
            username: pv.video.uploader.username,
            avatar: pv.video.uploader.profileImageUrl
          },
          categories: pv.video.categories.map(vc => ({
            id: vc.category.id.toString(),
            name: vc.category.name,
            slug: vc.category.slug,
            color: vc.category.color
          })),
          tags: pv.video.tags.map(vt => ({
            id: vt.tag.id.toString(),
            name: vt.tag.name
          })),
          posts: pv.video.posts.map(post => ({
            postId: post.postId,
            visibility: post.visibility
          })),
          uploadedAt: pv.video.createdAt
        },
        sortOrder: pv.sortOrder,
        addedAt: pv.addedAt
      })),
      posts: playlist.posts.map(post => ({
        postId: post.postId,
        visibility: post.visibility,
        publishedAt: post.publishedAt
      })),
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt
    }

    return NextResponse.json({
      success: true,
      data: transformedPlaylist
    })

  } catch (error) {
    console.error('Playlist Detail API Error:', error)
    return NextResponse.json(
      { success: false, error: 'プレイリストの取得に失敗しました' },
      { status: 500 }
    )
  }
}

// プレイリスト更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    const playlistId = resolvedParams.id

    const { title, description, videoIds, visibility } = await request.json()

    // プレイリストの存在確認と権限チェック
    const playlist = await prisma.playlist.findUnique({
      where: { playlistId },
      include: {
        posts: true
      }
    })

    if (!playlist) {
      return NextResponse.json(
        { success: false, error: 'プレイリストが見つかりません' },
        { status: 404 }
      )
    }

    // 権限チェック：CURATORは自分のプレイリストのみ編集可能
    if (currentUser.role === 'CURATOR' && playlist.creatorId !== parseInt(currentUser.userId)) {
      return NextResponse.json(
        { success: false, error: '自分が作成したプレイリストのみ編集できます' },
        { status: 403 }
      )
    }

    // 入力検証
    if (title && !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'タイトルは必須です' },
        { status: 400 }
      )
    }

    // 動画IDsが提供された場合、選択された動画の存在確認
    let videos = null
    let totalDuration = playlist.totalDuration
    let thumbnailUrl = playlist.thumbnailUrl

    if (videoIds && Array.isArray(videoIds)) {
      if (videoIds.length === 0) {
        return NextResponse.json(
          { success: false, error: '少なくとも1つの動画を選択してください' },
          { status: 400 }
        )
      }

      // Separate numeric IDs and string videoIds
      const numericIds: number[] = []
      const stringVideoIds: string[] = []
      
      videoIds.forEach(id => {
        if (typeof id === 'number') {
          numericIds.push(id)
        } else if (typeof id === 'string') {
          const parsed = parseInt(id, 10)
          if (!isNaN(parsed)) {
            numericIds.push(parsed)
          } else {
            stringVideoIds.push(id)
          }
        }
      })

      videos = await prisma.video.findMany({
        where: {
          OR: [
            ...(numericIds.length > 0 ? [{
              id: {
                in: numericIds
              }
            }] : []),
            ...(stringVideoIds.length > 0 ? [{
              videoId: {
                in: stringVideoIds
              }
            }] : [])
          ],
          posts: {
            some: {
              visibility: {
                in: ['PUBLIC', 'PRIVATE', 'DRAFT']
              }
            }
          }
        }
      })

      // 合計再生時間を再計算
      totalDuration = videos.reduce((sum, video) => sum + (video.duration || 0), 0)
      
      // 代表サムネイルを更新
      thumbnailUrl = videos[0]?.thumbnailUrl || playlist.thumbnailUrl
    }

    // トランザクションで更新
    const result = await prisma.$transaction(async (tx) => {
      // プレイリスト更新
      const updatedPlaylist = await tx.playlist.update({
        where: { playlistId },
        data: {
          ...(title && { title: title.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(videos && { 
            videoCount: videos.length,
            totalDuration,
            thumbnailUrl
          })
        }
      })

      // 動画リストが更新された場合
      if (videos) {
        // 既存の動画関連を削除
        await tx.playlistVideo.deleteMany({
          where: { playlistId: playlist.id }
        })

        // 新しい動画関連を作成（元の順序を保持）
        for (let i = 0; i < videoIds.length; i++) {
          const videoId = videoIds[i]
          let video
          
          if (typeof videoId === 'number') {
            video = videos.find(v => v.id === videoId)
          } else if (typeof videoId === 'string') {
            const parsed = parseInt(videoId, 10)
            if (!isNaN(parsed)) {
              video = videos.find(v => v.id === parsed)
            } else {
              video = videos.find(v => v.videoId === videoId)
            }
          }
          
          if (video) {
            await tx.playlistVideo.create({
              data: {
                playlistId: playlist.id,
                videoId: video.id,
                sortOrder: i + 1
              }
            })
          }
        }
      }

      // 投稿も更新
      if (playlist.posts.length > 0) {
        await tx.post.updateMany({
          where: { playlistId: playlist.id },
          data: {
            ...(title && { title: title.trim() }),
            ...(description !== undefined && { description: description?.trim() || null }),
            ...(visibility && { 
              visibility: visibility.toUpperCase() as any,
              ...(visibility.toUpperCase() !== 'DRAFT' && !playlist.posts[0].publishedAt && { publishedAt: new Date() })
            })
          }
        })
      }

      return updatedPlaylist
    })

    return NextResponse.json({
      success: true,
      data: {
        id: result.playlistId,
        title: result.title,
        description: result.description,
        videoCount: result.videoCount,
        totalDuration: result.totalDuration
      },
      message: 'プレイリストを更新しました'
    })

  } catch (error) {
    console.error('Playlist Update Error:', error)
    return NextResponse.json(
      { success: false, error: 'プレイリストの更新に失敗しました' },
      { status: 500 }
    )
  }
}

// プレイリスト削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    const playlistId = resolvedParams.id

    // プレイリストの存在確認と権限チェック
    const playlist = await prisma.playlist.findUnique({
      where: { playlistId },
      include: {
        posts: true
      }
    })

    if (!playlist) {
      return NextResponse.json(
        { success: false, error: 'プレイリストが見つかりません' },
        { status: 404 }
      )
    }

    // 権限チェック：CURATORは自分のプレイリストのみ削除可能
    if (currentUser.role === 'CURATOR' && playlist.creatorId !== parseInt(currentUser.userId)) {
      return NextResponse.json(
        { success: false, error: '自分が作成したプレイリストのみ削除できます' },
        { status: 403 }
      )
    }

    // トランザクションで削除
    await prisma.$transaction(async (tx) => {
      // 投稿を削除
      await tx.post.deleteMany({
        where: { playlistId: playlist.id }
      })

      // プレイリスト動画関連を削除（CASCADE設定により自動削除されるが明示的に削除）
      await tx.playlistVideo.deleteMany({
        where: { playlistId: playlist.id }
      })

      // プレイリストを削除
      await tx.playlist.delete({
        where: { playlistId }
      })
    })

    return NextResponse.json({
      success: true,
      message: 'プレイリストを削除しました'
    })

  } catch (error) {
    console.error('Playlist Delete Error:', error)
    return NextResponse.json(
      { success: false, error: 'プレイリストの削除に失敗しました' },
      { status: 500 }
    )
  }
} 