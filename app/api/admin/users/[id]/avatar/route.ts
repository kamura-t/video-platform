import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { storageService } from '@/lib/storage-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);

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
        { success: false, error: '権限がありません' },
        { status: 401 }
      )
    }

    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: '無効なユーザーIDです' },
        { status: 400 }
      )
    }

    // Check if user exists
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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'サポートされていないファイル形式です（JPEG、PNG、WebPのみ）' },
        { status: 400 }
      )
    }

    // Validate file size (管理画面の設定から取得)
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

    // Update user's profile image URL
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
        isActive: true,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
        { success: false, error: '権限がありません' },
        { status: 401 }
      )
    }

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id)
    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: '無効なユーザーIDです' },
        { status: 400 }
      )
    }

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

    // Remove profile image URL from user
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
        isActive: true,
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