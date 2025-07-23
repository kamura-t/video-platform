import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { createSuccessResponse, createErrorResponse, createAuthErrorResponse } from '@/lib/api-response'
import { withRateLimit } from '@/lib/rate-limiter'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

interface JWTPayload {
  userId: number
  username: string
  role: string
  email: string
  iat: number
  exp: number
}

export async function GET(request: NextRequest) {
  try {
    // クッキーまたはAuthorizationヘッダーからトークンを取得
    const cookieToken = request.cookies.get('auth-token')?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    
    const token = cookieToken || headerToken

    if (!token) {
      return createAuthErrorResponse();
    }

    // トークン検証
    let payload: JWTPayload
    try {
      payload = jwt.verify(token, JWT_SECRET) as JWTPayload
    } catch (error) {
      return createErrorResponse('無効なトークンです', 401);
    }

    // ユーザー情報を取得
    const user = await prisma.user.findUnique({
      where: {
        id: payload.userId,
        isActive: true
      },
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
        createdAt: true
      }
    })

    if (!user) {
      return createErrorResponse('ユーザーが見つかりません', 404);
    }

    return createSuccessResponse({ user });

  } catch (error) {
    console.error('Me API Error:', error)
    return createErrorResponse('サーバーエラーが発生しました', 500);
  }
} 