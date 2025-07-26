import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR', 'VIEWER']);
    if (authResult.error) {
      return authResult.error;
    }
    const currentUser = authResult.user!;
    const userId = parseInt(currentUser.userId);

    const resolvedParams = await params;
    const videoId = parseInt(resolvedParams.videoId);

    if (isNaN(videoId)) {
      return createErrorResponse('無効な動画IDです', 400);
    }

    // お気に入りの存在確認
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId
        }
      },
      include: {
        video: {
          select: {
            title: true
          }
        }
      }
    });

    if (!favorite) {
      return createErrorResponse('お気に入りが見つかりません', 404);
    }

    // お気に入りを削除
    await prisma.favorite.delete({
      where: {
        id: favorite.id
      }
    });

    return createSuccessResponse({
      message: `「${favorite.video.title}」をお気に入りから削除しました`
    });

  } catch (error) {
    console.error('お気に入り削除エラー:', error);
    return createErrorResponse('お気に入りの削除に失敗しました', 500);
  }
}