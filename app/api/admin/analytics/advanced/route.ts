import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'
import { VideoStatus, Visibility } from '@prisma/client'

export async function GET(request: NextRequest) {
  console.log('=== Advanced Analytics API Called ===')
  
  try {
    const token = request.cookies.get('auth-token')?.value
    console.log('Token exists:', !!token)
    
    if (!token) {
      console.log('No auth token found')
      return createErrorResponse('認証トークンがありません', 401)
    }

    const user = verifyToken(token)
    console.log('User verified:', !!user, 'Role:', user?.role)
    
    if (!user || user.role !== 'ADMIN') {
      console.log('Access denied - not admin')
      return createErrorResponse('管理者権限が必要です', 403)
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'
    const type = searchParams.get('type') || 'overview'

    console.log(`Analytics request: period=${period}, type=${type}`)

    const now = new Date()
    const startDate = getStartDate(period, now)
    console.log(`Date range: ${startDate.toISOString()} to ${now.toISOString()}`)

    let analyticsData: any = {}

    console.log(`Processing analytics type: ${type}`)
    
    switch (type) {
      case 'overview':
        console.log('Calling getOverviewAnalytics...')
        analyticsData = await getOverviewAnalytics(startDate, now)
        console.log('Overview analytics completed')
        break
      case 'engagement':
        console.log('Calling getUserEngagementAnalytics...')
        analyticsData = await getUserEngagementAnalytics(startDate, now)
        console.log('Engagement analytics completed')
        break
      case 'videos':
        console.log('Calling getVideoPerformanceAnalytics...')
        analyticsData = await getVideoPerformanceAnalytics(startDate, now)
        console.log('Video analytics completed')
        break
      case 'users':
        console.log('Calling getUserAnalytics...')
        analyticsData = await getUserAnalytics(startDate, now)
        console.log('User analytics completed')
        break
      case 'search':
        console.log('Calling getSearchAnalytics...')
        analyticsData = await getSearchAnalytics()
        console.log('Search analytics completed')
        break
      case 'domain-videos':
        console.log('Calling getDomainVideosAnalytics...')
        analyticsData = await getDomainVideosAnalytics(startDate, now)
        console.log('Domain videos analytics completed')
        break
      default:
        console.log('Invalid analytics type:', type)
        return createErrorResponse('無効な分析タイプです', 400)
    }

    console.log('Analytics data prepared, size:', JSON.stringify(analyticsData).length, 'chars')
    
    const response = createSuccessResponse(analyticsData)
    console.log('Response created, returning...')
    
    return response
  } catch (error) {
    console.error('=== Advanced analytics error ===')
    console.error('Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error')
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown')
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    
    return createErrorResponse(`高度な分析データの取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function getStartDate(period: string, now: Date): Date {
  const startDate = new Date(now)
  
  switch (period) {
    case '7d':
      startDate.setDate(now.getDate() - 7)
      break
    case '30d':
      startDate.setDate(now.getDate() - 30)
      break
    case '90d':
      startDate.setDate(now.getDate() - 90)
      break
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1)
      break
    default:
      startDate.setDate(now.getDate() - 7)
  }
  
  return startDate
}

async function getOverviewAnalytics(startDate: Date, endDate: Date) {
  console.log('getOverviewAnalytics started')
  try {
    const [
      totalViews,
      totalUsers,
      totalVideos,
      recentUploads
    ] = await Promise.all([
      // 総視聴数
      prisma.viewLog.count({
        where: {
          viewedAt: { gte: startDate, lte: endDate }
        }
      }),
      
      // 総ユーザー数
      prisma.user.count(),
      
      // 総動画数
      prisma.video.count({
        where: {
          status: VideoStatus.COMPLETED
        }
      }),
      
      // 期間内のアップロード数
      prisma.video.count({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      })
    ])

    // 人気動画（簡易版）
    const topVideos = await prisma.video.findMany({
      where: {
        status: VideoStatus.COMPLETED,
        visibility: Visibility.PUBLIC
      },
      select: {
        id: true,
        title: true,
        viewCount: true,
        uploader: {
          select: { displayName: true }
        }
      },
      orderBy: { viewCount: 'desc' },
      take: 10
    })

    // 人気カテゴリ（視聴数ベース）
    const topCategories = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.name,
        c.color,
        COALESCE(COUNT(CASE WHEN vl.id IS NOT NULL THEN 1 END), 0) as view_count
      FROM "categories" c
      LEFT JOIN "video_categories" vc ON c.id = vc.category_id
      LEFT JOIN "videos" v ON vc.video_id = v.id AND v.status = 'completed' AND v.visibility = 'public'
      LEFT JOIN "view_logs" vl ON v.id = vl."video_id" AND vl."viewed_at" >= ${startDate} AND vl."viewed_at" <= ${endDate}
      GROUP BY c.id, c.name, c.color
      ORDER BY view_count DESC, c.name ASC
      LIMIT 10
    ` as any[]

    return {
      summary: {
        totalViews,
        uniqueViewers: Math.floor(totalViews * 0.7), // 推定値
        totalWatchTime: Math.floor(totalViews * 0.5), // 推定値（時間）
        avgSessionDuration: 300 // 推定値（秒）
      },
      topVideos: topVideos.map(video => ({
        id: video.id,
        title: video.title,
        recentViews: video.viewCount,
        avgWatchDuration: 240, // 推定値
        uploaderName: video.uploader.displayName
      })),
      topCategories: topCategories.map((category: any) => ({
        id: Number(category.id),
        name: category.name,
        color: category.color,
        recentViews: Number(category.view_count)
      })),
      viewTrends: await getViewTrends(startDate, endDate),
      deviceStats: await getDeviceStats(startDate, endDate)
    }
  } catch (error) {
    console.error('Overview analytics error:', error)
    throw error
  }
}

async function getUserEngagementAnalytics(startDate: Date, endDate: Date) {
  try {
    const [
      activeUsers,
      newUsers,
      totalUsers,
      engagementMetrics,
      userBehaviorStats,
      sessionStats,
      contentInteractionStats
    ] = await Promise.all([
      // 基本ユーザー統計
      prisma.user.count({
        where: {
          lastLoginAt: { gte: startDate, lte: endDate }
        }
      }),
      
      prisma.user.count({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      
      prisma.user.count(),

      // 詳細エンゲージメント指標
      getDetailedEngagementMetrics(startDate, endDate),

      // ユーザー行動統計
      getUserBehaviorStats(startDate, endDate),

      // セッション統計
      getSessionStats(startDate, endDate),

      // コンテンツインタラクション統計
      getContentInteractionStats(startDate, endDate)
    ])

    const returningUsers = Math.max(0, activeUsers - newUsers)

    return {
      userStats: {
        activeUsers,
        newUsers,
        returningUsers,
        retentionRate: activeUsers > 0 ? Math.round((returningUsers / activeUsers) * 100) : 0
      },
      userActivityTrends: await getUserActivityTrends(startDate, endDate),
      engagement: engagementMetrics,
      userBehavior: userBehaviorStats,
      sessionAnalytics: sessionStats,
      contentInteraction: contentInteractionStats,
      engagementTrends: await getEngagementTrends(startDate, endDate),
      userSegmentation: await getUserSegmentation(startDate, endDate)
    }
  } catch (error) {
    console.error('User engagement analytics error:', error)
    throw error
  }
}

async function getVideoPerformanceAnalytics(startDate: Date, endDate: Date) {
  try {
    const topPerformingVideos = await prisma.video.findMany({
      where: {
        status: VideoStatus.COMPLETED,
        visibility: Visibility.PUBLIC
      },
      select: {
        id: true,
        title: true,
        viewCount: true,
        duration: true,
        uploader: {
          select: { displayName: true }
        }
      },
      orderBy: { viewCount: 'desc' },
      take: 20
    })

    return {
      topVideos: topPerformingVideos.map(video => ({
        id: video.id,
        title: video.title,
        recentViews: video.viewCount,
        avgWatchDuration: video.duration ? Math.min(video.duration * 0.6, video.duration) : 300,
        uploaderName: video.uploader.displayName
      })),
      completionRates: [],
      uploadTrends: [],
      durationAnalysis: []
    }
  } catch (error) {
    console.error('Video performance analytics error:', error)
    throw error
  }
}

async function getUserAnalytics(startDate: Date, endDate: Date) {
  try {
    const [
      userRoleDistribution,
      topContributors,
      domainAnalytics,
      departmentAnalytics,
      userActivityLevels
    ] = await Promise.all([
      // 役割別分布
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true }
      }),

      // トップ貢献者
      prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'CURATOR'] }
        },
        select: {
          id: true,
          displayName: true,
          role: true,
          _count: {
            select: { videos: true }
          }
        },
        orderBy: {
          videos: { _count: 'desc' }
        },
        take: 10
      }),

      // ドメイン別分析
      getDomainAnalytics(startDate, endDate),

      // 部門別分析
      getDepartmentAnalytics(startDate, endDate),

      // ユーザーアクティビティレベル
      getUserActivityLevels(startDate, endDate)
    ])

    return {
      userRoleDistribution: userRoleDistribution.map(role => ({
        role: role.role,
        userCount: Number(role._count.id)
      })),
      topContributors: topContributors.map(contributor => ({
        id: Number(contributor.id),
        displayName: contributor.displayName,
        role: contributor.role,
        videoCount: Number(contributor._count.videos)
      })),
      domainAnalytics,
      departmentAnalytics,
      userActivityLevels
    }
  } catch (error) {
    console.error('User analytics error:', error)
    throw error
  }
}

async function getSearchAnalytics() {
  return {
    topSearchQueries: [],
    searchClickthrough: [],
    noResultsQueries: [],
    searchTrends: []
  }
}

async function getRealtimeAnalytics() {
  try {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    const recentViews = await prisma.viewLog.count({
      where: {
        viewedAt: { gte: oneHourAgo }
      }
    })

    return {
      currentViewers: Math.floor(recentViews * 0.1), // 推定値
      recentViews,
      activeVideos: []
    }
  } catch (error) {
    console.error('Realtime analytics error:', error)
    throw error
  }
}

async function getViewTrends(startDate: Date, endDate: Date) {
  try {
    // 日別の視聴トレンドを取得
    const dailyViews = await prisma.$queryRaw`
      SELECT 
        DATE("viewed_at") as date,
        COUNT(*) as views,
        COUNT(DISTINCT "session_id") as unique_viewers,
        COALESCE(SUM("watch_duration"), 0) as total_watch_time
      FROM "view_logs"
      WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
      GROUP BY DATE("viewed_at")
      ORDER BY date ASC
    ` as any[]

    return dailyViews.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      views: Number(row.views),
      unique_viewers: Number(row.unique_viewers),
      total_watch_time: Math.floor(Number(row.total_watch_time))
    }))
  } catch (error) {
    console.error('View trends error:', error)
    return []
  }
}

async function getDeviceStats(startDate: Date, endDate: Date) {
  try {
    // デバイス統計は現在ViewLogに含まれていないため、
    // 実装時までは推定値を返す
    const totalViews = await prisma.viewLog.count({
      where: {
        viewedAt: { gte: startDate, lte: endDate }
      }
    })

    // 実データがない場合の推定値
    if (totalViews === 0) {
      return {
        deviceTypes: { mobile: 0, desktop: 0, tablet: 0 },
        browsers: { chrome: 0, safari: 0, firefox: 0, edge: 0 }
      }
    }

    // 実装例：実際のデバイス情報が取得できるまでの仮の分布
    return {
      deviceTypes: { 
        mobile: Math.floor(totalViews * 0.6), 
        desktop: Math.floor(totalViews * 0.35), 
        tablet: Math.floor(totalViews * 0.05) 
      },
      browsers: { 
        chrome: Math.floor(totalViews * 0.7), 
        safari: Math.floor(totalViews * 0.15), 
        firefox: Math.floor(totalViews * 0.1), 
        edge: Math.floor(totalViews * 0.05) 
      }
    }
  } catch (error) {
    console.error('Device stats error:', error)
    return {
      deviceTypes: { mobile: 0, desktop: 0, tablet: 0 },
      browsers: { chrome: 0, safari: 0, firefox: 0, edge: 0 }
    }
  }
}

async function getUserActivityTrends(startDate: Date, endDate: Date) {
  try {
    // 日別のユーザーアクティビティトレンド
    const dailyActivity = await prisma.$queryRaw`
      SELECT 
        DATE("viewed_at") as date,
        COUNT(DISTINCT "session_id") as active_users,
        COUNT(*) as total_views
      FROM "view_logs"
      WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
      GROUP BY DATE("viewed_at")
      ORDER BY date ASC
    ` as any[]

    return dailyActivity.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      views: Number(row.total_views),
      unique_viewers: Number(row.active_users),
      total_watch_time: Number(row.total_views) * 300 // 推定値
    }))
  } catch (error) {
    console.error('User activity trends error:', error)
    return []
  }
}

// 詳細エンゲージメント指標
async function getDetailedEngagementMetrics(startDate: Date, endDate: Date) {
  try {
    const [viewStats, completionStats, sessionStats] = await Promise.all([
      // 視聴統計
      prisma.$queryRaw`
        SELECT 
          COALESCE(AVG("watch_duration"), 0) as avg_watch_duration,
          COALESCE(SUM("watch_duration"), 0) as total_watch_time,
          COUNT(*) as total_views,
          COUNT(DISTINCT "session_id") as unique_sessions
        FROM "view_logs"
        WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
        AND "watch_duration" IS NOT NULL
      ` as unknown as any[],

      // 完了率統計
      prisma.$queryRaw`
        SELECT 
          COALESCE(AVG("completion_rate"), 0) as avg_completion_rate,
          COUNT(CASE WHEN "completion_rate" >= 90 THEN 1 END) as high_completion_views,
          COUNT(CASE WHEN "completion_rate" >= 50 AND "completion_rate" < 90 THEN 1 END) as medium_completion_views,
          COUNT(CASE WHEN "completion_rate" < 50 THEN 1 END) as low_completion_views
        FROM "view_logs"
        WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
        AND "completion_rate" IS NOT NULL
      ` as unknown as any[],

      // セッション統計
      prisma.$queryRaw`
        SELECT 
          COUNT(DISTINCT "session_id") as total_sessions,
          COALESCE(AVG(session_views), 0) as avg_views_per_session,
          COALESCE(AVG(session_duration), 0) as avg_session_duration
        FROM (
          SELECT 
            "session_id",
            COUNT(*) as session_views,
            SUM(COALESCE("watch_duration", 0)) as session_duration
          FROM "view_logs"
          WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
          AND "session_id" IS NOT NULL
          GROUP BY "session_id"
        ) session_summary
      ` as unknown as any[]
    ])

    const viewData = viewStats[0]
    const completionData = completionStats[0]
    const sessionData = sessionStats[0]

    return {
      avgWatchDuration: Math.floor(Number(viewData.avg_watch_duration || 0)),
      totalWatchTime: Math.floor(Number(viewData.total_watch_time || 0) / 3600), // 時間単位
      avgCompletionRate: Math.round(Number(completionData.avg_completion_rate || 0)),
      highCompletionRate: Math.round((Number(completionData.high_completion_views || 0) / Math.max(1, Number(viewData.total_views))) * 100),
      avgViewsPerSession: Math.round(Number(sessionData.avg_views_per_session || 0) * 100) / 100,
      avgSessionDuration: Math.floor(Number(sessionData.avg_session_duration || 0)),
      totalSessions: Number(sessionData.total_sessions || 0),
      viewDistribution: {
        highCompletion: Number(completionData.high_completion_views || 0),
        mediumCompletion: Number(completionData.medium_completion_views || 0),
        lowCompletion: Number(completionData.low_completion_views || 0)
      }
    }
  } catch (error) {
    console.error('Detailed engagement metrics error:', error)
    return {
      avgWatchDuration: 0,
      totalWatchTime: 0,
      avgCompletionRate: 0,
      highCompletionRate: 0,
      avgViewsPerSession: 0,
      avgSessionDuration: 0,
      totalSessions: 0,
      viewDistribution: { highCompletion: 0, mediumCompletion: 0, lowCompletion: 0 }
    }
  }
}

// ユーザー行動統計
async function getUserBehaviorStats(startDate: Date, endDate: Date) {
  try {
    const [behaviorStats, bounceStats] = await Promise.all([
      // 行動パターン統計
      prisma.$queryRaw`
        SELECT 
          COUNT(CASE WHEN session_views = 1 THEN 1 END) as single_video_sessions,
          COUNT(CASE WHEN session_views BETWEEN 2 AND 5 THEN 1 END) as moderate_sessions,
          COUNT(CASE WHEN session_views > 5 THEN 1 END) as high_engagement_sessions,
          COALESCE(AVG(session_views), 0) as avg_videos_per_session,
          COALESCE(MAX(session_views), 0) as max_videos_per_session
        FROM (
          SELECT 
            "session_id",
            COUNT(*) as session_views
          FROM "view_logs"
          WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
          AND "session_id" IS NOT NULL
          GROUP BY "session_id"
        ) session_summary
      ` as unknown as any[],

      // バウンス率・再訪問統計
      prisma.$queryRaw`
        SELECT 
          COUNT(CASE WHEN "watch_duration" < 30 THEN 1 END) as quick_exits,
          COUNT(CASE WHEN "watch_duration" >= 30 AND "watch_duration" < 300 THEN 1 END) as short_views,
          COUNT(CASE WHEN "watch_duration" >= 300 THEN 1 END) as engaged_views,
          COUNT(*) as total_views
        FROM "view_logs"
        WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
        AND "watch_duration" IS NOT NULL
      ` as unknown as any[]
    ])

    const behavior = behaviorStats[0]
    const bounce = bounceStats[0]

    return {
      sessionDistribution: {
        singleVideo: Number(behavior.single_video_sessions || 0),
        moderate: Number(behavior.moderate_sessions || 0),
        highEngagement: Number(behavior.high_engagement_sessions || 0)
      },
      avgVideosPerSession: Math.round(Number(behavior.avg_videos_per_session || 0) * 100) / 100,
      maxVideosPerSession: Number(behavior.max_videos_per_session || 0),
      viewEngagement: {
        quickExits: Number(bounce.quick_exits || 0),
        shortViews: Number(bounce.short_views || 0),
        engagedViews: Number(bounce.engaged_views || 0)
      },
      bounceRate: Math.round((Number(bounce.quick_exits || 0) / Math.max(1, Number(bounce.total_views))) * 100)
    }
  } catch (error) {
    console.error('User behavior stats error:', error)
    return {
      sessionDistribution: { singleVideo: 0, moderate: 0, highEngagement: 0 },
      avgVideosPerSession: 0,
      maxVideosPerSession: 0,
      viewEngagement: { quickExits: 0, shortViews: 0, engagedViews: 0 },
      bounceRate: 0
    }
  }
}

// セッション統計
async function getSessionStats(startDate: Date, endDate: Date) {
  try {
    const sessionAnalysis = await prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM "viewed_at") as hour_of_day,
        COUNT(DISTINCT "session_id") as sessions_count,
        COUNT(*) as total_views,
        COALESCE(AVG("watch_duration"), 0) as avg_watch_duration
      FROM "view_logs"
      WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
      AND "session_id" IS NOT NULL
      GROUP BY EXTRACT(HOUR FROM "viewed_at")
      ORDER BY hour_of_day ASC
    ` as any[]

    const hourlyActivity = Array.from({ length: 24 }, (_, hour) => {
      const data = sessionAnalysis.find(row => Number(row.hour_of_day) === hour)
      return {
        hour,
        sessions: Number(data?.sessions_count || 0),
        views: Number(data?.total_views || 0),
        avgWatchDuration: Math.floor(Number(data?.avg_watch_duration || 0))
      }
    })

    return {
      hourlyActivity,
      peakHours: hourlyActivity
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 3)
        .map(item => ({ hour: item.hour, sessions: item.sessions }))
    }
  } catch (error) {
    console.error('Session stats error:', error)
    return {
      hourlyActivity: [],
      peakHours: []
    }
  }
}

// コンテンツインタラクション統計
async function getContentInteractionStats(startDate: Date, endDate: Date) {
  try {
    const [favoriteStats, playlistStats] = await Promise.all([
      // お気に入り統計
      prisma.favorite.count({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      }),

      // プレイリスト統計
      prisma.playlist.count({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      })
    ])

    // カテゴリ別エンゲージメント
    const categoryEngagement = await prisma.$queryRaw`
      SELECT 
        c.name as category_name,
        COUNT(vl.id) as total_views,
        COALESCE(AVG(vl."watch_duration"), 0) as avg_watch_duration,
        COALESCE(AVG(vl."completion_rate"), 0) as avg_completion_rate
      FROM "categories" c
      LEFT JOIN "video_categories" vc ON c.id = vc.category_id
      LEFT JOIN "videos" v ON vc.video_id = v.id
      LEFT JOIN "view_logs" vl ON v.id = vl."video_id" 
        AND vl."viewed_at" >= ${startDate} AND vl."viewed_at" <= ${endDate}
      WHERE v.status = 'completed' AND v.visibility = 'public'
      GROUP BY c.id, c.name
      HAVING COUNT(vl.id) > 0
      ORDER BY total_views DESC
      LIMIT 10
    ` as any[]

    return {
      newFavorites: favoriteStats,
      newPlaylists: playlistStats,
      categoryEngagement: categoryEngagement.map((cat: any) => ({
        categoryName: cat.category_name,
        totalViews: Number(cat.total_views),
        avgWatchDuration: Math.floor(Number(cat.avg_watch_duration || 0)),
        avgCompletionRate: Math.round(Number(cat.avg_completion_rate || 0))
      }))
    }
  } catch (error) {
    console.error('Content interaction stats error:', error)
    return {
      newFavorites: 0,
      newPlaylists: 0,
      categoryEngagement: []
    }
  }
}

// エンゲージメントトレンド
async function getEngagementTrends(startDate: Date, endDate: Date) {
  try {
    const dailyEngagement = await prisma.$queryRaw`
      SELECT 
        DATE("viewed_at") as date,
        COALESCE(AVG("watch_duration"), 0) as avg_watch_duration,
        COALESCE(AVG("completion_rate"), 0) as avg_completion_rate,
        COUNT(DISTINCT "session_id") as unique_sessions,
        COUNT(*) as total_views
      FROM "view_logs"
      WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
      GROUP BY DATE("viewed_at")
      ORDER BY date ASC
    ` as any[]

    return dailyEngagement.map((row: any) => ({
      date: row.date.toISOString().split('T')[0],
      avgWatchDuration: Math.floor(Number(row.avg_watch_duration || 0)),
      avgCompletionRate: Math.round(Number(row.avg_completion_rate || 0)),
      uniqueSessions: Number(row.unique_sessions),
      totalViews: Number(row.total_views),
      engagementScore: Math.round((Number(row.avg_completion_rate || 0) + (Number(row.avg_watch_duration || 0) / 10)) / 2)
    }))
  } catch (error) {
    console.error('Engagement trends error:', error)
    return []
  }
}

// ユーザーセグメンテーション
async function getUserSegmentation(startDate: Date, endDate: Date) {
  try {
    const userSegments = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN session_views >= 10 THEN 'Power Users'
          WHEN session_views >= 5 THEN 'Active Users'
          WHEN session_views >= 2 THEN 'Regular Users'
          ELSE 'Casual Users'
        END as segment,
        COUNT(*) as user_count,
        COALESCE(AVG(total_watch_time), 0) as avg_watch_time,
        COALESCE(AVG(avg_completion), 0) as avg_completion_rate
      FROM (
        SELECT 
          "session_id",
          COUNT(*) as session_views,
          SUM(COALESCE("watch_duration", 0)) as total_watch_time,
          AVG(COALESCE("completion_rate", 0)) as avg_completion
        FROM "view_logs"
        WHERE "viewed_at" >= ${startDate} AND "viewed_at" <= ${endDate}
        AND "session_id" IS NOT NULL
        GROUP BY "session_id"
      ) user_summary
      GROUP BY 
        CASE 
          WHEN session_views >= 10 THEN 'Power Users'
          WHEN session_views >= 5 THEN 'Active Users'
          WHEN session_views >= 2 THEN 'Regular Users'
          ELSE 'Casual Users'
        END
      ORDER BY user_count DESC
    ` as any[]

    return userSegments.map((segment: any) => ({
      segment: segment.segment,
      userCount: Number(segment.user_count),
      avgWatchTime: Math.floor(Number(segment.avg_watch_time || 0)),
      avgCompletionRate: Math.round(Number(segment.avg_completion_rate || 0))
    }))
  } catch (error) {
    console.error('User segmentation error:', error)
    return []
  }
}

// ドメイン別分析
async function getDomainAnalytics(startDate: Date, endDate: Date) {
  try {
    
    // まず基本的なユーザー情報を確認
    const userCount = await prisma.user.count({
      where: {
        email: { 
          not: undefined,
          contains: '@'
        }
      }
    })
    
    // サンプルユーザーのメール確認（デバッグ用）
    const sampleUsers = await prisma.user.findMany({
      select: { email: true },
      where: { 
        email: { 
          not: undefined,
          contains: '@'
        }
      },
      take: 5
    })
    
    // シンプルなドメイン別ユーザー数統計
    const domainStats = await prisma.$queryRaw`
      SELECT 
        SUBSTRING(u.email FROM '@(.*)$') as domain,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT CASE WHEN u.last_login_at >= ${startDate} THEN u.id END) as active_users
      FROM users u
      WHERE u.email IS NOT NULL AND u.email LIKE '%@%'
      GROUP BY domain
      HAVING COUNT(DISTINCT u.id) >= 1
      ORDER BY user_count DESC
      LIMIT 20
    ` as unknown as any[]
    
    
    if (domainStats.length === 0) {
    }

    // ドメイン別エンゲージメント詳細（ViewHistoryテーブルを使用）
    const domainEngagement = await prisma.$queryRaw`
      SELECT 
        SUBSTRING(u.email FROM '@(.*)$') as domain,
        COUNT(DISTINCT f.id) as total_favorites,
        COUNT(DISTINCT p.id) as total_playlists,
        COALESCE(AVG(vh.completion_rate), 0) as avg_completion_rate,
        COUNT(CASE WHEN vh.completion_rate >= 90 THEN 1 END) as high_completion_views
      FROM users u
      LEFT JOIN favorites f ON u.id = f.user_id 
        AND f.created_at >= ${startDate} AND f.created_at <= ${endDate}
      LEFT JOIN playlists p ON u.id = p.creator_id 
        AND p.created_at >= ${startDate} AND p.created_at <= ${endDate}
      LEFT JOIN view_history vh ON u.id = vh.user_id 
        AND vh.last_watched_at >= ${startDate} AND vh.last_watched_at <= ${endDate}
      WHERE u.email IS NOT NULL AND u.email LIKE '%@%'
      GROUP BY domain
      HAVING COUNT(DISTINCT u.id) >= 1
      ORDER BY domain ASC
    ` as unknown as any[]

    // データを統合（BigInt対応）
    const domainAnalysis = domainStats.map((domain: any) => {
      const engagement = domainEngagement.find((eng: any) => eng.domain === domain.domain) || {}
      
      // BigIntを明示的にNumberに変換
      const userCount = Number(BigInt(domain.user_count || 0))
      const activeUsers = Number(BigInt(domain.active_users || 0))
      
      return {
        domain: domain.domain || 'unknown',
        userCount,
        activeUsers,
        totalViews: Number(BigInt(engagement.total_favorites || 0)), // 一時的にfavoritesをviewsとして表示
        avgWatchDuration: 0, // 一時的に0
        totalWatchTime: 0, // 一時的に0
        totalFavorites: Number(BigInt(engagement.total_favorites || 0)),
        totalPlaylists: Number(BigInt(engagement.total_playlists || 0)),
        avgCompletionRate: Math.round(Number(engagement.avg_completion_rate || 0)),
        highCompletionViews: Number(BigInt(engagement.high_completion_views || 0)),
        engagementScore: Math.round(
          (activeUsers / Math.max(1, userCount)) * 100
        )
      }
    })

    return {
      domains: domainAnalysis,
      totalDomains: domainAnalysis.length,
      topDomainByUsers: domainAnalysis[0]?.domain || 'N/A',
      topDomainByEngagement: domainAnalysis
        .sort((a, b) => b.engagementScore - a.engagementScore)[0]?.domain || 'N/A'
    }
  } catch (error) {
    console.error('Domain analytics error:', error)
    return {
      domains: [],
      totalDomains: 0,
      topDomainByUsers: 'N/A',
      topDomainByEngagement: 'N/A'
    }
  }
}

// 部門別分析
async function getDepartmentAnalytics(startDate: Date, endDate: Date) {
  try {
    const departmentStats = await prisma.$queryRaw`
      SELECT 
        COALESCE(u.department, '未設定') as department,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT CASE WHEN u.last_login_at >= ${startDate} THEN u.id END) as active_users,
        COALESCE(COUNT(vh.id), 0) as total_views,
        COALESCE(AVG(vh.watch_duration), 0) as avg_watch_duration,
        COALESCE(AVG(vh.completion_rate), 0) as avg_completion_rate
      FROM users u
      LEFT JOIN view_history vh ON u.id = vh.user_id 
        AND vh.last_watched_at >= ${startDate} AND vh.last_watched_at <= ${endDate}
      GROUP BY department
      ORDER BY user_count DESC
      LIMIT 15
    ` as unknown as any[]

    return departmentStats.map((dept: any) => ({
      department: dept.department,
      userCount: Number(BigInt(dept.user_count || 0)),
      activeUsers: Number(BigInt(dept.active_users || 0)),
      totalViews: Number(BigInt(dept.total_views || 0)),
      avgWatchDuration: Math.floor(Number(dept.avg_watch_duration || 0)),
      avgCompletionRate: Math.round(Number(dept.avg_completion_rate || 0)),
      engagementRate: Math.round(
        (Number(BigInt(dept.active_users || 0)) / Math.max(1, Number(BigInt(dept.user_count || 0)))) * 100
      )
    }))
  } catch (error) {
    console.error('Department analytics error:', error)
    return []
  }
}

// ユーザーアクティビティレベル
async function getUserActivityLevels(startDate: Date, endDate: Date) {
  try {
    // 実際の視聴データでアクティビティレベルを計算
    const userActivityStats = await prisma.$queryRaw`
      SELECT 
        CASE 
          WHEN view_count >= 20 THEN 'Very Active'
          WHEN view_count >= 10 THEN 'Active'
          WHEN view_count >= 3 THEN 'Moderate'
          WHEN view_count >= 1 THEN 'Light'
          ELSE 'Inactive'
        END as activity_level,
        COUNT(*) as user_count,
        COALESCE(AVG(avg_watch_duration), 0) as avg_watch_duration,
        COALESCE(AVG(avg_completion_rate), 0) as avg_completion_rate
      FROM (
        SELECT 
          COALESCE(vl.session_id, 'user_' || vl.id) as user_session,
          COUNT(vl.id) as view_count,
          COALESCE(AVG(vl.watch_duration), 0) as avg_watch_duration,
          COALESCE(AVG(vl.completion_rate), 0) as avg_completion_rate
        FROM view_logs vl
        WHERE vl.viewed_at >= ${startDate} AND vl.viewed_at <= ${endDate}
        GROUP BY COALESCE(vl.session_id, 'user_' || vl.id)
      ) user_activity
      GROUP BY activity_level
      ORDER BY 
        CASE activity_level
          WHEN 'Very Active' THEN 1
          WHEN 'Active' THEN 2
          WHEN 'Moderate' THEN 3
          WHEN 'Light' THEN 4
          ELSE 5
        END
    ` as unknown as any[]

    // データが少ない場合は、ユーザー登録時期ベースの代替データを作成
    if (userActivityStats.length === 0) {
      const [totalUsers, recentUsers, adminUsers, curatorUsers] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: { lastLoginAt: { gte: startDate } }
        }),
        prisma.user.count({
          where: { role: 'ADMIN' }
        }),
        prisma.user.count({
          where: { role: 'CURATOR' }
        })
      ])

      const viewerUsers = totalUsers - adminUsers - curatorUsers
      
      return [
        {
          activityLevel: 'Active Users',
          userCount: recentUsers,
          avgWatchDuration: 450, // 推定値
          avgCompletionRate: 75
        },
        {
          activityLevel: 'Content Creators',
          userCount: curatorUsers + adminUsers,
          avgWatchDuration: 600, // 推定値
          avgCompletionRate: 85
        },
        {
          activityLevel: 'Viewers',
          userCount: viewerUsers,
          avgWatchDuration: 300, // 推定値
          avgCompletionRate: 65
        },
        {
          activityLevel: 'Inactive',
          userCount: Math.max(0, totalUsers - recentUsers),
          avgWatchDuration: 120, // 推定値
          avgCompletionRate: 35
        }
      ]
    }

    return userActivityStats.map((level: any) => ({
      activityLevel: level.activity_level,
      userCount: Number(BigInt(level.user_count || 0)),
      avgWatchDuration: Math.floor(Number(level.avg_watch_duration || 0)),
      avgCompletionRate: Math.round(Number(level.avg_completion_rate || 0))
    }))
  } catch (error) {
    console.error('User activity levels error:', error)
    // エラー時はフォールバックデータ
    return [
      {
        activityLevel: 'データ取得中',
        userCount: 0,
        avgWatchDuration: 0,
        avgCompletionRate: 0
      }
    ]
  }
}

// ドメイン別視聴動画分析
async function getDomainVideosAnalytics(startDate: Date, endDate: Date) {
  try {
    // ドメイン別視聴トップ30動画を取得
    const domainVideoStats = await prisma.$queryRaw`
      SELECT 
        SUBSTRING(u.email FROM '@(.*)$') as domain,
        v.video_id,
        v.title,
        v.thumbnail_url,
        v.duration,
        v.created_at,
        v.view_count,
        COUNT(DISTINCT vh.id) as domain_views,
        COUNT(DISTINCT vh.user_id) as unique_viewers,
        COALESCE(AVG(vh.completion_rate), 0) as avg_completion_rate,
        COALESCE(AVG(vh.watch_duration), 0) as avg_watch_duration
      FROM users u
      INNER JOIN view_history vh ON u.id = vh.user_id
      INNER JOIN videos v ON vh.video_id = v.id
      WHERE u.email IS NOT NULL 
        AND u.email LIKE '%@%'
        AND vh.last_watched_at >= ${startDate} 
        AND vh.last_watched_at <= ${endDate}
        AND v.visibility = 'public'
        AND v.status = 'completed'
      GROUP BY domain, v.id, v.video_id, v.title, v.thumbnail_url, v.duration, v.created_at, v.view_count
      ORDER BY domain_views DESC, unique_viewers DESC
      LIMIT 150
    ` as unknown as any[]

    // ドメイン別にグループ化し、各ドメインのトップ30を取得
    const domainGroups: { [key: string]: any[] } = {}
    
    domainVideoStats.forEach((video: any) => {
      const domain = video.domain || 'unknown'
      if (!domainGroups[domain]) {
        domainGroups[domain] = []
      }
      if (domainGroups[domain].length < 30) {
        domainGroups[domain].push({
          videoId: video.video_id,
          title: video.title,
          thumbnailUrl: video.thumbnail_url,
          duration: Number(video.duration || 0),
          createdAt: video.created_at,
          totalViews: Number(video.view_count || 0),
          domainViews: Number(BigInt(video.domain_views || 0)),
          uniqueViewers: Number(BigInt(video.unique_viewers || 0)),
          avgCompletionRate: Math.round(Number(video.avg_completion_rate || 0)),
          avgWatchDuration: Math.floor(Number(video.avg_watch_duration || 0))
        })
      }
    })

    // ドメイン統計を取得
    const domainSummary = await prisma.$queryRaw`
      SELECT 
        SUBSTRING(u.email FROM '@(.*)$') as domain,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT vh.user_id) as active_viewers,
        COUNT(DISTINCT vh.video_id) as videos_watched,
        COUNT(vh.id) as total_views
      FROM users u
      INNER JOIN view_history vh ON u.id = vh.user_id
      WHERE u.email IS NOT NULL 
        AND u.email LIKE '%@%'
        AND vh.last_watched_at >= ${startDate} 
        AND vh.last_watched_at <= ${endDate}
      GROUP BY domain
      ORDER BY total_views DESC
    ` as unknown as any[]

    const domainSummaryProcessed = domainSummary.map((domain: any) => ({
      domain: domain.domain || 'unknown',
      totalUsers: Number(BigInt(domain.total_users || 0)),
      activeViewers: Number(BigInt(domain.active_viewers || 0)),
      videosWatched: Number(BigInt(domain.videos_watched || 0)),
      totalViews: Number(BigInt(domain.total_views || 0))
    }))

    return {
      domainVideos: domainGroups,
      domainSummary: domainSummaryProcessed,
      totalDomains: Object.keys(domainGroups).length,
      totalVideos: domainVideoStats.length
    }
  } catch (error) {
    console.error('Domain videos analytics error:', error)
    return {
      domainVideos: {},
      domainSummary: [],
      totalDomains: 0,
      totalVideos: 0
    }
  }
}