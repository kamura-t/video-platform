import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { createSuccessResponse, createErrorResponse, createAuthErrorResponse, createValidationErrorResponse } from '@/lib/api-response'
import { withRateLimit } from '@/lib/rate-limiter'

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return createAuthErrorResponse();
    }

    const currentUser = verifyToken(token)
    if (!currentUser) {
      return createErrorResponse('無効なトークンです', 401);
    }

    const { displayName, email, department, bio, currentPassword, newPassword } = await request.json()

    if (!displayName || !email) {
      return createValidationErrorResponse('表示名とメールアドレスは必須です');
    }

    const userId = parseInt(currentUser.userId)

    // 現在のユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        authProvider: true,
        passwordHash: true
      }
    })

    if (!user) {
      return createErrorResponse('ユーザーが見つかりません', 404);
    }

    // メールアドレスの重複チェック（自分以外）
    if (email !== user.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: userId }
        }
      })

      if (existingUser) {
        return createValidationErrorResponse('このメールアドレスは既に使用されています');
      }
    }

    // 更新データの準備
    const updateData: any = {
      displayName,
      email,
      department: department || null,
      bio: bio || null,
      updatedAt: new Date()
    }

    // パスワード変更の処理
    if (newPassword) {
      if (!currentPassword) {
        return createValidationErrorResponse('現在のパスワードを入力してください');
      }

      // Googleユーザーはパスワード変更不可
      if (user.authProvider === 'GOOGLE') {
        return createValidationErrorResponse('Googleアカウントユーザーはパスワードを変更できません');
      }

      // 現在のパスワードを検証
      if (!user.passwordHash) {
        return createValidationErrorResponse('パスワードが設定されていません');
      }
      
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isCurrentPasswordValid) {
        return createValidationErrorResponse('現在のパスワードが正しくありません');
      }

      // 新しいパスワードをハッシュ化
      updateData.passwordHash = await bcrypt.hash(newPassword, 12)
    }

    // ユーザー情報を更新
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        department: true,
        bio: true,
        profileImageUrl: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return createSuccessResponse(updatedUser, 'プロフィールを更新しました');
  } catch (error) {
    console.error('Profile update error:', error)
    return createErrorResponse('プロフィールの更新に失敗しました', 500);
  }
} 