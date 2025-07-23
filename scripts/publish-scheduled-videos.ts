#!/usr/bin/env node

/**
 * 予約投稿動画を公開するCronジョブスクリプト
 * 
 * このスクリプトは定期的に実行され、予約時刻が過ぎた動画を自動で公開します。
 * 
 * 使用方法:
 * - 直接実行: npm run publish-scheduled  
 * - Cronジョブ: 5分毎実行 (crontab設定例: 0,5,10,15,20,25,30,35,40,45,50,55 * * * *)
 */

import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../lib/notification-service';

const prisma = new PrismaClient();

interface ScheduledItem {
  id: number;
  videoId?: number;
  scheduledPublishAt: Date;
  title: string;
  type: 'video' | 'post' | 'video-unpublish' | 'post-unpublish';
}

/**
 * 予約時刻が過ぎた動画を取得
 */
async function getScheduledVideosToPublish(): Promise<ScheduledItem[]> {
  const now = new Date();
  
  console.log(`📅 予約投稿チェック開始: ${now.toISOString()}`);
  
  const scheduledVideos = await prisma.video.findMany({
    where: {
      isScheduled: true,
      scheduledPublishAt: {
        lte: now, // 現在時刻以前
      },
      visibility: 'DRAFT', // 下書き状態の動画のみ
    },
    select: {
      id: true,
      videoId: true,
      title: true,
      scheduledPublishAt: true,
    },
  });
  
  return scheduledVideos.map(video => ({
    id: video.id,
    videoId: video.id,
    scheduledPublishAt: video.scheduledPublishAt!,
    title: video.title,
    type: 'video' as const,
  }));
}

/**
 * 予約時刻が過ぎた投稿を取得
 */
async function getScheduledPostsToPublish(): Promise<ScheduledItem[]> {
  const now = new Date();
  
  const scheduledPosts = await prisma.post.findMany({
    where: {
      isScheduled: true,
      scheduledPublishAt: {
        lte: now, // 現在時刻以前
      },
      visibility: 'DRAFT', // 下書き状態の投稿のみ
    },
    include: {
      video: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
  
  return scheduledPosts.map(post => ({
    id: post.id,
    videoId: post.video?.id,
    scheduledPublishAt: post.scheduledPublishAt!,
    title: post.title,
    type: 'post' as const,
  }));
}

/**
 * 予約非公開時刻が過ぎた動画を取得
 */
async function getScheduledVideosToUnpublish(): Promise<ScheduledItem[]> {
  const now = new Date();
  
  console.log(`📅 予約非公開チェック開始: ${now.toISOString()}`);
  
  const scheduledVideos = await prisma.video.findMany({
    where: {
      scheduledUnpublishAt: {
        lte: now, // 現在時刻以前
      },
      visibility: 'PUBLIC', // 公開状態の動画のみ
    },
    select: {
      id: true,
      videoId: true,
      title: true,
      scheduledUnpublishAt: true,
    },
  });
  
  return scheduledVideos.map(video => ({
    id: video.id,
    videoId: video.id,
    scheduledPublishAt: video.scheduledUnpublishAt!,
    title: video.title,
    type: 'video-unpublish' as const,
  }));
}

/**
 * 予約非公開時刻が過ぎた投稿を取得
 */
async function getScheduledPostsToUnpublish(): Promise<ScheduledItem[]> {
  const now = new Date();
  
  const scheduledPosts = await prisma.post.findMany({
    where: {
      scheduledUnpublishAt: {
        lte: now, // 現在時刻以前
      },
      visibility: 'PUBLIC', // 公開状態の投稿のみ
    },
    include: {
      video: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
  
  return scheduledPosts.map(post => ({
    id: post.id,
    videoId: post.video?.id,
    scheduledPublishAt: post.scheduledUnpublishAt!,
    title: post.title,
    type: 'post-unpublish' as const,
  }));
}

/**
 * 動画を公開状態に更新
 */
async function publishVideo(videoId: number, title: string): Promise<void> {
  try {
    const video = await prisma.video.update({
      where: { id: videoId },
      data: {
        visibility: 'PUBLIC',
        isScheduled: false,
        scheduledPublishAt: null,
        publishedAt: new Date(),
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    // 通知を送信
    await NotificationService.notifyScheduledPublish(
      video.uploader.id,
      'video',
      title,
      video.videoId
    );
    
    console.log(`✅ 動画公開完了: "${title}" (ID: ${videoId}) - 通知送信済み`);
  } catch (error) {
    console.error(`❌ 動画公開エラー: "${title}" (ID: ${videoId})`, error);
    throw error;
  }
}

/**
 * 投稿を公開状態に更新
 */
async function publishPost(postId: number, title: string): Promise<void> {
  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        visibility: 'PUBLIC',
        isScheduled: false,
        scheduledPublishAt: null,
        publishedAt: new Date(),
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    // 通知を送信
    await NotificationService.notifyScheduledPublish(
      post.creator.id,
      'post',
      title,
      post.postId
    );
    
    console.log(`✅ 投稿公開完了: "${title}" (ID: ${postId}) - 通知送信済み`);
  } catch (error) {
    console.error(`❌ 投稿公開エラー: "${title}" (ID: ${postId})`, error);
    throw error;
  }
}

/**
 * 動画を非公開状態に更新
 */
async function unpublishVideo(videoId: number, title: string): Promise<void> {
  try {
    const video = await prisma.video.update({
      where: { id: videoId },
      data: {
        visibility: 'PRIVATE',
        scheduledUnpublishAt: null, // 非公開化完了後にクリア
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    // 通知を送信
    await NotificationService.notifyScheduledUnpublish(
      video.uploader.id,
      'video',
      title,
      video.videoId
    );
    
    console.log(`🔒 動画非公開完了: "${title}" (ID: ${videoId}) - 通知送信済み`);
  } catch (error) {
    console.error(`❌ 動画非公開エラー: "${title}" (ID: ${videoId})`, error);
    throw error;
  }
}

/**
 * 投稿を非公開状態に更新
 */
async function unpublishPost(postId: number, title: string): Promise<void> {
  try {
    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        visibility: 'PRIVATE',
        scheduledUnpublishAt: null, // 非公開化完了後にクリア
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
    
    // 通知を送信
    await NotificationService.notifyScheduledUnpublish(
      post.creator.id,
      'post',
      title,
      post.postId
    );
    
    console.log(`🔒 投稿非公開完了: "${title}" (ID: ${postId}) - 通知送信済み`);
  } catch (error) {
    console.error(`❌ 投稿非公開エラー: "${title}" (ID: ${postId})`, error);
    throw error;
  }
}

/**
 * 関連する動画も同時に公開
 */
async function publishRelatedVideo(postId: number): Promise<void> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        video: true,
      },
    });
    
    if (post?.video && post.video.visibility === 'DRAFT') {
      await publishVideo(post.video.id, post.video.title);
    }
  } catch (error) {
    console.error(`❌ 関連動画の公開エラー (投稿ID: ${postId})`, error);
    // 関連動画の公開エラーは致命的ではないため、処理を続行
  }
}

/**
 * 関連する動画も同時に非公開化
 */
async function unpublishRelatedVideo(postId: number): Promise<void> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        video: true,
      },
    });
    
    if (post?.video && post.video.visibility === 'PUBLIC') {
      await unpublishVideo(post.video.id, post.video.title);
    }
  } catch (error) {
    console.error(`❌ 関連動画の非公開エラー (投稿ID: ${postId})`, error);
    // 関連動画の非公開エラーは致命的ではないため、処理を続行
  }
}

/**
 * 予約投稿の統計情報を記録
 */
async function logPublishingStats(publishedCount: number, errorCount: number): Promise<void> {
  const now = new Date();
  const logEntry = {
    timestamp: now.toISOString(),
    publishedCount,
    errorCount,
    success: errorCount === 0,
  };
  
  console.log(`📊 予約投稿実行結果: ${JSON.stringify(logEntry)}`);
  
  // 必要に応じて、統計情報をデータベースやログファイルに保存
  // await prisma.systemLog.create({ data: logEntry });
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  console.log('🚀 予約投稿/非公開ジョブ開始');
  
  let publishedCount = 0;
  let errorCount = 0;
  
  try {
    // 予約動画と投稿を取得（公開・非公開両方）
    const [
      scheduledVideos, 
      scheduledPosts, 
      unpublishVideos, 
      unpublishPosts
    ] = await Promise.all([
      getScheduledVideosToPublish(),
      getScheduledPostsToPublish(),
      getScheduledVideosToUnpublish(),
      getScheduledPostsToUnpublish(),
    ]);
    
    const allScheduledItems = [
      ...scheduledVideos, 
      ...scheduledPosts, 
      ...unpublishVideos, 
      ...unpublishPosts
    ];
    
    if (allScheduledItems.length === 0) {
      console.log('📝 公開/非公開予定の動画・投稿はありません');
      return;
    }
    
    const publishCount = scheduledVideos.length + scheduledPosts.length;
    const unpublishCount = unpublishVideos.length + unpublishPosts.length;
    console.log(`📋 処理対象: ${allScheduledItems.length}件 (公開: ${publishCount}件, 非公開: ${unpublishCount}件)`);
    
    // 予約時刻順にソート
    allScheduledItems.sort((a, b) => 
      a.scheduledPublishAt.getTime() - b.scheduledPublishAt.getTime()
    );
    
    // 各アイテムを処理
    for (const item of allScheduledItems) {
      try {
        const actionType = item.type.includes('unpublish') ? '非公開' : '公開';
        console.log(`🔄 ${actionType}処理開始: "${item.title}" (予定時刻: ${item.scheduledPublishAt.toISOString()})`);
        
        if (item.type === 'video') {
          await publishVideo(item.id, item.title);
        } else if (item.type === 'post') {
          await publishPost(item.id, item.title);
          // 投稿に関連する動画も公開
          await publishRelatedVideo(item.id);
        } else if (item.type === 'video-unpublish') {
          await unpublishVideo(item.id, item.title);
        } else if (item.type === 'post-unpublish') {
          await unpublishPost(item.id, item.title);
          // 投稿に関連する動画も非公開化
          await unpublishRelatedVideo(item.id);
        }
        
        publishedCount++;
        
        // 処理間隔を空ける（データベース負荷軽減）
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        const actionType = item.type.includes('unpublish') ? '非公開' : '公開';
        console.error(`❌ ${actionType}処理エラー: "${item.title}"`, error);
        errorCount++;
        
        // エラーが発生しても他のアイテムの処理は続行
        continue;
      }
    }
    
  } catch (error) {
    console.error('❌ 予約投稿ジョブでエラーが発生しました:', error);
    errorCount++;
  } finally {
    // 統計情報をログ出力
    await logPublishingStats(publishedCount, errorCount);
    
    // データベース接続を閉じる
    await prisma.$disconnect();
    
    console.log(`🏁 予約投稿/非公開ジョブ終了 (処理: ${publishedCount}件, エラー: ${errorCount}件)`);
    
    // エラーがあった場合は非ゼロの終了コードで終了
    if (errorCount > 0) {
      process.exit(1);
    }
  }
}

// 未処理の例外をキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未処理のPromise拒否:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未処理の例外:', error);
  process.exit(1);
});

// スクリプトが直接実行された場合のみmain関数を実行
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ メイン処理でエラーが発生しました:', error);
    process.exit(1);
  });
}

export { main as publishScheduledVideos };