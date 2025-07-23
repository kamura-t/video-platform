import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { withRateLimit } from '@/lib/rate-limiter'
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse } from '@/lib/api-response'
import { NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = '24h'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    console.log('Login attempt:', { username, password: '***' })

    // 入力検証
    if (!username || !password) {
      return createValidationErrorResponse('ユーザー名とパスワードが必要です')
    }

    // ユーザー検索（ユーザー名またはメールアドレス）
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username }
        ],
        isActive: true
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        passwordHash: true,
        role: true,
        authProvider: true,
        department: true,
        profileImageUrl: true,
        failedLoginCount: true,
        lastFailedLoginAt: true
      }
    })

    console.log('User found:', user ? { id: user.id, username: user.username, role: user.role, authProvider: user.authProvider } : 'Not found')

    if (!user) {
      return createErrorResponse('ユーザー名またはパスワードが間違っています', 401)
    }

    // Google OAuth ユーザーの場合はパスワード認証不可
    if (user.authProvider === 'GOOGLE') {
      return createErrorResponse('Googleアカウントでログインしてください', 400)
    }

    // パスワード検証
    if (!user.passwordHash) {
      return createErrorResponse('パスワードが設定されていません', 400)
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    console.log('Password validation:', { isValid: isValidPassword })

    if (!isValidPassword) {
      // 失敗回数を増やす
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: { increment: 1 },
          lastFailedLoginAt: new Date()
        }
      })

      return createErrorResponse('ユーザー名またはパスワードが間違っています', 401)
    }

    // アカウントロック確認
    if (user.failedLoginCount >= 10) {
      const lockoutTime = 30 * 60 * 1000 // 30分
      const timeSinceLastFail = Date.now() - (user.lastFailedLoginAt?.getTime() || 0)
      
      if (timeSinceLastFail < lockoutTime) {
        return createErrorResponse('アカウントがロックされています。しばらく後に再試行してください。', 423)
      }
    }

    // ログイン成功 - 失敗カウントをリセット
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lastFailedLoginAt: null,
        lastLoginAt: new Date()
      }
    })

    // JWTトークン生成
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    // 成功時のレスポンス
    const responseData = {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        department: user.department,
        profileImageUrl: user.profileImageUrl
      },
      // 権限に応じたリダイレクト先を設定
      redirectTo: user.role === 'VIEWER' ? '/account' : '/admin'
    }

    const response = NextResponse.json(responseData)
    
    // JWTトークンをクッキーに設定
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24時間
    })

    return response

  } catch (error) {
    console.error('Login API Error:', error)
    return createErrorResponse('サーバーエラーが発生しました', 500)
  }
} 