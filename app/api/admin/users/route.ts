import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { createSuccessResponse, createErrorResponse, createAuthErrorResponse, createPermissionErrorResponse, createValidationErrorResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return createAuthErrorResponse()
    }

    const user = verifyToken(token)
    if (!user || !['ADMIN', 'CURATOR'].includes(user.role)) {
      return createPermissionErrorResponse()
    }

    // URLパラメータを取得
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || 'all'
    const onlyUploaders = searchParams.get('onlyUploaders') === 'true'

    // 検索条件を構築
    const where: any = {}
    
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (role !== 'all') {
      where.role = role.toUpperCase()
    }

    // 動画投稿者のみを取得する場合（動画管理画面用）
    if (onlyUploaders) {
      where.videos = {
        some: {} // 動画を持っているユーザーのみ
      }
      
      const uploaders = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          _count: {
            select: {
              videos: true
            }
          }
        },
        orderBy: {
          displayName: 'asc'
        }
      })

      return createSuccessResponse(uploaders.map(user => ({
        id: user.id.toString(),
        username: user.username,
        displayName: user.displayName,
        videoCount: user._count.videos
      })))
    }

    // 全ユーザーを取得（ユーザー管理画面用）
    const skip = (page - 1) * limit

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          role: true,
          department: true,
          profileImageUrl: true,
          isActive: true,
          failedLoginCount: true,
          lastFailedLoginAt: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              videos: true,
              posts: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return createSuccessResponse({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('Users API Error:', error)
    return createErrorResponse('ユーザーの取得に失敗しました', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return createAuthErrorResponse()
    }

    const user = verifyToken(token)
    if (!user || user.role?.toLowerCase() !== 'admin') {
      return createPermissionErrorResponse()
    }

    const { username, displayName, email, password, role, department } = await request.json()

    if (!username || !displayName || !email || !password || !role) {
      return createValidationErrorResponse('ユーザー名、表示名、メールアドレス、パスワード、役割は必須です')
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    })

    if (existingUser) {
      return createValidationErrorResponse('このユーザー名またはメールアドレスは既に使用されています')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    const newUser = await prisma.user.create({
      data: {
        username,
        displayName,
        email,
        passwordHash,
        role: role.toUpperCase(),
        department,
        isActive: true
      },
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

    return createSuccessResponse(newUser)
  } catch (error) {
    console.error('Create User Error:', error)
    return createErrorResponse('ユーザーの作成に失敗しました', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return createAuthErrorResponse()
    }

    const currentUser = verifyToken(token)
    if (!currentUser || currentUser.role?.toLowerCase() !== 'admin') {
      return createPermissionErrorResponse()
    }

    const { id, username, displayName, email, role, department, isActive, password } = await request.json()

    if (!id || !username || !displayName || !email || !role) {
      return createValidationErrorResponse('ID、ユーザー名、表示名、メールアドレス、役割は必須です')
    }

    // Check if username or email already exists (excluding current user)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ],
        NOT: { id: parseInt(id) }
      }
    })

    if (existingUser) {
      return createValidationErrorResponse('このユーザー名またはメールアドレスは既に使用されています')
    }

    // Prepare update data
    const updateData: any = {
      username,
      displayName,
      email,
      role: role.toUpperCase(),
      department,
      isActive
    }

    // Hash new password if provided
    if (password && password.trim() !== '') {
      updateData.passwordHash = await bcrypt.hash(password, 12)
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
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

    return createSuccessResponse(updatedUser)
  } catch (error) {
    console.error('Update User Error:', error)
    return createErrorResponse('ユーザーの更新に失敗しました', 500)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return createAuthErrorResponse()
    }

    const currentUser = verifyToken(token)
    if (!currentUser || currentUser.role?.toLowerCase() !== 'admin') {
      return createPermissionErrorResponse()
    }

    const { id } = await request.json()

    if (!id) {
      return createValidationErrorResponse('IDは必須です')
    }

    const userId = parseInt(id)

    // Prevent self-deletion
    if (currentUser.userId === userId.toString()) {
      return createValidationErrorResponse('自分自身を削除することはできません')
    }

    // Check if user has content
    const userContent = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        _count: {
          select: {
            videos: true,
            posts: true
          }
        }
      }
    })

    if (userContent && (userContent._count.videos > 0 || userContent._count.posts > 0)) {
      return createValidationErrorResponse('このユーザーはコンテンツを投稿しているため削除できません')
    }

    await prisma.user.delete({
      where: { id: userId }
    })

    return createSuccessResponse({ message: 'ユーザーを削除しました' })
  } catch (error) {
    console.error('Delete User Error:', error)
    return createErrorResponse('ユーザーの削除に失敗しました', 500)
  }
} 