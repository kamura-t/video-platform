import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR', 'VIEWER']);
    if (authResult.error) {
      return authResult.error;
    }
    const currentUser = authResult.user!;
    const userId = parseInt(currentUser.userId);

    const body = await request.json();
    const { videoIds } = body;


    if (!Array.isArray(videoIds) || videoIds.length === 0) {
      return createErrorResponse('動画IDの配列が必要です', 400);
    }

    // videoIdsの各要素が有効な数値かチェック
    const validVideoIds = videoIds
      .filter(id => id != null && !isNaN(parseInt(id)))
      .map(id => parseInt(id));


    if (validVideoIds.length === 0) {
      return createErrorResponse('有効な動画IDが含まれていません', 400);
    }

    // 指定された動画のお気に入り状態をチェック
    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
        videoId: {
          in: validVideoIds
        }
      },
      select: {
        videoId: true
      }
    });

    const favoriteVideoIds = favorites.map(f => f.videoId);
    const favoriteStatus = validVideoIds.reduce((acc, videoId) => {
      acc[videoId.toString()] = favoriteVideoIds.includes(videoId);
      return acc;
    }, {} as Record<string, boolean>);

    return createSuccessResponse(favoriteStatus);

  } catch (error) {
    console.error('お気に入り状態チェックエラー:', error);
    return createErrorResponse('お気に入り状態の確認に失敗しました', 500);
  }
}