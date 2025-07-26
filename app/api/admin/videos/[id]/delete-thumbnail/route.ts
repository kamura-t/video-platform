import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';
import fs from 'fs';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return createErrorResponse('認証が必要です', 401);
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return createErrorResponse('無効なトークンです', 401);
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
      select: { id: true, role: true }
    });

    if (!user) {
      return createErrorResponse('ユーザーが見つかりません', 404);
    }

    // 管理者・キュレーター権限チェック
    if (!['ADMIN', 'CURATOR'].includes(user.role)) {
      return createErrorResponse('管理者またはキュレーター権限が必要です', 403);
    }

    const resolvedParams = await params;
    const videoId = resolvedParams.id;

    // 動画を取得
    const video = await prisma.video.findUnique({
      where: {
        videoId: videoId
      }
    });

    if (!video) {
      return createErrorResponse('動画が見つかりません', 404);
    }

    // サムネイルURLが存在しない場合
    if (!video.thumbnailUrl) {
      return createErrorResponse('削除するサムネイルが存在しません', 400);
    }

    let deletedFilePath = null;

    try {
      // ファイルパスから物理ファイルを削除
      if (video.thumbnailUrl.startsWith('/videos/thumbnails/')) {
        const fileName = path.basename(video.thumbnailUrl);
        // NASストレージからファイルを削除（設定から取得したbasePath使用）
        const { storageService } = await import('@/lib/storage-service');
        const storageConfig = await storageService.getStorageInfo();
        const fullPath = path.join(storageConfig.basePath, 'thumbnails', fileName);
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          deletedFilePath = fullPath;
          console.log('Thumbnail file deleted:', fullPath);
        }
      }
    } catch (fileError) {
      console.error('Failed to delete thumbnail file:', fileError);
      // ファイル削除に失敗してもDBの更新は続行
    }

    // データベースのサムネイルURLは削除しない（再作成・アップロード時に利用するため）
    // ファイルのみ削除

    return createSuccessResponse({
      message: 'サムネイルファイルを削除しました（DBのURLは保持）',
      video: {
        videoId: video.videoId,
        thumbnailUrl: video.thumbnailUrl
      },
      deletedFilePath
    });

  } catch (error) {
    console.error('Thumbnail deletion error:', error);
    return createErrorResponse('サムネイルの削除に失敗しました', 500);
  }
}