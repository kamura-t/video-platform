import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { generateThumbnailFromVideo } from '@/lib/upload-utils';
import { processThumbnail, generateImageFileName, deleteImageFile } from '@/lib/image-utils';
import { storageService } from '@/lib/storage-service';
import { gpuTranscoderClient } from '@/lib/gpu-transcoder';
import { configService } from '@/lib/config-service';
import path from 'path';
import fs from 'fs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 認証確認
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    const token = cookieToken || headerToken;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 管理者権限チェック
    if (!['ADMIN', 'CURATOR'].includes(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolvedParams = await params;
    const videoId = resolvedParams.id;
    const body = await request.json();
    const { timestamp = 5 } = body;

    // 動画情報を取得
    const video = await prisma.video.findUnique({
      where: { videoId },
      select: {
        id: true,
        videoId: true,
        title: true,
        filePath: true,
        uploadType: true,
        uploaderId: true
      }
    });

    console.log('Video lookup result:', { videoId, video });

    if (!video) {
      return NextResponse.json({ error: '動画が見つかりません' }, { status: 404 });
    }

    // ファイルアップロード動画のみ対応
    if (video.uploadType !== 'FILE') {
      return NextResponse.json({ 
        error: 'ファイルアップロード動画のみサムネイル生成が可能です' 
      }, { status: 400 });
    }

    if (!video.filePath) {
      return NextResponse.json({ 
        error: '動画ファイルパスが設定されていません' 
      }, { status: 400 });
    }

    // 権限チェック（管理者または投稿者のみ）
    if (payload.role !== 'ADMIN' && video.uploaderId !== parseInt(payload.userId)) {
      return NextResponse.json({ error: 'この動画を編集する権限がありません' }, { status: 403 });
    }

    // ストレージ設定を取得
    const storageConfig = await storageService.getStorageInfo();
    
    // 動画ファイルの存在確認（NASパスを考慮）
    let videoFilePath;
    if (video.filePath && video.filePath.startsWith('/videos/')) {
      // NASのファイルパス（設定から取得）
      const relativePath = video.filePath.replace('/videos/', '');
      videoFilePath = path.join(storageConfig.basePath, relativePath);
    } else if (video.filePath) {
      // ローカルファイルパス
      videoFilePath = path.join(process.cwd(), 'public', video.filePath);
    } else {
      return NextResponse.json({ 
        error: '動画ファイルパスが設定されていません' 
      }, { status: 400 });
    }
    
    console.log('Video file path check:', { 
      originalPath: video.filePath, 
      resolvedPath: videoFilePath, 
      exists: fs.existsSync(videoFilePath) 
    });
    
    if (!fs.existsSync(videoFilePath)) {
      return NextResponse.json({ 
        error: '動画ファイルが見つかりません' 
      }, { status: 404 });
    }

    // 既存のサムネイルURLを取得
    const existingThumbnailUrl = await prisma.video.findUnique({
      where: { videoId },
      select: { thumbnailUrl: true }
    });
    
    // 既存のファイル名を再利用、または新しいファイル名を生成
    let thumbnailFileName: string;
    let thumbnailPath: string;
    
    if (existingThumbnailUrl?.thumbnailUrl) {
      // 既存のファイル名を再利用
      thumbnailFileName = path.basename(existingThumbnailUrl.thumbnailUrl);
      thumbnailPath = `/mnt/nas/videos/thumbnails/${thumbnailFileName}`;
      console.log('既存のファイル名を再利用:', thumbnailFileName);
      
      // 既存のサムネイルファイルを削除
      const localThumbnailPath = path.join(storageConfig.basePath, 'thumbnails', thumbnailFileName);
      if (fs.existsSync(localThumbnailPath)) {
        try {
          fs.unlinkSync(localThumbnailPath);
          console.log('既存のサムネイルファイルを削除:', localThumbnailPath);
        } catch (error) {
          console.warn('既存のサムネイルファイル削除に失敗:', error);
        }
      }
    } else {
      // 新しいファイル名を生成
      thumbnailFileName = generateImageFileName(`${videoId}_converted_thumb`, video.title);
      thumbnailPath = `/mnt/nas/videos/thumbnails/${thumbnailFileName}`;
      console.log('新しいファイル名を生成:', thumbnailFileName);
    }
    
    try {
      // システム設定からサムネイル設定を取得
      const thumbnailConfig = await configService?.getThumbnailConfig();
      console.log('🖼️ サムネイル設定:', thumbnailConfig);

      // GPU変換サーバー用のパスに変換
      const nasMountPath = process.env.NAS_VIDEOS_PATH || '/Volumes/videos';
      const gpuMountPath = process.env.GPU_NAS_VIDEOS_PATH || '/mnt/nas/videos';
      const gpuInputPath = videoFilePath.replace(nasMountPath, gpuMountPath);
      console.log('GPU変換サーバーに送信するパス:', {
        originalPath: videoFilePath,
        gpuPath: gpuInputPath
      });

      // 設定に応じてファイル名を調整
      const configFormat = thumbnailConfig?.format || 'jpg';
      if (!thumbnailFileName.endsWith(`.${configFormat}`)) {
        // ファイル名の拡張子を設定に合わせて変更
        const nameWithoutExt = thumbnailFileName.replace(/\.[^/.]+$/, '');
        thumbnailFileName = `${nameWithoutExt}.${configFormat}`;
        thumbnailPath = `/mnt/nas/videos/thumbnails/${thumbnailFileName}`;
      }

      // GPU変換サーバーにサムネイル生成リクエストを送信
      const response = await fetch(`${gpuTranscoderClient['baseURL']}/generate-thumbnail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputFile: gpuInputPath,
          outputPath: thumbnailPath,
          timestamp: timestamp,
          size: '1280x720',
          width: 1280,
          height: 720,
          format: configFormat,
          quality: thumbnailConfig?.quality || 95
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `GPU変換サーバーエラー: ${response.status}`);
      }

      const result = await response.json();
      console.log('GPU変換サーバーサムネイル生成結果:', result);
      
      // --- ファイル存在確認を省略 ---
      // const gpuMountPath = process.env.GPU_NAS_VIDEOS_PATH || '/mnt/nas/videos';
      // const nasMountPath = process.env.NAS_VIDEOS_PATH || '/Volumes/videos';
      // const localThumbnailPath = thumbnailPath.replace(gpuMountPath, nasMountPath);
      // let fileExists = false;
      // for (let i = 0; i < 20; i++) {
      //   if (fs.existsSync(localThumbnailPath)) {
      //     fileExists = true;
      //     break;
      //   }
      //   await new Promise(resolve => setTimeout(resolve, 200));
      // }
      // if (!fileExists) {
      //   console.error('サムネイルファイルが見つかりません:', {
      //     gpuPath: thumbnailPath,
      //     localPath: localThumbnailPath,
      //     exists: fs.existsSync(localThumbnailPath)
      //   });
      //   throw new Error('GPU変換サーバーでサムネイルが生成されませんでした');
      // }
      
      // ファイル情報を取得（省略可）
      // const stats = fs.statSync(localThumbnailPath);
      // const processResult = { ... };
      
      // サムネイルURLを生成（既存がある場合は既存のパス形式を維持、ない場合は新規作成）
      const thumbnailUrl = existingThumbnailUrl?.thumbnailUrl 
        ? `/videos/thumbnails/${thumbnailFileName}` 
        : `/videos/thumbnails/${thumbnailFileName}`;

      // ファイル名が変更された場合（拡張子変更など）またはURLが存在しない場合はデータベースを更新
      const currentBaseName = existingThumbnailUrl?.thumbnailUrl ? path.basename(existingThumbnailUrl.thumbnailUrl) : null;
      if (!existingThumbnailUrl?.thumbnailUrl || currentBaseName !== thumbnailFileName) {
        await prisma.video.update({
          where: { videoId },
          data: { thumbnailUrl }
        });
        console.log('サムネイルURLをデータベースに保存:', thumbnailUrl);
      } else {
        console.log('既存のサムネイルURLを維持:', thumbnailUrl);
      }

      return NextResponse.json({
        success: true,
        thumbnailUrl,
        thumbnailInfo: {
          fileName: thumbnailFileName,
          // fileSize: processResult.fileSize, // 省略
          // dimensions: `${processResult.width}x${processResult.height}`, // 省略
          format: thumbnailConfig?.format || 'jpg',
          timestamp
        }
      });
      
    } catch (error) {
      console.error('GPU変換サーバーサムネイル生成エラー:', error);
      throw new Error(`GPU変換サーバーでサムネイル生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    }
  } catch (error) {
    console.error('サムネイル生成エラー:', error);
    return NextResponse.json({ 
      error: `サムネイル生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` 
    }, { status: 500 });
  }
}

 