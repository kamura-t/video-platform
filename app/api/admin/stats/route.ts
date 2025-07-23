import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// 簡単なメモリキャッシュ
interface CacheEntry {
  data: any
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_DURATION = 5 * 60 * 1000 // 5分間キャッシュ

function getCachedData(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null
  
  if (Date.now() - entry.timestamp > CACHE_DURATION) {
    cache.delete(key)
    return null
  }
  
  return entry.data
}

function setCachedData(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  })
}

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const user = verifyToken(token)
    if (!user || !['admin', 'curator'].includes(user.role?.toLowerCase() || '')) {
      return NextResponse.json(
        { success: false, error: '管理者またはキュレーター権限が必要です' },
        { status: 403 }
      )
    }

    // 強制更新のチェックと表示件数の取得
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('t') // タイムスタンプが付いている場合は強制更新
    const tagsLimit = parseInt(searchParams.get('tagsLimit') || '10')
    const videosLimit = parseInt(searchParams.get('videosLimit') || '10')
    const categoriesLimit = parseInt(searchParams.get('categoriesLimit') || '10')

    // キャッシュをチェック（強制更新でない場合のみ）
    const cacheKey = `admin_stats_${tagsLimit}_${videosLimit}_${categoriesLimit}`
    if (!forceRefresh) {
      const cachedStats = getCachedData(cacheKey)
      if (cachedStats) {
        return NextResponse.json({
          success: true,
          data: {
            ...cachedStats,
            cached: true,
            cacheAge: Math.floor((Date.now() - cache.get(cacheKey)!.timestamp) / 1000)
          }
        })
      }
    }

    // 今月の開始日を計算
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 並列でデータベースクエリを実行
    const [
      totalVideos,
      totalUsers,
      totalViews,
      recentUploads,
      videosByStatus,
      videosByVisibility,
      authUserViewStats,
      topAuthUsersByViews,
      usersByAuthProvider,
      usersByRole,
      topCategories,
      topTags,
      recentViewLogs,
      dailyViewLogs,
      watchTimeStats,
      topVideos
    ] = await Promise.all([
      // 総動画数（完了済み、パブリック + プライベート）
      prisma.video.count({
        where: {
          status: 'COMPLETED'
        }
      }),
      
      // 総ユーザー数（アクティブ）
      prisma.user.count({
        where: {
          isActive: true
        }
      }),
      
      // 総視聴数
      prisma.video.aggregate({
        _sum: {
          viewCount: true
        },
        where: {
          status: 'COMPLETED'
        }
      }),
      
      // 今月のアップロード数
      prisma.video.count({
        where: {
          createdAt: {
            gte: currentMonthStart
          },
          status: 'COMPLETED'
        }
      }),
      
      // 動画ステータス別集計
      prisma.video.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      }),
      
      // 動画可視性別集計
      prisma.video.groupBy({
        by: ['visibility'],
        _count: {
          id: true
        },
        where: {
          status: 'COMPLETED'
        }
      }),
      
      // 認証ユーザーの視聴統計
      prisma.viewHistory.groupBy({
        by: ['userId'],
        _count: { id: true },
        _sum: { watchDuration: true },
        _avg: { completionRate: true }
      }),

      // 認証ユーザー別視聴統計（トップ10）
      prisma.$queryRaw`
        SELECT 
          u.display_name,
          u.username,
          u.role,
          u.auth_provider,
          COUNT(vh.id) as videos_watched,
          SUM(vh.watch_duration) as total_watch_time,
          AVG(vh.completion_rate) as avg_completion_rate,
          MAX(vh.last_watched_at) as last_activity
        FROM view_history vh
        JOIN users u ON vh.user_id = u.id
        WHERE u.is_active = true
        GROUP BY u.id, u.display_name, u.username, u.role, u.auth_provider
        ORDER BY videos_watched DESC
        LIMIT 10
      `,

      // 認証方式別ユーザー統計
      prisma.user.groupBy({
        by: ['authProvider'],
        _count: { id: true },
        where: { isActive: true }
      }),

      // ユーザー役割別集計
      prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true
        },
        where: {
          isActive: true
        }
      }),
      
      // 人気カテゴリ（動的件数）- 実際の利用数順
      prisma.category.findMany({
        select: {
          id: true,
          name: true,
          videoCount: true,
          _count: {
            select: {
              videos: true
            }
          }
        },
        where: {
          videos: {
            some: {} // 少なくとも1つの動画に関連付けられているカテゴリのみ
          }
        },
        orderBy: {
          videos: {
            _count: 'desc' // 実際の関連動画数で並び替え
          }
        },
        take: categoriesLimit
      }),
      
      // 人気タグ（動的件数）- 実際の利用数順
      prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          videoCount: true,
          _count: {
            select: {
              videos: true
            }
          }
        },
        where: {
          videos: {
            some: {} // 少なくとも1つの動画に関連付けられているタグのみ
          }
        },
        orderBy: {
          videos: {
            _count: 'desc' // 実際の関連動画数で並び替え
          }
        },
        take: tagsLimit
      }),
      
      // 最近の視聴ログ（過去7日間）
      prisma.viewLog.count({
        where: {
          viewedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // 過去30日間の日別視聴数
      prisma.viewLog.groupBy({
        by: ['viewedAt'],
        _count: {
          id: true
        },
        where: {
          viewedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        orderBy: {
          viewedAt: 'desc'
        }
      }),
      
      // 視聴時間分析
      prisma.viewLog.aggregate({
        _avg: {
          watchDuration: true,
          completionRate: true
        },
        _sum: {
          watchDuration: true
        },
        where: {
          watchDuration: {
            not: null
          }
        }
      }),
      
      // 人気の動画（視聴回数上位、動的件数）
      prisma.video.findMany({
        select: {
          id: true,
          videoId: true,
          title: true,
          viewCount: true,
          uploader: {
            select: {
              displayName: true
            }
          }
        },
        where: {
          status: 'COMPLETED'
        },
        orderBy: {
          viewCount: 'desc'
        },
        take: videosLimit
      })
    ])

    // 統計情報をまとめる
    const stats = {
      totalVideos,
      totalUsers,
      totalViews: totalViews._sum.viewCount || 0,
      recentUploads,
      videosByStatus: videosByStatus.reduce((acc, item) => {
        acc[item.status.toLowerCase()] = item._count.id
        return acc
      }, {} as Record<string, number>),
      videosByVisibility: videosByVisibility.reduce((acc, item) => {
        acc[item.visibility.toLowerCase()] = item._count.id
        return acc
      }, {} as Record<string, number>),
      usersByAuthProvider: usersByAuthProvider.reduce((acc, item) => {
        acc[item.authProvider.toLowerCase()] = item._count.id
        return acc
      }, {} as Record<string, number>),
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item.role.toLowerCase()] = item._count.id
        return acc
      }, {} as Record<string, number>),
      
      // 認証ユーザー視聴統計
      authenticatedUserViewStats: {
        totalAuthenticatedUsers: authUserViewStats.length,
        totalVideosWatchedByAuthUsers: authUserViewStats.reduce((sum, stat) => sum + stat._count.id, 0),
        totalWatchTimeByAuthUsers: authUserViewStats.reduce((sum, stat) => sum + (stat._sum.watchDuration || 0), 0),
        averageCompletionRateByAuthUsers: authUserViewStats.length > 0 
          ? authUserViewStats.reduce((sum, stat) => sum + (parseFloat(stat._avg.completionRate?.toString() || '0')), 0) / authUserViewStats.length
          : 0
      },
      
      // 認証ユーザー別視聴ランキング
      topViewersByAuthentication: Array.isArray(topAuthUsersByViews) 
        ? topAuthUsersByViews.map((user: any) => ({
            displayName: user.display_name,
            username: user.username,
            role: user.role,
            authProvider: user.auth_provider,
            videosWatched: parseInt(user.videos_watched),
            totalWatchTime: parseInt(user.total_watch_time || 0),
            averageCompletionRate: user.avg_completion_rate 
              ? Math.round(parseFloat(user.avg_completion_rate) * 100) / 100
              : 0,
            lastActivity: user.last_activity
          }))
        : [],
      topCategories: topCategories.map(category => ({
        id: category.id,
        name: category.name,
        videoCount: category._count.videos
      })),
      topTags: topTags.map(tag => ({
        id: tag.id,
        name: tag.name,
        videoCount: tag._count.videos
      })),
      recentViews: recentViewLogs,
      // 日別視聴数（過去30日間）
      dailyViews: dailyViewLogs.reduce((acc, log) => {
        const date = new Date(log.viewedAt).toISOString().split('T')[0]
        acc[date] = (acc[date] || 0) + log._count.id
        return acc
      }, {} as Record<string, number>),
      // 視聴時間統計
      watchTimeAnalytics: {
        averageWatchDuration: Math.round(Number(watchTimeStats._avg.watchDuration) || 0),
        averageCompletionRate: Math.round((Number(watchTimeStats._avg.completionRate) || 0) * 100) / 100,
        totalWatchTime: Math.round(Number(watchTimeStats._sum.watchDuration) || 0)
      },
      // 人気動画
      topVideos: topVideos.map(video => ({
        id: video.videoId,
        title: video.title,
        viewCount: video.viewCount,
        uploader: video.uploader.displayName
      })),
      lastUpdated: new Date().toISOString(),
      cached: false
    }

    // キャッシュに保存
    setCachedData(cacheKey, stats)

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Stats API Error:', error)
    return NextResponse.json(
      { success: false, error: '統計情報の取得に失敗しました' },
      { status: 500 }
    )
  }
} 