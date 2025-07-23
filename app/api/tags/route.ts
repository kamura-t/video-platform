import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse, createAuthErrorResponse, createPermissionErrorResponse, createValidationErrorResponse } from '@/lib/api-response';

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      select: {
        id: true,
        name: true,
        videoCount: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            videos: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return createSuccessResponse(tags);
  } catch (error) {
    console.error('Tags API Error:', error);
    return createErrorResponse('タグの取得に失敗しました', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }

    const user = verifyToken(token);
    if (!user || !['admin', 'curator'].includes(user.role?.toLowerCase() || '')) {
      return NextResponse.json(
        { success: false, error: '権限がありません' },
        { status: 401 }
      );
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { success: false, error: '名前は必須です' },
        { status: 400 }
      );
    }

    // Check if name already exists
    const existingTag = await prisma.tag.findUnique({
      where: { name }
    });

    if (existingTag) {
      return NextResponse.json(
        { success: false, error: 'この名前のタグは既に存在します' },
        { status: 400 }
      );
    }

    const tag = await prisma.tag.create({
      data: {
        name
      }
    });

    return NextResponse.json({
      success: true,
      data: tag
    });
  } catch (error) {
    console.error('Create Tag Error:', error);
    return NextResponse.json(
      { success: false, error: 'タグの作成に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }

    const user = verifyToken(token);
    if (!user || !['admin', 'curator'].includes(user.role?.toLowerCase() || '')) {
      return NextResponse.json(
        { success: false, error: '権限がありません' },
        { status: 401 }
      );
    }

    const { id, name } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { success: false, error: 'IDと名前は必須です' },
        { status: 400 }
      );
    }

    // Check if name already exists (excluding current tag)
    const existingTag = await prisma.tag.findFirst({
      where: { 
        name,
        NOT: { id }
      }
    });

    if (existingTag) {
      return NextResponse.json(
        { success: false, error: 'この名前のタグは既に存在します' },
        { status: 400 }
      );
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: {
        name
      }
    });

    return NextResponse.json({
      success: true,
      data: tag
    });
  } catch (error) {
    console.error('Update Tag Error:', error);
    return NextResponse.json(
      { success: false, error: 'タグの更新に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }

    const user = verifyToken(token);
    if (!user || !['admin', 'curator'].includes(user.role?.toLowerCase() || '')) {
      return NextResponse.json(
        { success: false, error: '権限がありません' },
        { status: 401 }
      );
    }

    const { id, force } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'IDは必須です' },
        { status: 400 }
      );
    }

    // Check if tag is being used
    const tagUsageCount = await prisma.videoTag.count({
      where: { tagId: id }
    });

    if (tagUsageCount > 0 && !force) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'このタグは動画で使用されているため削除できません',
          usageCount: tagUsageCount,
          requiresForce: true
        },
        { status: 400 }
      );
    }

    // For force deletion, use transaction to ensure consistency
    if (force && tagUsageCount > 0) {
      await prisma.$transaction(async (tx: any) => {
        // First, delete all video-tag relationships
        await tx.videoTag.deleteMany({
          where: { tagId: id }
        });

        // Then delete the tag
        await tx.tag.delete({
          where: { id }
        });
      });

      return NextResponse.json({
        success: true,
        message: `タグを強制削除しました（${tagUsageCount}個の動画から削除）`
      });
    } else {
      // Normal deletion when no usage
      await prisma.tag.delete({
        where: { id }
      });

      return NextResponse.json({
        success: true,
        message: 'タグを削除しました'
      });
    }
  } catch (error) {
    console.error('Delete Tag Error:', error);
    return NextResponse.json(
      { success: false, error: 'タグの削除に失敗しました' },
      { status: 500 }
    );
  }
}