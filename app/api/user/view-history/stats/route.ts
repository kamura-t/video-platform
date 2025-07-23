import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateApiRequest } from '@/lib/auth';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authResult = await authenticateApiRequest(request, ['ADMIN', 'CURATOR', 'VIEWER']);
    if (authResult.error) {
      return authResult.error;
    }
    const currentUser = authResult.user!;
    const userId = parseInt(currentUser.userId);

    // 基本統計を取得
    const [
      totalVideos,
      totalWatchTime,
      averageCompletionRate,
      recentActivity,
      categoryStats,
      monthlyStats
    ] = await Promise.all([
      // 視聴した動画の総数
      prisma.viewHistory.count({
        where: { userId }
      }),
      
      // 総視聴時間の合計
      prisma.viewHistory.aggregate({
        where: { userId },
        _sum: { watchDuration: true }
      }),
      
      // 平均完了率
      prisma.viewHistory.aggregate({
        where: { userId },
        _avg: { completionRate: true }
      }),
      
      // 最近7日間の視聴活動
      prisma.viewHistory.count({
        where: {
          userId,
          lastWatchedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // カテゴリ別視聴統計
      prisma.$queryRaw`
        SELECT 
          c.name as category_name,
          c.slug as category_slug,
          COUNT(vh.id) as video_count,
          AVG(vh.completion_rate) as avg_completion_rate,
          SUM(vh.watch_duration) as total_watch_time
        FROM view_history vh
        JOIN videos v ON vh.video_id = v.id
        JOIN video_categories vc ON v.id = vc.video_id
        JOIN categories c ON vc.category_id = c.id
        WHERE vh.user_id = ${userId}
        GROUP BY c.id, c.name, c.slug
        ORDER BY video_count DESC
        LIMIT 10
      `,
      
      // 月別視聴統計（過去12ヶ月）
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', vh.last_watched_at) as month,
          COUNT(vh.id) as video_count,
          SUM(vh.watch_duration) as total_watch_time,
          AVG(vh.completion_rate) as avg_completion_rate
        FROM view_history vh
        WHERE vh.user_id = ${userId}
          AND vh.last_watched_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', vh.last_watched_at)
        ORDER BY month DESC
      `
    ]);

    // 完了率による動画分類
    const completionRateDistribution = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN completion_rate >= 90 THEN 'completed'
          WHEN completion_rate >= 50 THEN 'partial'
          WHEN completion_rate >= 10 THEN 'started'
          ELSE 'minimal'
        END as completion_category,
        COUNT(*) as count
      FROM view_history 
      WHERE user_id = ${userId}
      GROUP BY completion_category
      ORDER BY count DESC
    `;

    // 最も視聴時間の長い動画トップ5
    const topWatchedVideos = await prisma.viewHistory.findMany({
      where: { userId },
      select: {
        watchDuration: true,
        completionRate: true,
        lastWatchedAt: true,
        video: {
          include: {
            uploader: {
              select: {
                displayName: true
              }
            }
          }
        }
      },
      orderBy: { watchDuration: 'desc' },
      take: 5
    });

    // お気に入り動画数を取得
    const favoritesCount = await prisma.favorite.count({
      where: { userId }
    });

    // レスポンスデータの整形
    const stats = {
      // アカウントページ用の基本統計
      viewHistoryCount: totalVideos,
      favoritesCount: favoritesCount,
      
      overview: {
        totalVideosWatched: totalVideos,
        totalWatchTimeSeconds: totalWatchTime._sum.watchDuration || 0,
        totalWatchTimeHours: Math.round((totalWatchTime._sum.watchDuration || 0) / 3600 * 10) / 10,
        averageCompletionRate: averageCompletionRate._avg.completionRate 
          ? Math.round(parseFloat(averageCompletionRate._avg.completionRate.toString()) * 100) / 100
          : 0,
        recentActivityCount: recentActivity
      },
      
      completionDistribution: Array.isArray(completionRateDistribution) 
        ? completionRateDistribution.map((item: any) => ({
            category: item.completion_category,
            count: parseInt(item.count)
          }))
        : [],
      
      categoryStats: Array.isArray(categoryStats) 
        ? categoryStats.map((item: any) => ({
            categoryName: item.category_name,
            categorySlug: item.category_slug,
            videoCount: parseInt(item.video_count),
            averageCompletionRate: item.avg_completion_rate 
              ? Math.round(parseFloat(item.avg_completion_rate) * 100) / 100
              : 0,
            totalWatchTime: parseInt(item.total_watch_time || 0)
          }))
        : [],
      
      monthlyStats: Array.isArray(monthlyStats) 
        ? monthlyStats.map((item: any) => ({
            month: item.month,
            videoCount: parseInt(item.video_count),
            totalWatchTime: parseInt(item.total_watch_time || 0),
            averageCompletionRate: item.avg_completion_rate 
              ? Math.round(parseFloat(item.avg_completion_rate) * 100) / 100
              : 0
          }))
        : [],
      
      topWatchedVideos: topWatchedVideos.map(item => ({
        videoId: item.video.videoId,
        title: item.video.title,
        duration: item.video.duration,
        thumbnailUrl: item.video.thumbnailUrl,
        creatorName: item.video.uploader.displayName,
        watchDuration: item.watchDuration,
        completionRate: item.completionRate 
          ? Math.round(parseFloat(item.completionRate.toString()) * 100) / 100
          : 0,
        lastWatchedAt: item.lastWatchedAt
      }))
    };

    return createSuccessResponse(stats);

  } catch (error) {
    console.error('視聴統計取得エラー:', error);
    return createErrorResponse('視聴統計の取得に失敗しました', 500);
  }
}