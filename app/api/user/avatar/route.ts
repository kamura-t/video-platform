import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { storageService } from '@/lib/storage-service'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const currentUser = verifyToken(token)
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '無効なトークンです' },
        { status: 401 }
      )
    }

    const userId = parseInt(currentUser.userId)

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'ユーザーが見つかりません' },
        { status: 404 }
      )
    }

    const data = await request.formData()
    const file: File | null = data.get('avatar') as unknown as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ファイルが選択されていません' },
        { status: 400 }
      )
    }

    // ファイルタイプの検証
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'サポートされていないファイル形式です（JPEG、PNG、WebPのみ）' },
        { status: 400 }
      )
    }

    // ファイルサイズの検証（管理画面の設定から取得）
    const settings = await prisma.systemSetting.findMany({
      where: { settingKey: 'max_image_size_mb' }
    })
    const maxSizeMB = parseInt(settings[0]?.settingValue || '2')
    const maxSize = maxSizeMB * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `ファイルサイズが大きすぎます（最大${maxSizeMB}MB）` },
        { status: 400 }
      )
    }

    // 古いアバター画像のパスを取得
    const oldAvatarPath = user.profileImageUrl

    // StorageServiceを使用してアバターを更新（古い画像は自動削除）
    const saveResult = await storageService.updateAvatar(
      file, 
      file.name, 
      userId.toString(),
      oldAvatarPath || undefined
    )

    // ユーザーのプロフィール画像URLを更新
    const profileImageUrl = saveResult.urlPath
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileImageUrl },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        department: true,
        profileImageUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'プロフィール画像を更新しました'
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { success: false, error: 'プロフィール画像のアップロードに失敗しました' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const currentUser = verifyToken(token)
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '無効なトークンです' },
        { status: 401 }
      )
    }

    const userId = parseInt(currentUser.userId)

    // 現在のユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'ユーザーが見つかりません' },
        { status: 404 }
      )
    }

    // 古いアバター画像を削除
    if (user.profileImageUrl) {
      await storageService.deleteAvatar(user.profileImageUrl)
    }

    // プロフィール画像URLをクリア
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileImageUrl: null },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        department: true,
        profileImageUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'プロフィール画像を削除しました'
    })
  } catch (error) {
    console.error('Avatar delete error:', error)
    return NextResponse.json(
      { success: false, error: 'プロフィール画像の削除に失敗しました' },
      { status: 500 }
    )
  }
} 