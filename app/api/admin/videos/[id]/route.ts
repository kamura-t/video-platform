import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFile, logFileDeletion } from '@/lib/file-utils';
import { processThumbnail, generateImageFileName, validateImageFile, deleteImageFile, calculateCompressionRatio } from '@/lib/image-utils';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 });
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // 管理者・キュレーター権限チェック
    if (!['ADMIN', 'CURATOR'].includes(user.role)) {
      return NextResponse.json({ error: '管理者またはキュレーター権限が必要です' }, { status: 403 });
    }

    const resolvedParams = await params;
    const videoId = resolvedParams.id;

    // 動画の存在確認（数値IDと文字列videoIdの両方をサポート）
    let video = null;
    const numericId = parseInt(videoId);
    if (!isNaN(numericId)) {
      video = await prisma.video.findUnique({
        where: { id: numericId },
        include: {
          posts: true,
          categories: true,
          tags: true,
          playlistVideos: true
        }
      });
    }
    
    if (!video) {
      video = await prisma.video.findUnique({
        where: { videoId: videoId.toString() },
        include: {
          posts: true,
          categories: true,
          tags: true,
          playlistVideos: true
        }
      });
    }

    if (!video) {
      return NextResponse.json({ error: '動画が見つかりません' }, { status: 404 });
    }

    // 投稿者権限チェック：CURATORは自分の動画のみ削除可能
    if (user.role === 'CURATOR' && video.uploaderId !== user.id) {
      return NextResponse.json({ error: '自分がアップロードした動画のみ削除できます' }, { status: 403 });
    }

    const deletedFiles: string[] = [];

    // ファイルアップロード方式の場合、ファイルを削除
    if (video.uploadType === 'FILE') {
      try {
        // サムネイルファイルを削除（ローカルファイルの場合）
        if (video.thumbnailUrl && !video.thumbnailUrl.startsWith('http')) {
          console.log(`サムネイルファイルを削除: ${video.thumbnailUrl}`);
          const deletedThumbnailFile = await deleteFile(video.thumbnailUrl);
          if (deletedThumbnailFile) {
            deletedFiles.push(deletedThumbnailFile);
          }
        }

        // 変換済みファイルを削除
        if (video.convertedFilePath) {
          console.log(`変換済みファイルを削除: ${video.convertedFilePath}`);
          const deletedConvertedFile = await deleteFile(video.convertedFilePath);
          if (deletedConvertedFile) {
            deletedFiles.push(deletedConvertedFile);
          }
        }
      } catch (fileError) {
        console.error('ファイル削除エラー:', fileError);
        // ファイル削除に失敗してもデータベースの削除は継続
      }
    }

    // トランザクションで関連データを削除
    await prisma.$transaction(async (tx: any) => {
      // 視聴ログを削除（video.idを使用）
      await tx.viewLog.deleteMany({
        where: {
          videoId: video.id
        }
      });

      // プレイリストから動画を削除（video.idを使用）
      await tx.playlistVideo.deleteMany({
        where: { videoId: video.id }
      });

      // 動画カテゴリを削除（video.idを使用）
      await tx.videoCategory.deleteMany({
        where: { videoId: video.id }
      });

      // 動画タグを削除（video.idを使用）
      await tx.videoTag.deleteMany({
        where: { videoId: video.id }
      });

      // 投稿を削除（video.idを使用）
      await tx.post.deleteMany({
        where: { videoId: video.id }
      });

      // 動画を削除（idを使用）
      await tx.video.delete({
        where: { id: video.id }
      });
    });

    // 削除ログを記録（ファイルアップロード方式の場合）
    if (video.uploadType === 'FILE') {
      try {
        await logFileDeletion(video, deletedFiles, user.id);
      } catch (logError) {
        console.error('ログ記録エラー:', logError);
        // ログ記録の失敗は処理を停止しない
      }
    }

    return NextResponse.json({ 
      message: '動画を削除しました',
      deletedVideoId: video.videoId,
      deletedFiles: deletedFiles
    });

  } catch (error) {
    console.error('動画削除エラー:', error);
    return NextResponse.json(
      { error: '動画の削除に失敗しました' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const videoId = resolvedParams.id;
    
    console.log('GET /api/admin/videos/[id] - Video ID requested:', videoId);

    // 認証チェック
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      console.log('No auth token found');
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 });
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // 管理者・キュレーター権限チェック
    if (!['ADMIN', 'CURATOR'].includes(user.role)) {
      return NextResponse.json({ error: '管理者またはキュレーター権限が必要です' }, { status: 403 });
    }

    // 動画詳細取得
    console.log('Searching for video with videoId:', videoId, 'type:', typeof videoId);
    
    // videoIdが数値の場合は、まずidフィールドで検索し、見つからない場合はvideoIdで検索
    let video = null;
    
    // URLパラメータが数値の場合、まずidフィールド（数値）で検索
    const numericId = parseInt(videoId);
    if (!isNaN(numericId)) {
      console.log('Trying to find video by numeric id:', numericId);
      video = await prisma.video.findUnique({
        where: { id: numericId },
        include: {
          uploader: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true
            }
          },
          categories: {
            include: {
              category: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          posts: {
            select: {
              postId: true,
              title: true,
              visibility: true,
              scheduledPublishAt: true,
              scheduledUnpublishAt: true,
              createdAt: true,
              updatedAt: true
            }
          },
          transcodeJobs: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1,
            select: {
              jobId: true,
              status: true,
              completedAt: true
            }
          }
        }
      });
    }
    
    // 数値検索で見つからなかった場合、またはvideoIdが文字列の場合はvideoIdで検索
    if (!video) {
      console.log('Trying to find video by videoId string:', videoId);
      video = await prisma.video.findUnique({
        where: { videoId: videoId.toString() },
        include: {
          uploader: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true
            }
          },
          categories: {
            include: {
              category: true
            }
          },
          tags: {
            include: {
              tag: true
            }
          },
          posts: {
            select: {
              postId: true,
              title: true,
              visibility: true,
              scheduledPublishAt: true,
              scheduledUnpublishAt: true,
              createdAt: true,
              updatedAt: true
            }
          },
          transcodeJobs: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1,
            select: {
              jobId: true,
              status: true,
              completedAt: true
            }
          }
        }
      });
    }

    if (!video) {
      console.log('Video not found with videoId:', videoId);
      
      // デバッグ用：どんな動画が存在するかを確認
      const allVideos = await prisma.video.findMany({
        select: { videoId: true, title: true },
        take: 10
      });
      console.log('Available videos in database:', allVideos.map(v => ({ videoId: v.videoId, title: v.title })));
      
      return NextResponse.json({ 
        error: '動画が見つかりません',
        debug: {
          searchedVideoId: videoId,
          availableVideos: allVideos.map(v => v.videoId)
        }
      }, { status: 404 });
    }

    // 投稿者権限チェック：CURATORは自分の動画のみ取得可能
    if (user.role === 'CURATOR' && video.uploaderId !== user.id) {
      return NextResponse.json({ error: '自分がアップロードした動画のみアクセスできます' }, { status: 403 });
    }

    // BigIntとDecimalをシリアライズ可能な形式に変換
    const videoResponse = {
      ...video,
      id: video.id.toString(),
      fileSize: video.fileSize ? video.fileSize.toString() : null,
      convertedFileSize: (video as any).convertedFileSize ? (video as any).convertedFileSize.toString() : null,
      videoFrameRate: (video as any).videoFrameRate ? (video as any).videoFrameRate.toString() : null,
      compressionRatio: (video as any).compressionRatio ? (video as any).compressionRatio.toString() : null,
      uploaderId: video.uploaderId.toString(),
      transcodeJobId: video.transcodeJobs?.[0]?.jobId || null,
      uploader: {
        ...video.uploader,
        id: video.uploader.id.toString()
      },
      categories: video.categories.map((vc: any) => ({
        ...vc,
        id: vc.id.toString(),
        videoId: vc.videoId.toString(),
        categoryId: vc.categoryId.toString(),
        category: {
          ...vc.category,
          id: vc.category.id.toString()
        }
      })),
      tags: video.tags.map((vt: any) => ({
        ...vt,
        id: vt.id.toString(),
        videoId: vt.videoId.toString(),
        tagId: vt.tagId.toString(),
        tag: {
          ...vt.tag,
          id: vt.tag.id.toString()
        }
      })),
      posts: video.posts.map((post: any) => ({
        ...post,
        videoId: post.videoId ? post.videoId.toString() : null
      }))
    };

    return NextResponse.json({ video: videoResponse });

  } catch (error) {
    console.error('動画取得エラー:', error);
    return NextResponse.json(
      { error: '動画の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 });
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // 管理者・キュレーター権限チェック
    if (!['ADMIN', 'CURATOR'].includes(user.role)) {
      return NextResponse.json({ error: '管理者またはキュレーター権限が必要です' }, { status: 403 });
    }

    const resolvedParams = await params;
    const videoId = resolvedParams.id;
    
    // Content-Typeをチェックしてデータを解析
    const contentType = request.headers.get('content-type') || '';
    let title: string, description: string, youtubeUrl: string, categories: any, tags: any;
    let thumbnailFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      // FormDataの場合
      const formData = await request.formData();
      title = formData.get('title') as string;
      description = formData.get('description') as string;
      youtubeUrl = formData.get('youtubeUrl') as string;
      categories = formData.get('categories') ? JSON.parse(formData.get('categories') as string) : [];
      tags = formData.get('tags') ? JSON.parse(formData.get('tags') as string) : [];
      thumbnailFile = formData.get('thumbnail') as File;
    } else {
      // JSONの場合
      const body = await request.json();
      ({ title, description, youtubeUrl, categories, tags } = body);
    }

    // 動画の存在確認（数値IDと文字列videoIdの両方をサポート）
    let video = null;
    const numericId = parseInt(videoId);
    if (!isNaN(numericId)) {
      video = await prisma.video.findUnique({
        where: { id: numericId },
        include: {
          categories: true,
          tags: true
        }
      });
    }
    
    if (!video) {
      video = await prisma.video.findUnique({
        where: { videoId: videoId.toString() },
        include: {
          categories: true,
          tags: true
        }
      });
    }

    if (!video) {
      return NextResponse.json({ error: '動画が見つかりません' }, { status: 404 });
    }

    // 投稿者権限チェック：CURATORは自分の動画のみ編集可能
    if (user.role === 'CURATOR' && video.uploaderId !== user.id) {
      return NextResponse.json({ error: '自分がアップロードした動画のみ編集できます' }, { status: 403 });
    }

    // YouTube URL更新の制限：YouTube投稿の場合のみ許可
    if (youtubeUrl && video.uploadType === 'FILE') {
      return NextResponse.json({ 
        error: 'ファイルアップロード方式の動画ではYouTube URLを設定できません' 
      }, { status: 400 });
    }

    // サムネイル画像の処理
    let newThumbnailUrl = video.thumbnailUrl;
    let compressionInfo = null;
    
    if (thumbnailFile && thumbnailFile.size > 0) {
      try {
        // 画像ファイルのバリデーション
        const validation = validateImageFile(thumbnailFile);
        if (!validation.isValid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        // 元画像のサイズを記録
        const originalSize = thumbnailFile.size;
        
        // 画像を処理（リサイズ・WebP変換）
        const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
        const fileName = generateImageFileName(`${videoId}_thumbnail`, thumbnailFile.name);
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'thumbnails');
        const filePath = path.join(uploadDir, fileName);
        
        const processResult = await processThumbnail(buffer, filePath);
        
        // 新しいサムネイルURLを設定
        newThumbnailUrl = `/uploads/thumbnails/${fileName}`;
        
        // 圧縮情報を計算
        const compressionRatio = calculateCompressionRatio(originalSize, processResult.fileSize);
        compressionInfo = {
          originalSize,
          compressedSize: processResult.fileSize,
          compressionRatio,
          dimensions: `${processResult.width}x${processResult.height}`,
          format: processResult.format
        };
        
        console.log(`サムネイル画像を最適化しました: ${newThumbnailUrl}`);
        console.log(`圧縮結果: ${Math.round(originalSize/1024)}KB → ${Math.round(processResult.fileSize/1024)}KB (${compressionRatio}% 削減)`);
        
        // 古いサムネイル画像を削除（ローカルファイルの場合）
        if (video.thumbnailUrl && 
            video.thumbnailUrl.startsWith('/uploads/thumbnails/') && 
            video.thumbnailUrl !== newThumbnailUrl) {
          const oldFilePath = path.join(process.cwd(), 'public', video.thumbnailUrl);
          await deleteImageFile(oldFilePath);
        }
        
      } catch (error) {
        console.error('サムネイル処理エラー:', error);
        return NextResponse.json({ 
          error: `サムネイル画像の処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` 
        }, { status: 500 });
      }
    }

    // トランザクションで更新
    await prisma.$transaction(async (tx: any) => {
      // 動画情報更新
      await tx.video.update({
        where: { id: video.id },
        data: {
          title,
          description,
          youtubeUrl: youtubeUrl || video.youtubeUrl, // 空の場合は既存値を保持
          thumbnailUrl: newThumbnailUrl,
          updatedAt: new Date()
        }
      });

      // カテゴリ更新
      if (categories && Array.isArray(categories)) {
        // 既存のカテゴリを削除
        await tx.videoCategory.deleteMany({
          where: { videoId: video.id }
        });

        // 新しいカテゴリを追加（重複チェック付き）
        if (categories.length > 0) {
          const uniqueCategories = Array.from(new Set(categories.map(id => parseInt(id.toString()))));
          for (const categoryId of uniqueCategories) {
            await tx.videoCategory.upsert({
              where: {
                videoId_categoryId: {
                  videoId: video.id,
                  categoryId: categoryId
                }
              },
              update: {},
              create: {
                videoId: video.id,
                categoryId: categoryId
              }
            });
          }
        }
      }

      // タグ更新
      if (tags && Array.isArray(tags)) {
        // 既存のタグを削除
        await tx.videoTag.deleteMany({
          where: { videoId: video.id }
        });

        // 新しいタグを追加（重複チェック付き）
        if (tags.length > 0) {
          const uniqueTags = Array.from(new Set(tags.map(id => parseInt(id.toString()))));
          for (const tagId of uniqueTags) {
            await tx.videoTag.upsert({
              where: {
                videoId_tagId: {
                  videoId: video.id,
                  tagId: tagId
                }
              },
              update: {},
              create: {
                videoId: video.id,
                tagId: tagId
              }
            });
          }
        }
      }
    });

    return NextResponse.json({ 
      message: '動画を更新しました',
      videoId: video.videoId,
      thumbnailUrl: newThumbnailUrl,
      compressionInfo
    });

  } catch (error) {
    console.error('動画更新エラー:', error);
    return NextResponse.json(
      { error: '動画の更新に失敗しました' },
      { status: 500 }
    );
  }
} 