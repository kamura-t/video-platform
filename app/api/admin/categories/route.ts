import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        videoCount: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            videos: true
          }
        }
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error) {
    console.error('Categories API Error:', error)
    return NextResponse.json(
      { success: false, error: 'カテゴリの取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const user = verifyToken(token)
    if (!user || user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    const { name, slug, description, color } = await request.json()

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: '名前とスラッグは必須です' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingCategory = await prisma.category.findUnique({
      where: { slug }
    })

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: 'このスラッグは既に使用されています' },
        { status: 400 }
      )
    }

    // Get the next sort order (highest + 1)
    const lastCategory = await prisma.category.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })
    
    const nextSortOrder = (lastCategory?.sortOrder || 0) + 1

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        color: color || '#6B7280',
        sortOrder: nextSortOrder
      }
    })

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    console.error('Create Category Error:', error)
    return NextResponse.json(
      { success: false, error: 'カテゴリの作成に失敗しました' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const user = verifyToken(token)
    if (!user || user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    const { id, name, slug, description, color } = await request.json()

    if (!id || !name || !slug) {
      return NextResponse.json(
        { success: false, error: 'ID、名前、スラッグは必須です' },
        { status: 400 }
      )
    }

    // Check if slug already exists (excluding current category)
    const existingCategory = await prisma.category.findFirst({
      where: { 
        slug,
        NOT: { id }
      }
    })

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: 'このスラッグは既に使用されています' },
        { status: 400 }
      )
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        description,
        color: color || '#6B7280'
      }
    })

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    console.error('Update Category Error:', error)
    return NextResponse.json(
      { success: false, error: 'カテゴリの更新に失敗しました' },
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

    const user = verifyToken(token)
    if (!user || user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json(
        { success: false, error: '管理者権限が必要です' },
        { status: 403 }
      )
    }

    const { id, force } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'IDは必須です' },
        { status: 400 }
      )
    }

    // Check if category is being used
    const categoryUsageCount = await prisma.videoCategory.count({
      where: { categoryId: id }
    })

    if (categoryUsageCount > 0 && !force) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'このカテゴリは動画で使用されているため削除できません',
          usageCount: categoryUsageCount,
          requiresForce: true
        },
        { status: 400 }
      )
    }

    // For force deletion, use transaction to ensure consistency
    if (force && categoryUsageCount > 0) {
      await prisma.$transaction(async (tx: any) => {
        // First, delete all video-category relationships
        await tx.videoCategory.deleteMany({
          where: { categoryId: id }
        })

        // Then delete the category
        await tx.category.delete({
          where: { id }
        })
      })

      return NextResponse.json({
        success: true,
        message: `カテゴリを強制削除しました（${categoryUsageCount}個の動画から削除）`
      })
    } else {
      // Normal deletion when no usage
      await prisma.category.delete({
        where: { id }
      })

      return NextResponse.json({
        success: true,
        message: 'カテゴリを削除しました'
      })
    }
  } catch (error) {
    console.error('Delete Category Error:', error)
    return NextResponse.json(
      { success: false, error: 'カテゴリの削除に失敗しました' },
      { status: 500 }
    )
  }
} 