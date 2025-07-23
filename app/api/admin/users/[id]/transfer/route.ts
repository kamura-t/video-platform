import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(
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
    if (!currentUser || currentUser.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    const { id } = await params
    const sourceUserId = parseInt(id)
    const { targetUserId, deleteAfterTransfer = false } = await request.json()

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: '移譲先ユーザーIDが必要です' },
        { status: 400 }
      )
    }

    const targetUserIdInt = parseInt(targetUserId)

    // 移譲元ユーザーの存在確認
    const sourceUser = await prisma.user.findUnique({
      where: { id: sourceUserId },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        _count: {
          select: {
            videos: true,
            posts: true,
            playlists: true
          }
        }
      }
    })

    if (!sourceUser) {
      return NextResponse.json(
        { success: false, error: '移譲元ユーザーが見つかりません' },
        { status: 404 }
      )
    }

    // 移譲先ユーザーの存在確認
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserIdInt },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: '移譲先ユーザーが見つかりません' },
        { status: 404 }
      )
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { success: false, error: '移譲先ユーザーが無効になっています' },
        { status: 400 }
      )
    }

    // 自分自身への移譲を防ぐ
    if (sourceUserId === targetUserIdInt) {
      return NextResponse.json(
        { success: false, error: '自分自身に移譲することはできません' },
        { status: 400 }
      )
    }

    // 現在のユーザーの削除を防ぐ
    if (currentUser.userId === sourceUserId.toString()) {
      return NextResponse.json(
        { success: false, error: '現在ログイン中のユーザーは削除できません' },
        { status: 400 }
      )
    }

    // トランザクション内でコンテンツを移譲
    const result = await prisma.$transaction(async (tx) => {
      // 動画の移譲
      const videoUpdateResult = await tx.video.updateMany({
        where: { uploaderId: sourceUserId },
        data: { uploaderId: targetUserIdInt }
      })

      // ポストの移譲
      const postUpdateResult = await tx.post.updateMany({
        where: { creatorId: sourceUserId },
        data: { creatorId: targetUserIdInt }
      })

      // プレイリストの移譲
      const playlistUpdateResult = await tx.playlist.updateMany({
        where: { creatorId: sourceUserId },
        data: { creatorId: targetUserIdInt }
      })

      // 移譲後にユーザーを削除する場合
      if (deleteAfterTransfer) {
        await tx.user.delete({
          where: { id: sourceUserId }
        })
      }

      return {
        transferredVideos: videoUpdateResult.count,
        transferredPosts: postUpdateResult.count,
        transferredPlaylists: playlistUpdateResult.count,
        userDeleted: deleteAfterTransfer
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        sourceUser: {
          id: sourceUser.id,
          username: sourceUser.username,
          displayName: sourceUser.displayName
        },
        targetUser: {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.displayName
        },
        transferredContent: {
          videos: result.transferredVideos,
          posts: result.transferredPosts,
          playlists: result.transferredPlaylists
        },
        userDeleted: result.userDeleted
      },
      message: `${sourceUser.displayName}のコンテンツを${targetUser.displayName}に移譲しました${result.userDeleted ? '。ユーザーも削除されました。' : '。'}`
    })

  } catch (error) {
    console.error('Content Transfer Error:', error)
    return NextResponse.json(
      { success: false, error: 'コンテンツの移譲に失敗しました' },
      { status: 500 }
    )
  }
} 