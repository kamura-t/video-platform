import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
      select: { id: true, role: true }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    const body = await request.json()
    const { categoryIds } = body

    if (!Array.isArray(categoryIds)) {
      return NextResponse.json({ error: 'カテゴリIDの配列が必要です' }, { status: 400 })
    }

    // トランザクションで並び順を更新
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < categoryIds.length; i++) {
        await tx.category.update({
          where: { id: parseInt(categoryIds[i]) },
          data: { sortOrder: i }
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'カテゴリの並び順を更新しました'
    })

  } catch (error) {
    console.error('Category reorder error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'カテゴリの並び替えに失敗しました' 
      },
      { status: 500 }
    )
  }
} 