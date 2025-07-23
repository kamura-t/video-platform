import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gpuTranscoderClient } from '@/lib/gpu-transcoder'
import { storageService } from '@/lib/storage-service'
import jwt from 'jsonwebtoken'
import path from 'path';
import { deleteFile } from '@/lib/file-utils';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

interface JWTPayload {
  userId: number
  username: string
  role: string
  email: string
  iat: number
  exp: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const resolvedParams = await params
    const { jobId } = resolvedParams
    
    // 認証チェック（オプション）
    const cookieToken = request.cookies.get('auth-token')?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    
    const token = cookieToken || headerToken
    let payload: JWTPayload | null = null

    if (token) {
      try {
        payload = jwt.verify(token, JWT_SECRET) as JWTPayload
      } catch (error) {
        // トークンが無効でも続行（公開APIとして扱う）
        console.log('Invalid token, continuing as public API')
      }
    }

    // データベースから変換ジョブ情報を取得
    const transcodeJob = await (prisma as any).transcodeJob.findUnique({
      where: { jobId },
      include: {
        video: {
          select: {
            videoId: true,
            title: true,
            uploaderId: true,
            thumbnailUrl: true
          }
        }
      }
    })

    if (!transcodeJob) {
      return NextResponse.json({ error: '変換ジョブが見つかりません' }, { status: 404 })
    }

    // 権限チェック：認証されている場合のみチェック
    if (payload && payload.role.toLowerCase() !== 'admin' && transcodeJob.video.uploaderId !== payload.userId) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 })
    }

    try {
      // GPU変換サーバーから最新の状態を取得
      const gpuJobStatus = await gpuTranscoderClient.getJobStatus(jobId)
      
      // GPU変換サーバーの利用可能なAPIエンドポイントを確認
      let availableEndpoints = null;
      try {
        availableEndpoints = await gpuTranscoderClient.checkAvailableEndpoints();
      } catch (endpointError) {
        // エラーは無視
      }
      
      // GPU変換サーバーのシステム状態も取得
      let systemStatus = null;
      try {
        systemStatus = await gpuTranscoderClient.getSystemStatus();
      } catch (systemError) {
        // エラーは無視
      }
      
      // 軽量版の進捗情報も取得
      let progressInfo = null;
      try {
        // 軽量版APIが利用可能な場合のみ使用
        if (!availableEndpoints || availableEndpoints.jobProgress) {
          progressInfo = await gpuTranscoderClient.getJobProgress(jobId);
        }
      } catch (progressError) {
        // エラーは無視、通常版を使用
      }
      
      // データベースの状態を更新
      let updatedJob = transcodeJob
      
      // GPU変換サーバーの状態に基づいてデータベースを更新
      if (gpuJobStatus.state === 'completed' && transcodeJob.status !== 'COMPLETED') {
        // GPU変換サーバーのパスからファイル名を抽出
        const outputFilePath = gpuJobStatus.completed?.outputFile || transcodeJob.outputFile;
        
        // ファイル名を正しく処理（拡張子を保持）
        let fileName = null;
        if (outputFilePath) {
          const pathParts = outputFilePath.split('/');
          fileName = pathParts.pop();
          
          // 一時ファイル名の場合は、元のファイル名を使用
          if (fileName && !fileName.includes('_converted.')) {
            const originalFileName = transcodeJob.video?.originalFilename || 'video.mp4';
            const extension = originalFileName.split('.').pop() || 'mp4';
            fileName = `${transcodeJob.video?.videoId || 'video'}_converted.${extension}`;
          }
        }
        
        // 変換後のファイルパスを生成（/Volumes/video/配下を直接参照）
        let webAccessiblePath = null;
        if (fileName) {
          // プリセット別ディレクトリ構造を無視して、/converted/配下に直接配置
          webAccessiblePath = `/videos/converted/${fileName}`;
        }
        
        updatedJob = await (prisma as any).transcodeJob.update({
          where: { jobId },
          data: {
            status: 'COMPLETED',
            progress: 100,
            completedAt: new Date()
          }
        })
        
        // 動画レコードも更新
        // 変換後のファイルがローカルにコピーされた場合は使用、そうでなければ元ファイルを使用
        const updateData: any = {
          status: 'COMPLETED',
          convertedFilePath: webAccessiblePath, // 変換後のファイルを使用
        }

        // 検索用メタデータを抽出して保存
        if (gpuJobStatus.completed?.outputMetadata?.video && gpuJobStatus.completed?.outputMetadata?.audio) {
          const metadata = gpuJobStatus.completed.outputMetadata;
          const video = metadata.video!;
          const audio = metadata.audio!;
          
          updateData.videoResolution = `${video.width}x${video.height}`;
          updateData.videoCodec = video.codec_name;
          updateData.videoBitrate = Math.round(video.bitrate / 1000); // kbps
          updateData.videoFrameRate = video.frame_rate;
          updateData.audioCodec = audio.codec_name;
          updateData.audioBitrate = Math.round(audio.bitrate / 1000); // kbps
          updateData.audioSampleRate = audio.sample_rate;
          updateData.audioChannels = audio.channels;
          
          // ファイルサイズと圧縮率
          if (gpuJobStatus.returnvalue?.inputSizeMB && gpuJobStatus.returnvalue?.outputSizeMB) {
            updateData.convertedFileSize = BigInt(Math.round(gpuJobStatus.returnvalue.outputSizeMB * 1024 * 1024));
            updateData.compressionRatio = parseFloat(gpuJobStatus.returnvalue.compressionRate);
          }
        }

        // GPU変換で生成されたサムネイルがある場合は更新
        if (gpuJobStatus.completed?.thumbnailPath && !transcodeJob.video.thumbnailUrl) {
          const thumbnailFileName = gpuJobStatus.completed.thumbnailPath.split('/').pop();
          if (thumbnailFileName) {
            // サムネイルパスを直接設定（/Volumes/video/配下を参照）
            updateData.thumbnailUrl = `/videos/thumbnails/${thumbnailFileName}`;
          }
        }

        // GPU変換サーバーから再生時間情報を取得して更新
        if (gpuJobStatus.completed?.outputMetadata?.duration) {
          const newDuration = Math.round(gpuJobStatus.completed.outputMetadata.duration);
          updateData.duration = newDuration;
        }

        await prisma.video.update({
          where: { id: transcodeJob.videoId },
          data: updateData
        })
        
        // 変換完了後のuploadsディレクトリの一時ファイルを削除
        if (transcodeJob.inputFile && transcodeJob.inputFile.includes('/uploads/')) {
          try {
            console.log('🗑️ uploadsディレクトリの一時ファイルを削除:', transcodeJob.inputFile);
            
            // GPU変換サーバーがoriginalディレクトリに移動したかチェック
            const originalFileName = path.basename(transcodeJob.outputFile || '', '.mp4');
            const originalFilePath = `/videos/original/${originalFileName}_original.mp4`;
            const actualOriginalPath = transcodeJob.inputFile.replace('/uploads/', '/original/').replace(path.basename(transcodeJob.inputFile), `${originalFileName}_original.mp4`);
            
            // ファイルパスを更新
            await prisma.video.update({
              where: { id: transcodeJob.videoId },
              data: {
                filePath: originalFilePath
              }
            });
            
            console.log('✅ ファイルパスを更新:', originalFilePath);
            
            // ローカルファイルシステムから削除
            await deleteFile(transcodeJob.inputFile);
            
            // GPU変換サーバーからも削除
            await gpuTranscoderClient.cleanupUploadsFile(transcodeJob.inputFile);
            
            console.log('✅ uploadsディレクトリの一時ファイル削除完了');
          } catch (deleteError) {
            console.error('❌ uploadsディレクトリの一時ファイル削除エラー:', deleteError);
          }
        }

      } else if (gpuJobStatus.state === 'failed' && transcodeJob.status !== 'FAILED') {
        // GPU変換サーバーから詳細なエラー情報を取得
        let errorMessage = '変換に失敗しました';
        let errorDetails = null;
        
        try {
          // GPU変換サーバーからエラー情報を取得
          if (gpuJobStatus.returnvalue && gpuJobStatus.returnvalue.status === 'failed') {
            // returnvalueからエラー情報を取得（型安全な方法）
            const returnValue = gpuJobStatus.returnvalue as any;
            errorMessage = returnValue.error || '変換処理中にエラーが発生しました';
            errorDetails = {
              returnCode: returnValue.returnCode,
              ffmpegOutput: returnValue.ffmpegOutput,
              error: returnValue.error
            };
          }
        } catch (logError) {
          console.error('❌ GPU変換サーバーエラー情報取得エラー:', logError);
          // フォールバック: gpuJobStatusからエラー情報を取得
          if (gpuJobStatus.returnvalue && gpuJobStatus.returnvalue.status === 'failed') {
            const returnValue = gpuJobStatus.returnvalue as any;
            errorMessage = returnValue.error || '変換処理中にエラーが発生しました';
            errorDetails = {
              returnCode: returnValue.returnCode,
              ffmpegOutput: returnValue.ffmpegOutput,
              error: returnValue.error
            };
          }
        }
        
        updatedJob = await (prisma as any).transcodeJob.update({
          where: { jobId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: errorMessage
          }
        })
        
        // 動画レコードも更新（元ファイルを使用）
        await prisma.video.update({
          where: { id: transcodeJob.videoId },
          data: {
            status: 'COMPLETED' // 元ファイルで配信
          }
        })
        
        // 変換失敗時もuploadsディレクトリの一時ファイルを削除
        if (transcodeJob.inputFile && transcodeJob.inputFile.includes('/uploads/')) {
          try {
            console.log('🗑️ 変換失敗時のuploadsディレクトリの一時ファイルを削除:', transcodeJob.inputFile);
            
            // GPU変換サーバーがoriginalディレクトリに移動したかチェック
            const originalFileName = path.basename(transcodeJob.inputFile, path.extname(transcodeJob.inputFile));
            const originalFilePath = `/videos/original/${originalFileName}_original.mp4`;
            
            // ファイルパスを更新
            await prisma.video.update({
              where: { id: transcodeJob.videoId },
              data: {
                filePath: originalFilePath
              }
            });
            
            console.log('✅ 変換失敗時のファイルパスを更新:', originalFilePath);
            
            // ローカルファイルシステムから削除
            await deleteFile(transcodeJob.inputFile);
            
            // GPU変換サーバーからも削除
            await gpuTranscoderClient.cleanupUploadsFile(transcodeJob.inputFile);
            
            console.log('✅ 変換失敗時のuploadsディレクトリの一時ファイル削除完了');
          } catch (deleteError) {
            console.error('❌ 変換失敗時のuploadsディレクトリの一時ファイル削除エラー:', deleteError);
          }
        }

      } else if (gpuJobStatus.state === 'active' || gpuJobStatus.state === 'waiting') {
        // 進捗更新（waiting状態でも進捗を更新）
        let progress = gpuJobStatus.progress || 0;
        
        // 軽量版の進捗情報を優先的に使用
        if (progressInfo && progressInfo.progress !== undefined) {
          progress = progressInfo.progress;
        }
        
        // GPU変換サーバーから進捗情報が取得できない場合のフォールバック
        if (progress === 0 && gpuJobStatus.state === 'active') {
          // active状態で進捗が0の場合は、推定進捗を計算
          const now = new Date();
          const startedAt = transcodeJob.startedAt || transcodeJob.createdAt;
          const elapsedMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);
          
          // 推定進捗（1分あたり10%として計算、最大90%まで）
          progress = Math.min(Math.floor(elapsedMinutes * 10), 90);
        }
        
        const updateData: any = {
          progress: progress
        };
        
        // 軽量版の進捗情報から推定残り時間を保存
        if (progressInfo?.estimatedTimeRemaining !== null && progressInfo?.estimatedTimeRemaining !== undefined) {
          updateData.estimatedTimeRemaining = progressInfo.estimatedTimeRemaining;
        }
        
        // waiting状態からactive状態に変わった場合の処理
        if (gpuJobStatus.state === 'active' && transcodeJob.status === 'PENDING') {
          updateData.status = 'PROCESSING';
          updateData.startedAt = new Date();
        }
        
        updatedJob = await (prisma as any).transcodeJob.update({
          where: { jobId },
          data: updateData
        });
      }

      // プリセットの詳細情報を取得
      let presetDetails = null;
      try {
        const presetsResponse = await gpuTranscoderClient.getPresets();
        const currentPreset = gpuJobStatus.data?.preset || transcodeJob.preset || 'web_720p';
        presetDetails = presetsResponse.details[currentPreset];
        
        console.log('🔍 プリセット詳細取得:', {
          currentPreset,
          availablePresets: Object.keys(presetsResponse.details),
          presetDetails: presetDetails
        });
      } catch (presetError) {
        console.error('❌ プリセット詳細取得エラー:', presetError);
        
        // フォールバック: 基本的なプリセット情報を生成
        const currentPreset = gpuJobStatus.data?.preset || transcodeJob.preset || 'web_720p';
        presetDetails = {
          description: `${currentPreset} プリセット`,
          videoCodec: 'av1_nvenc',
          audioCodec: 'aac',
          resolution: '1920x1080',
          bitrate: '5000 kbps',
          fps: 30
        };
        
        console.log('⚠️ プリセット詳細フォールバック:', presetDetails);
      }

      // GPU変換サーバーのレスポンスからメタデータを抽出（統一された形式）
      let videoMetadata = null;
      
      if (gpuJobStatus.completed?.outputMetadata?.video && gpuJobStatus.completed?.outputMetadata?.audio) {
        // より詳細なFFmpegメタデータを優先
        const metadata = gpuJobStatus.completed.outputMetadata;
        const video = metadata.video!;
        const audio = metadata.audio!;
        
        videoMetadata = {
          video: {
            resolution: `${video.width}x${video.height}`,
            bitrate: `${Math.round(video.bitrate / 1000)} kbps`,
            frameRate: `${video.frame_rate.toFixed(2)} fps`,
            codec: video.codec_name,
            pixelFormat: video.pixel_format || 'yuv420p',
            aspectRatio: video.aspect_ratio || `${video.width}:${video.height}`,
            colorSpace: video.color_space || 'bt709',
            profile: (video as any).profile || undefined,
            level: (video as any).level || undefined
          },
          audio: {
            codec: audio.codec_name,
            bitrate: `${Math.round(audio.bitrate / 1000)} kbps`,
            sampleRate: `${audio.sample_rate || 48000} Hz`,
            channels: audio.channels || 2,
            channelLayout: audio.channel_layout || 'stereo',
            sampleFormat: audio.sample_fmt || 'fltp',
            profile: (audio as any).profile || undefined
          }
        };
      } else if (gpuJobStatus.completed?.videoDetails && gpuJobStatus.completed?.audioDetails) {
        // フォールバック: 簡略化されたメタデータ
        videoMetadata = {
          video: {
            resolution: `${gpuJobStatus.completed.videoDetails.width}x${gpuJobStatus.completed.videoDetails.height}`,
            bitrate: `${Math.round(gpuJobStatus.completed.videoDetails.bitrate / 1000)} kbps`,
            frameRate: `${gpuJobStatus.completed.videoDetails.frameRate.toFixed(2)} fps`,
            codec: gpuJobStatus.completed.videoDetails.codec,
            pixelFormat: 'yuv420p', // デフォルト値
            aspectRatio: `${gpuJobStatus.completed.videoDetails.width}:${gpuJobStatus.completed.videoDetails.height}`,
            colorSpace: 'bt709', // デフォルト値
            profile: undefined, // フォールバックでは利用不可
            level: undefined // フォールバックでは利用不可
          },
          audio: {
            codec: gpuJobStatus.completed.audioDetails.codec,
            bitrate: `${Math.round(gpuJobStatus.completed.audioDetails.bitrate / 1000)} kbps`,
            sampleRate: `${gpuJobStatus.completed.audioDetails.sampleRate} Hz`,
            channels: gpuJobStatus.completed.audioDetails.channels,
            channelLayout: 'stereo', // デフォルト値
            sampleFormat: 'fltp', // デフォルト値
            profile: undefined // フォールバックでは利用不可
          }
        };
      }

      // レスポンス用にBigIntを文字列に変換
      const responseJob = {
        ...updatedJob,
        originalFileSize: updatedJob.originalFileSize?.toString(),
        convertedFileSize: updatedJob.convertedFileSize?.toString(),
        videoId: updatedJob.videoId.toString(),
        gpuJobStatus: gpuJobStatus,
        // GPU変換サーバーからの詳細情報を追加
        videoTitle: transcodeJob.video.title || 'タイトル不明',
        originalFileName: gpuJobStatus.data?.originalName || 'ファイル名不明',
        convertedFileName: gpuJobStatus.completed?.outputFile ? path.basename(gpuJobStatus.completed.outputFile) : '変換後ファイル名不明',
        inputSizeMB: gpuJobStatus.returnvalue?.inputSizeMB || gpuJobStatus.completed?.inputSizeMB || 0,
        outputSizeMB: gpuJobStatus.returnvalue?.outputSizeMB || 
                     (gpuJobStatus.completed?.outputSize ? gpuJobStatus.completed.outputSize / (1024 * 1024) : 0),
        compressionRate: (gpuJobStatus.returnvalue?.compressionRate ? parseFloat(gpuJobStatus.returnvalue.compressionRate) : 0) || 
                       gpuJobStatus.completed?.compressionRate || 0,
        processingTime: gpuJobStatus.returnvalue?.processingTime || gpuJobStatus.completed?.processingTime || 0,
        preset: gpuJobStatus.data?.preset || '不明',
        presetDetails: presetDetails,
        // audioCodec: gpuJobStatus.returnvalue?.audioCodec || '不明',
        videoMetadata: videoMetadata,
        duration: gpuJobStatus.completed?.outputMetadata?.duration || 
                 gpuJobStatus.returnvalue?.outputMetadata?.duration || 
                 transcodeJob.video.duration || 0
      }



      return NextResponse.json({
        success: true,
        data: responseJob
      })

    } catch (gpuError) {
      // GPU server communication error
      console.error('❌ GPU変換サーバー通信エラー:', gpuError);
      console.error('GPUエラー詳細:', {
        message: gpuError instanceof Error ? gpuError.message : 'Unknown error',
        stack: gpuError instanceof Error ? gpuError.stack : 'No stack trace',
        name: gpuError instanceof Error ? gpuError.name : 'Unknown'
      });
      
      // GPU変換サーバーでジョブが見つからない場合の詳細ログ
      if (gpuError instanceof Error && gpuError.message.includes('404')) {
        console.log('🔍 ジョブが見つからない理由を調査:', {
          jobId,
          transcodeJobStatus: transcodeJob.status,
          transcodeJobCreatedAt: transcodeJob.createdAt,
          videoId: transcodeJob.videoId
        });
      }
      
      // GPU変換サーバーとの通信に失敗した場合、データベースの情報のみ返す
      const responseJob = {
        ...transcodeJob,
        originalFileSize: transcodeJob.originalFileSize?.toString(),
        convertedFileSize: transcodeJob.convertedFileSize?.toString(),
        videoId: transcodeJob.videoId.toString(),
        gpuJobStatus: null,
        error: 'GPU変換サーバーとの通信に失敗しました',
        errorDetails: {
          message: gpuError instanceof Error ? gpuError.message : 'Unknown error',
          status: gpuError instanceof Error && 'response' in gpuError ? (gpuError as any).response?.status : 'Unknown',
          isJobNotFound: gpuError instanceof Error && gpuError.message.includes('404')
        }
      }



      return NextResponse.json({
        success: true,
        data: responseJob
      })
    }

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'ジョブ状態の取得に失敗しました' 
      },
      { status: 500 }
    )
  }
} 

// 変換完了後のサムネイル生成
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { jobId } = resolvedParams;
    const body = await request.json();
    const { videoId, originalFilePath } = body;

    if (!videoId || !originalFilePath) {
      return NextResponse.json({ 
        error: 'videoId と originalFilePath が必要です' 
      }, { status: 400 });
    }

    // 動画の存在確認
    const video = await prisma.video.findUnique({
      where: { videoId }
    });

    if (!video) {
      return NextResponse.json({ 
        error: '動画が見つかりません' 
      }, { status: 404 });
    }

    // GPUサーバーでサムネイル生成
    const thumbnailResult = await gpuTranscoderClient.generateThumbnailAfterTranscode(
      videoId,
      originalFilePath,
      {
        timestamp: 5,
        size: '1280x720',
        format: 'webp',
        quality: 85
      }
    );

    if (thumbnailResult.success) {
      // 動画のサムネイルURLを更新
      await prisma.video.update({
        where: { videoId },
        data: { thumbnailUrl: thumbnailResult.thumbnailUrl }
      });

      return NextResponse.json({
        success: true,
        thumbnailUrl: thumbnailResult.thumbnailUrl,
        thumbnailSizeMB: thumbnailResult.thumbnailSizeMB,
        message: 'サムネイルが正常に生成されました'
      });
    } else {
      return NextResponse.json({ 
        error: 'サムネイル生成に失敗しました' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return NextResponse.json({ 
      error: 'サムネイル生成中にエラーが発生しました' 
    }, { status: 500 });
  }
} 