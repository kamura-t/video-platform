import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Visibility } from '@prisma/client';
import { storageService } from '@/lib/storage-service';
import { validationService } from '@/lib/validation-service';
import { gpuTranscoderClient } from '@/lib/gpu-transcoder';
import { authenticateApiRequest } from '@/lib/auth';
import { correctMimeType, extractYouTubeVideoId } from '@/lib/upload-utils';
import { configService } from '@/lib/config-service';
import fs from 'fs';

// 共通バリデーション関数
async function validateUploadData(data: any): Promise<{ isValid: boolean; error?: string }> {
  if (!data.title?.trim() || !data.description?.trim() || !data.category?.trim()) {
    return { isValid: false, error: 'タイトル、説明、カテゴリは必須です' };
  }

  // 予約投稿のバリデーション
  if (data.scheduleType === 'scheduled') {
    if (!data.scheduledPublishAt) {
      return { isValid: false, error: '予約投稿時刻が必要です' };
    }
    
    const scheduledTime = new Date(data.scheduledPublishAt);
    const now = new Date();
    
    if (scheduledTime <= now) {
      return { isValid: false, error: '予約投稿時刻は現在時刻より後である必要があります' };
    }
    
    // 予約投稿時は公開設定をDRAFTに設定
    if (data.visibility !== 'DRAFT') {
      data.visibility = 'DRAFT';
    }
  }

  // 予約非公開のバリデーション
  if (data.scheduledUnpublishAt) {
    const unpublishTime = new Date(data.scheduledUnpublishAt);
    const now = new Date();
    
    if (unpublishTime <= now) {
      return { isValid: false, error: '予約非公開時刻は現在時刻より後である必要があります' };
    }
    
    // 予約投稿と予約非公開の両方が設定されている場合、投稿時刻より非公開時刻が後である必要がある
    if (data.scheduledPublishAt) {
      const publishTime = new Date(data.scheduledPublishAt);
      if (unpublishTime <= publishTime) {
        return { isValid: false, error: '予約非公開時刻は予約投稿時刻より後である必要があります' };
      }
    }
  }
  
  return { isValid: true };
}

// カテゴリ検証関数
async function validateCategory(categorySlug: string): Promise<{ isValid: boolean; category?: any; error?: string }> {
  try {
    const category = await prisma.category.findFirst({
      where: { slug: categorySlug }
    });

    if (!category) {
      return { isValid: false, error: `カテゴリ「${categorySlug}」が見つかりません。有効なカテゴリを選択してください。` };
    }

    return { isValid: true, category };
  } catch (error) {
    console.error('Category validation error:', error);
    return { isValid: false, error: 'カテゴリの処理に失敗しました' };
  }
}

// 動画ID生成関数
function generateVideoId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return Array.from({length: 11}, () => 
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// YouTubeメタデータ取得関数
async function fetchYouTubeMetadata(youtubeUrl: string, requestOrigin: string): Promise<{ metadata: any; duration: number; videoId: string }> {
  const videoId = extractYouTubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('有効なYouTube URLを入力してください');
  }

  try {
    const metadataResponse = await fetch(`${requestOrigin}/api/youtube/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtubeUrl })
    });
    
    if (metadataResponse.ok) {
      const metadataResult = await metadataResponse.json();
      if (metadataResult.success && metadataResult.data) {
        return {
          metadata: metadataResult.data,
          duration: metadataResult.data.duration || 0,
          videoId
        };
      }
    }
  } catch (error) {
    console.error('YouTube metadata fetch error:', error);
  }

  return { metadata: null, duration: 0, videoId };
}

// ファイルアップロード処理関数
async function handleFileUpload(file: File, userId: string): Promise<any> {
  // MIMEタイプ補正
  const correctedFile = correctMimeType(file);
  
  console.log('🔍 ファイルバリデーション開始:', {
    fileName: file.name,
    fileSize: file.size,
    originalMimeType: file.type,
    correctedMimeType: correctedFile.type,
    lastModified: file.lastModified
  });
  
  // ファイルバリデーション
  const validation = await validationService.validateVideoFile(correctedFile);
  console.log('🔍 バリデーション結果:', validation);
  
  if (!validation.isValid) {
    throw new Error(validation.error || 'ファイルが無効です');
  }

  // ファイル保存
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const savedFile = await storageService.saveFile(fileBuffer, file.name, 'uploads');

  return {
    originalName: file.name,
    fileName: savedFile.fileName,
    filePath: savedFile.filePath,
    absolutePath: savedFile.absolutePath,
    size: file.size,
    mimeType: correctedFile.type,
  };
}

// 動画レコード作成関数
async function createVideoRecord(data: {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  duration: number;
  uploadMethod: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  uploadedFile?: any;
  visibility: string;
  userId: string;
  scheduleType?: string;
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
}): Promise<any> {
  const { 
    videoId, title, description, thumbnailUrl, duration, 
    uploadMethod, youtubeUrl, youtubeVideoId, uploadedFile, 
    visibility, userId, scheduleType, scheduledPublishAt, scheduledUnpublishAt 
  } = data;

  console.log('💾 動画レコード作成:', {
    videoId,
    title,
    thumbnailUrl,
    duration,
    uploadType: uploadMethod === 'youtube' ? 'YOUTUBE' : 'FILE'
  });

  return await prisma.video.create({
    data: {
      videoId: videoId,
      title: title,
      description: description,
      thumbnailUrl: thumbnailUrl,
      duration: duration,
      viewCount: 0,
      uploadType: uploadMethod === 'youtube' ? 'YOUTUBE' : 'FILE',
      youtubeUrl: uploadMethod === 'youtube' ? youtubeUrl : null,
      youtubeVideoId: uploadMethod === 'youtube' ? youtubeVideoId : null,
      filePath: uploadMethod === 'file' ? uploadedFile?.filePath : null,
      originalFilename: uploadMethod === 'file' ? uploadedFile?.originalName : null,
      fileSize: uploadMethod === 'file' ? BigInt(uploadedFile?.size || 0) : null,
      mimeType: uploadMethod === 'file' ? uploadedFile?.mimeType : null,
      uploaderId: parseInt(userId),
      visibility: visibility as Visibility,
      status: 'COMPLETED',
      isScheduled: scheduleType === 'scheduled',
      scheduledPublishAt: scheduleType === 'scheduled' && scheduledPublishAt ? new Date(scheduledPublishAt) : null,
      scheduledUnpublishAt: scheduledUnpublishAt ? new Date(scheduledUnpublishAt) : null,
      publishedAt: scheduleType === 'immediate' && visibility === 'PUBLIC' ? new Date() : null
    }
  });
}

// 投稿レコード作成関数
async function createPostRecord(video: any, data: { 
  title: string; 
  description: string; 
  visibility: string; 
  userId: string;
  scheduleType?: string;
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
}): Promise<any> {
  return await prisma.post.create({
    data: {
      postId: video.videoId,
      title: data.title,
      description: data.description,
      postType: 'VIDEO',
      videoId: video.id,
      visibility: data.visibility as Visibility,
      creatorId: parseInt(data.userId),
      isScheduled: data.scheduleType === 'scheduled',
      scheduledPublishAt: data.scheduleType === 'scheduled' && data.scheduledPublishAt ? new Date(data.scheduledPublishAt) : null,
      scheduledUnpublishAt: data.scheduledUnpublishAt ? new Date(data.scheduledUnpublishAt) : null,
      publishedAt: data.scheduleType === 'immediate' && data.visibility === 'PUBLIC' ? new Date() : null
    }
  });
}

// カテゴリ関連付け関数
async function linkCategory(videoId: number, categoryId: number): Promise<void> {
  try {
    await prisma.videoCategory.create({
      data: {
        videoId: videoId,
        categoryId: categoryId
      }
    });
  } catch (error) {
    console.error('Category linking error:', error);
    // カテゴリ関連付けのエラーは致命的ではないので処理を続行
  }
}

// タグ処理関数
async function processTags(videoId: number, tags: string[]): Promise<void> {
  if (!tags || tags.length === 0) return;

  try {
    for (const tagName of tags) {
      let tag = await prisma.tag.findFirst({
        where: { name: tagName }
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: {
            name: tagName
          }
        });
      }

      await prisma.videoTag.create({
        data: {
          videoId: videoId,
          tagId: tag.id
        }
      });
    }
  } catch (error) {
    console.error('Tag processing error:', error);
    // タグ処理のエラーは致命的ではないので処理を続行
  }
}

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR']);
    if (authResult.error) {
      return authResult.error;
    }

    const payload = { userId: authResult.user!.userId };
    console.log('Upload request from user:', payload.userId);

    let uploadData: any = {};
    let uploadedFile: any = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // ファイルアップロード処理
      try {
        const formData = await request.formData();
        
        uploadData = {
          title: formData.get('title') as string,
          description: formData.get('description') as string,
          category: formData.get('category') as string,
          tags: JSON.parse(formData.get('tags') as string || '[]'),
          visibility: formData.get('visibility') as string,
          uploadMethod: formData.get('uploadMethod') as string,
          preset: formData.get('preset') as string || 'auto',
          scheduleType: formData.get('scheduleType') as string || 'immediate',
          scheduledPublishAt: formData.get('scheduledPublishAt') as string,
          scheduledUnpublishAt: formData.get('scheduledUnpublishAt') as string,
        };

        const file = formData.get('file') as File;

        console.log('File upload data:', { 
          title: uploadData.title, 
          category: uploadData.category, 
          visibility: uploadData.visibility, 
          uploadMethod: uploadData.uploadMethod, 
          fileSize: file?.size,
          tagsCount: uploadData.tags.length 
        });

        // 基本バリデーション
        const validation = await validateUploadData(uploadData);
        if (!validation.isValid) {
          return NextResponse.json(
            { success: false, error: validation.error },
            { status: 400 }
          );
        }

        if (!file) {
          return NextResponse.json(
            { success: false, error: '動画ファイルが必要です' },
            { status: 400 }
          );
        }

        // ファイルアップロード処理
        uploadedFile = await handleFileUpload(file, payload.userId);

      } catch (error) {
        console.error('FormData parsing error:', error);
        return NextResponse.json(
          { success: false, error: 'ファイルアップロードの処理に失敗しました' },
          { status: 400 }
        );
      }

    } else {
      // YouTube URL処理
      try {
        const body = await request.json();
        uploadData = body;

        const validation = await validateUploadData(uploadData);
        if (!validation.isValid) {
          return NextResponse.json(
            { success: false, error: validation.error },
            { status: 400 }
          );
        }

        if (!uploadData.youtubeUrl) {
          return NextResponse.json(
            { success: false, error: 'YouTube URLが必要です' },
            { status: 400 }
          );
        }

      } catch (error) {
        console.error('JSON parsing error:', error);
        return NextResponse.json(
          { success: false, error: 'リクエストデータの解析に失敗しました' },
          { status: 400 }
        );
      }
    }

    const { title, description, category, tags, visibility, youtubeUrl, uploadMethod, preset, scheduleType, scheduledPublishAt, scheduledUnpublishAt } = uploadData;

    // 公開設定の正規化
    const validVisibility = ['PUBLIC', 'PRIVATE', 'DRAFT'];
    const normalizedVisibility = visibility?.toUpperCase() || 'DRAFT';
    
    if (!validVisibility.includes(normalizedVisibility)) {
      return NextResponse.json(
        { success: false, error: `無効な公開設定です。有効な値: ${validVisibility.join(', ')}` },
        { status: 400 }
      );
    }

    // カテゴリの検証
    const categoryValidation = await validateCategory(category);
    if (!categoryValidation.isValid) {
      return NextResponse.json(
        { success: false, error: categoryValidation.error },
        { status: 400 }
      );
    }

    // 動画IDの生成
    const videoId = generateVideoId();

    // YouTubeメタデータの取得
    let youtubeMetadata: any = null;
    let youtubeDuration = 0;
    let youtubeVideoId = '';
    
    if (uploadMethod === 'youtube' && youtubeUrl) {
      try {
        const youtubeData = await fetchYouTubeMetadata(youtubeUrl, request.nextUrl.origin);
        youtubeMetadata = youtubeData.metadata;
        youtubeDuration = youtubeData.duration;
        youtubeVideoId = youtubeData.videoId;
      } catch (error) {
        return NextResponse.json(
          { success: false, error: error instanceof Error ? error.message : 'YouTube URLの処理に失敗しました' },
          { status: 400 }
        );
      }
    }

    // 動画レコードの作成
    let video;
    try {
      let finalThumbnail = null;
      let finalDuration = 0;

      if (uploadMethod === 'youtube') {
        // YouTubeの場合
        finalThumbnail = youtubeMetadata?.thumbnail || `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`;
        finalDuration = youtubeDuration;
      } else if (uploadMethod === 'file' && uploadedFile) {
        // ファイルアップロードの場合、サムネイル生成と再生時間取得を処理
        console.log('🔍 ファイルアップロード処理開始:', {
          videoId,
          filePath: uploadedFile.absolutePath,
          fileSize: uploadedFile.size
        });

        // GPU変換サーバーの可用性チェック
        const isGpuServerAvailable = await gpuTranscoderClient.isServerAvailable();
        console.log('🔍 GPUサーバー可用性:', isGpuServerAvailable);

        if (isGpuServerAvailable) {
          // GPU変換処理でサムネイル生成とメタデータ取得を行うため、ここではスキップ
          console.log('ℹ️ GPU変換処理でサムネイル生成とメタデータ取得を行います');
        } else {
          console.log('⚠️ GPUサーバーが利用できません。サムネイル生成と再生時間取得をスキップします。');
        }
      }

      const finalTitle = (uploadMethod === 'youtube' && youtubeMetadata?.title) ? youtubeMetadata.title : title;
      const finalDescription = (uploadMethod === 'youtube' && youtubeMetadata?.description) ? youtubeMetadata.description : description;
      
      // 動画の品質情報はGPU変換処理で取得されるため、ここではスキップ
      
      video = await createVideoRecord({
        videoId,
        title: finalTitle,
        description: finalDescription,
        thumbnailUrl: finalThumbnail,
        duration: finalDuration,
        uploadMethod,
        youtubeUrl,
        youtubeVideoId,
        uploadedFile,
        visibility: normalizedVisibility,
        userId: payload.userId,
        scheduleType,
        scheduledPublishAt,
        scheduledUnpublishAt
      });

      console.log('✅ 動画レコード作成完了:', { 
        videoId: video.videoId, 
        status: 'COMPLETED',
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration
      });

    } catch (videoError) {
      console.error('Video creation error:', videoError);
      return NextResponse.json(
        { success: false, error: '動画レコードの作成に失敗しました' },
        { status: 500 }
      );
    }

    // 投稿レコードの作成
    let post;
    try {
      post = await createPostRecord(video, {
        title: video.title,
        description: video.description,
        visibility: normalizedVisibility,
        userId: payload.userId,
        scheduleType,
        scheduledPublishAt,
        scheduledUnpublishAt
      });
    } catch (postError) {
      console.error('Post creation error:', postError);
      return NextResponse.json(
        { success: false, error: '投稿レコードの作成に失敗しました' },
        { status: 500 }
      );
    }

    // カテゴリの関連付け
    await linkCategory(video.id, categoryValidation.category!.id);

    // タグの処理
    await processTags(video.id, tags);

    // GPU変換処理（ファイルアップロードの場合のみ）
    if (uploadMethod === 'file' && uploadedFile) {
      console.log('🔍 GPU変換処理チェック開始:', {
        uploadMethod,
        hasUploadedFile: !!uploadedFile,
        filePath: uploadedFile.absolutePath,
        fileSize: uploadedFile.size
      });
      
      const isGpuServerAvailable = await gpuTranscoderClient.isServerAvailable();
      console.log('🔍 GPUサーバー可用性:', isGpuServerAvailable);
      
      if (isGpuServerAvailable) {
        try {
          console.log('🚀 GPU変換処理開始:', {
            videoId,
            inputFile: uploadedFile.absolutePath,
            fileSize: uploadedFile.size,
            originalName: uploadedFile.originalName
          });

          // 出力ファイルパスの生成（GPUサーバーはuploadsに配置後、変換処理を行う）
          const outputFileName = `${videoId}_converted.mp4`;
          const gpuMountPath = process.env.GPU_NAS_VIDEOS_PATH || '/mnt/nas/videos';
          const outputPath = `${gpuMountPath}/converted/${outputFileName}`;
          
          // ファイルバッファ読み込み
          console.log('📦 ファイルバッファ読み込み開始:', uploadedFile.absolutePath);
          const fileBuffer = fs.readFileSync(uploadedFile.absolutePath);
          console.log('📦 ファイルバッファ読み込み完了:', fileBuffer.length, 'bytes');
          
          // システム設定からサムネイル設定を取得
          const thumbnailConfig = await configService?.getThumbnailConfig();
          console.log('🖼️ サムネイル設定:', thumbnailConfig);

          console.log('🚀 GPU変換サーバーにリクエスト送信:', {
            preset: preset,
            outputPath,
            metadata: {
              title: video.title,
              videoId: videoId,
              originalFilename: uploadedFile.originalName,
              generateThumbnail: true, // サムネイル生成を有効化
              thumbnailTimestamp: 15, // 動画開始から15秒後（より安定したシーン）
              thumbnailFormat: thumbnailConfig?.format || 'jpg',
              thumbnailQuality: thumbnailConfig?.quality || 95
            }
          });
          

          
          console.log('🚀 GPU変換サーバーにリクエスト送信開始:', {
            fileSize: fileBuffer.length,
            preset: preset,
            outputPath: outputPath,
            originalFilename: uploadedFile.originalName,
            mimeType: uploadedFile.mimeType,
            thumbnailFormat: thumbnailConfig?.format || 'jpg',
            thumbnailQuality: thumbnailConfig?.quality || 95
          });
          
          const transcodeResult = await gpuTranscoderClient.uploadAndTranscode(
            fileBuffer,
            preset, // ユーザーが選択したプリセット
            outputPath,
            {
              title: video.title,
              videoId: videoId,
              originalFilename: uploadedFile.originalName,
              generateThumbnail: true, // サムネイル生成を有効化
              thumbnailTimestamp: 15, // 動画開始から15秒後（より安定したシーン）
              thumbnailFormat: thumbnailConfig?.format || 'jpg',
              thumbnailQuality: thumbnailConfig?.quality || 95
            }
          );
          
          console.log('✅ GPU変換サーバーからのレスポンス:', transcodeResult);

          console.log('✅ GPU変換ジョブ開始成功:', {
            jobId: transcodeResult.jobId,
            preset: transcodeResult.preset,
            outputFile: transcodeResult.outputFile
          });

          // TranscodeJobレコードを作成
          await prisma.transcodeJob.create({
            data: {
              jobId: transcodeResult.jobId,
              videoId: video.id,
              inputFile: uploadedFile.absolutePath,
              outputFile: outputPath,
              preset: preset,
              status: 'PROCESSING',
              progress: 0,
              createdAt: new Date()
            }
          });

          console.log('💾 TranscodeJobレコード作成完了');
        } catch (transcodeError: any) {
          console.error('❌ GPU変換処理エラー:', transcodeError);
          console.error('❌ GPU変換エラー詳細:', {
            name: transcodeError?.name,
            message: transcodeError?.message,
            statusCode: transcodeError?.statusCode,
            originalError: transcodeError?.originalError,
            stack: transcodeError?.stack
          });
          
          // GPU変換サーバーからのエラーレスポンスを確認
          if (transcodeError?.originalError?.response) {
            console.error('❌ GPU変換サーバーエラーレスポンス:', {
              status: transcodeError.originalError.response.status,
              statusText: transcodeError.originalError.response.statusText,
              data: transcodeError.originalError.response.data,
              headers: transcodeError.originalError.response.headers
            });
          }
          
          // 変換失敗時もTranscodeJobレコードを作成（FAILED状態）
          try {
            await prisma.transcodeJob.create({
              data: {
                jobId: `failed_${videoId}_${Date.now()}`,
                videoId: video.id,
                inputFile: uploadedFile.absolutePath,
                outputFile: null,
                preset: 'N/A',
                status: 'FAILED',
                progress: 0,
                errorMessage: `GPU変換処理に失敗しました: ${transcodeError.message}`,
                createdAt: new Date()
              }
            });
            
            console.log('💾 TranscodeJobレコード作成完了（FAILED状態）');
          } catch (jobCreateError) {
            console.error('❌ TranscodeJobレコード作成エラー:', jobCreateError);
          }
        }
      } else {
        console.log('⚠️ GPUサーバーが利用できません。変換をスキップします。');
        
        // GPUサーバーが利用できない場合でも、変換ジョブレコードを作成（FAILED状態）
        try {
          await prisma.transcodeJob.create({
            data: {
              jobId: `unavailable_${videoId}_${Date.now()}`,
              videoId: video.id,
              inputFile: uploadedFile.absolutePath,
              outputFile: null,
              preset: 'N/A',
              status: 'FAILED',
              progress: 0,
              errorMessage: 'GPU変換サーバーが利用できません',
              createdAt: new Date()
            }
          });
          
          console.log('💾 TranscodeJobレコード作成完了（FAILED状態）');
        } catch (jobCreateError) {
          console.error('❌ TranscodeJobレコード作成エラー:', jobCreateError);
        }
      }
    } else {
      console.log('ℹ️ GPU変換をスキップ:', {
        uploadMethod: uploadMethod,
        hasUploadedFile: !!uploadedFile
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        videoId: video.videoId,
        video: {
          id: video.id,
          videoId: video.videoId,
          title: video.title,
          status: video.status
        }
      }
    });

  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'アップロード処理中にエラーが発生しました' 
      },
      { status: 500 }
    );
  }
}