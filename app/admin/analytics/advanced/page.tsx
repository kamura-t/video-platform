'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  TrendingUp,
  Eye,
  Users,
  ArrowLeft,
  RefreshCw,
  Activity,
  Clock,
  Building,
  PlayCircle,
  Star,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'

// チャートコンポーネントをインポート
import { ChartJSPieChart, ChartJSLineChart } from '@/components/charts/ChartJSComponents'

interface AdvancedAnalyticsData {
  summary?: {
    totalViews: number
    uniqueViewers: number
    totalWatchTime: number
    avgSessionDuration: number
  }
  topVideos?: Array<{
    id: string
    title: string
    recentViews: number
    avgWatchDuration: number
    uploaderName: string
  }>
  topCategories?: Array<{
    id: number
    name: string
    color: string
    recentViews: number
  }>
  viewTrends?: Array<{
    date: string
    views: number
    unique_viewers: number
    total_watch_time: number
  }>
  deviceStats?: {
    deviceTypes: Record<string, number>
    browsers: Record<string, number>
  }
  userStats?: {
    activeUsers: number
    newUsers: number
    returningUsers: number
    retentionRate: number
  }
  engagement?: {
    avgWatchDuration: number
    avgCompletionRate: number
    totalWatchTime: number
    highCompletionRate: number
    avgViewsPerSession: number
    avgSessionDuration: number
    totalSessions: number
    viewDistribution: {
      highCompletion: number
      mediumCompletion: number
      lowCompletion: number
    }
  }
  userBehavior?: {
    sessionDistribution: {
      singleVideo: number
      moderate: number
      highEngagement: number
    }
    avgVideosPerSession: number
    maxVideosPerSession: number
    viewEngagement: {
      quickExits: number
      shortViews: number
      engagedViews: number
    }
    bounceRate: number
  }
  sessionAnalytics?: {
    hourlyActivity: Array<{
      hour: number
      sessions: number
      views: number
      avgWatchDuration: number
    }>
    peakHours: Array<{
      hour: number
      sessions: number
    }>
  }
  contentInteraction?: {
    newFavorites: number
    newPlaylists: number
    categoryEngagement: Array<{
      categoryName: string
      totalViews: number
      avgWatchDuration: number
      avgCompletionRate: number
    }>
  }
  engagementTrends?: Array<{
    date: string
    avgWatchDuration: number
    avgCompletionRate: number
    uniqueSessions: number
    totalViews: number
    engagementScore: number
  }>
  userSegmentation?: Array<{
    segment: string
    userCount: number
    avgWatchTime: number
    avgCompletionRate: number
  }>
  domainAnalytics?: {
    domains: Array<{
      domain: string
      userCount: number
      activeUsers: number
      totalViews: number
      avgWatchDuration: number
      totalWatchTime: number
      totalFavorites: number
      totalPlaylists: number
      avgCompletionRate: number
      highCompletionViews: number
      engagementScore: number
    }>
    totalDomains: number
    topDomainByUsers: string
    topDomainByEngagement: string
  }
  departmentAnalytics?: Array<{
    department: string
    userCount: number
    activeUsers: number
    totalViews: number
    avgWatchDuration: number
    avgCompletionRate: number
    engagementRate: number
  }>
  userActivityLevels?: Array<{
    activityLevel: string
    userCount: number
    avgWatchDuration: number
    avgCompletionRate: number
  }>
  userRoleDistribution?: Array<{
    role: string
    userCount: number
  }>
  topContributors?: Array<{
    id: number
    displayName: string
    role: string
    videoCount: number
  }>
  // ドメイン別視聴データ
  domainVideos?: Record<string, Array<{
    videoId: string
    title: string
    thumbnailUrl: string
    duration: number
    createdAt: string
    totalViews: number
    domainViews: number
    uniqueViewers: number
    avgCompletionRate: number
    avgWatchDuration: number
  }>>
  domainSummary?: Array<{
    domain: string
    totalUsers: number
    activeViewers: number
    videosWatched: number
    totalViews: number
  }>
  totalDomains?: number
  totalVideos?: number
}

// COLORS定数は不要（個別コンポーネントで定義）

export default function AdvancedAnalytics() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<AdvancedAnalyticsData>({})
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')
  const [currentTab, setCurrentTab] = useState('overview')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  const fetchAdvancedAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/admin/analytics/advanced?period=${period}&type=${currentTab}`, {
        method: 'GET',
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`高度な分析データの取得に失敗しました (${response.status})`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || '分析データの取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch advanced analytics:', error)
      // エラー時は空のデータを設定
      setData({})
    } finally {
      setLoading(false)
    }
  }, [period, currentTab])

  useEffect(() => {
    if (isAuthenticated) {
      fetchAdvancedAnalytics()
    }
  }, [isAuthenticated, fetchAdvancedAnalytics])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}時間${minutes}分`
    }
    return `${minutes}分`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">認証が必要です</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/analytics">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  統計・分析に戻る
                </Link>
              </Button>
              <div className="h-6 w-px bg-border mx-2" />
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-semibold">高度な分析・インサイト</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">過去7日</SelectItem>
                  <SelectItem value="30d">過去30日</SelectItem>
                  <SelectItem value="90d">過去90日</SelectItem>
                  <SelectItem value="1y">過去1年</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{user?.displayName || user?.username}</span>
                <Badge variant="secondary" className="ml-2">
                  {user?.role === 'admin' ? '管理者' : '投稿者'}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchAdvancedAnalytics}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                更新
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">概要</TabsTrigger>
            <TabsTrigger value="engagement">エンゲージメント</TabsTrigger>
            <TabsTrigger value="videos">動画分析</TabsTrigger>
            <TabsTrigger value="users">ユーザー分析</TabsTrigger>
            <TabsTrigger value="domain-videos">ドメイン別視聴</TabsTrigger>
          </TabsList>

          {/* 概要タブ */}
          <TabsContent value="overview" className="space-y-6">
            {/* サマリーカード */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">総視聴数</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : formatNumber(data.summary?.totalViews || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    選択期間内の総視聴回数
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ユニーク視聴者</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : formatNumber(data.summary?.uniqueViewers || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    個別の視聴者数
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">総視聴時間</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : `${data.summary?.totalWatchTime || 0}h`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    累計視聴時間
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">平均セッション時間</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : formatDuration(data.summary?.avgSessionDuration || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1セッションあたりの視聴時間
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 視聴トレンドグラフ */}
            <Card>
              <CardHeader>
                <CardTitle>視聴トレンド</CardTitle>
                <CardDescription>日別の視聴数と視聴者数の推移</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  {!data?.viewTrends || !Array.isArray(data.viewTrends) || data.viewTrends.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <p className="text-muted-foreground">
                          {!data ? 'データを読み込み中...' : 'データが見つかりません'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ChartJSLineChart data={data.viewTrends} />
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* デバイス分析 */}
              <Card>
                <CardHeader>
                  <CardTitle>デバイス別視聴</CardTitle>
                  <CardDescription>デバイスタイプ別の視聴数分布</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {!data?.deviceStats?.deviceTypes || typeof data.deviceStats.deviceTypes !== 'object' ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <p className="text-muted-foreground">
                            {!data ? 'データを読み込み中...' : 'デバイスデータが見つかりません'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <ChartJSPieChart data={Object.entries(data.deviceStats.deviceTypes).map(([key, value]) => ({
                        name: key === 'mobile' ? 'モバイル' : 
                              key === 'desktop' ? 'デスクトップ' : 
                              key === 'tablet' ? 'タブレット' : 'その他',
                        value
                      }))} />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 人気カテゴリ */}
              <Card>
                <CardHeader>
                  <CardTitle>人気カテゴリ</CardTitle>
                  <CardDescription>カテゴリ別視聴数ランキング</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topCategories?.slice(0, 8).map((category, index) => (
                      <div key={category.id} className="flex items-center space-x-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" 
                             style={{ backgroundColor: category.color || '#8884d8' }}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{category.name}</div>
                          <div className="text-sm text-muted-foreground">{category.recentViews} 回視聴</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* エンゲージメントタブ */}
          <TabsContent value="engagement" className="space-y-6">
            {/* 基本エンゲージメント指標 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">平均視聴時間</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : formatDuration(data.engagement?.avgWatchDuration || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1回あたりの平均視聴時間
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">平均完了率</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : `${data.engagement?.avgCompletionRate || 0}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    動画を最後まで視聴した割合
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">セッション時間</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : formatDuration(data.engagement?.avgSessionDuration || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1セッションあたりの平均時間
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">セッション動画数</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : `${data.engagement?.avgViewsPerSession || 0}`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    1セッションあたりの視聴動画数
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 視聴品質分析 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>視聴品質分布</CardTitle>
                  <CardDescription>完了率別の視聴数分布</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">高品質視聴 (90%+)</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-green-200 rounded-full">
                          <div 
                            className="h-full bg-green-500 rounded-full" 
                            style={{ width: `${data.engagement?.highCompletionRate || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {data.engagement?.viewDistribution?.highCompletion || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">中品質視聴 (50-90%)</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-yellow-200 rounded-full">
                          <div 
                            className="h-full bg-yellow-500 rounded-full" 
                            style={{ width: `${Math.round((data.engagement?.viewDistribution?.mediumCompletion || 0) / Math.max(1, (data.engagement?.viewDistribution?.highCompletion || 0) + (data.engagement?.viewDistribution?.mediumCompletion || 0) + (data.engagement?.viewDistribution?.lowCompletion || 0)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {data.engagement?.viewDistribution?.mediumCompletion || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">低品質視聴 (50%未満)</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-red-200 rounded-full">
                          <div 
                            className="h-full bg-red-500 rounded-full" 
                            style={{ width: `${Math.round((data.engagement?.viewDistribution?.lowCompletion || 0) / Math.max(1, (data.engagement?.viewDistribution?.highCompletion || 0) + (data.engagement?.viewDistribution?.mediumCompletion || 0) + (data.engagement?.viewDistribution?.lowCompletion || 0)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {data.engagement?.viewDistribution?.lowCompletion || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ユーザー行動分析</CardTitle>
                  <CardDescription>セッション別エンゲージメントレベル</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">高エンゲージメント (5動画以上)</span>
                      <span className="text-sm font-medium">
                        {data.userBehavior?.sessionDistribution?.highEngagement || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">中エンゲージメント (2-5動画)</span>
                      <span className="text-sm font-medium">
                        {data.userBehavior?.sessionDistribution?.moderate || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">単発視聴 (1動画)</span>
                      <span className="text-sm font-medium">
                        {data.userBehavior?.sessionDistribution?.singleVideo || 0}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">バウンス率</span>
                        <span className="text-sm font-bold text-red-600">
                          {data.userBehavior?.bounceRate || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* エンゲージメントトレンド */}
            <Card>
              <CardHeader>
                <CardTitle>エンゲージメントトレンド</CardTitle>
                <CardDescription>日別のエンゲージメント指標推移</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {!data?.engagementTrends || !Array.isArray(data.engagementTrends) || data.engagementTrends.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <p className="text-muted-foreground">
                          {!data ? 'データを読み込み中...' : 'エンゲージメントデータが見つかりません'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ChartJSLineChart data={data.engagementTrends.map(item => ({
                      date: item.date,
                      views: item.avgWatchDuration,
                      unique_viewers: item.avgCompletionRate
                    }))} />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ユーザーセグメンテーション */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>ユーザーセグメンテーション</CardTitle>
                  <CardDescription>視聴行動別ユーザー分類</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.userSegmentation?.map((segment: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div>
                          <div className="font-medium">{segment.segment}</div>
                          <div className="text-sm text-muted-foreground">
                            平均視聴時間: {formatDuration(segment.avgWatchTime)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{segment.userCount}</div>
                          <div className="text-sm text-muted-foreground">{segment.avgCompletionRate}% 完了率</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>コンテンツインタラクション</CardTitle>
                  <CardDescription>期間内のユーザーアクション</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">新規お気に入り</span>
                      <span className="text-lg font-bold">{data.contentInteraction?.newFavorites || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">新規プレイリスト</span>
                      <span className="text-lg font-bold">{data.contentInteraction?.newPlaylists || 0}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="text-sm font-medium mb-2">人気カテゴリ</div>
                      <div className="space-y-2">
                        {data.contentInteraction?.categoryEngagement?.slice(0, 3).map((category: any, index: number) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span>{category.categoryName}</span>
                            <span className="font-medium">{category.totalViews} 視聴</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 時間別アクティビティ */}
            <Card>
              <CardHeader>
                <CardTitle>時間別アクティビティ</CardTitle>
                <CardDescription>24時間のセッション分布とピーク時間</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">ピーク時間帯</h4>
                    <div className="space-y-2">
                      {data.sessionAnalytics?.peakHours?.map((peak: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800">
                          <span className="text-sm">{peak.hour}:00 - {peak.hour + 1}:00</span>
                          <span className="text-sm font-medium">{peak.sessions} セッション</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-3">時間別視聴傾向</h4>
                    <div className="h-32 flex items-end justify-between space-x-1">
                      {data.sessionAnalytics?.hourlyActivity?.slice(0, 12).map((hour: any, index: number) => (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div 
                            className="w-full bg-blue-200 dark:bg-blue-800 rounded-t"
                            style={{ 
                              height: `${Math.max(4, (hour.sessions / Math.max(...(data.sessionAnalytics?.hourlyActivity || []).map((h: any) => h.sessions || 0), 1)) * 100)}%`
                            }}
                          />
                          <span className="text-xs mt-1">{hour.hour}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 動画分析タブ */}
          <TabsContent value="videos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>トップパフォーマンス動画</CardTitle>
                <CardDescription>期間内で最も視聴された動画</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.topVideos?.slice(0, 10).map((video, index) => (
                    <div key={video.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{video.title}</div>
                        <div className="text-sm text-muted-foreground">
                          アップロード者: {video.uploaderName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatNumber(video.recentViews)} 回視聴</div>
                        <div className="text-sm text-muted-foreground">
                          平均視聴: {formatDuration(video.avgWatchDuration || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ユーザー分析タブ */}
          <TabsContent value="users" className="space-y-6">
            {/* ユーザー基本統計 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">アクティブユーザー</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : formatNumber(data.userStats?.activeUsers || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    期間内のアクティブユーザー数
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">新規ユーザー</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : formatNumber(data.userStats?.newUsers || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    期間内の新規登録ユーザー
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">ドメイン数</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : (data.domainAnalytics?.totalDomains || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    登録されている組織ドメイン数
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">リテンション率</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : `${data.userStats?.retentionRate || 0}%`}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ユーザー継続利用率
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ドメイン別分析 */}
            <Card>
              <CardHeader>
                <CardTitle>ドメイン別ユーザー分析</CardTitle>
                <CardDescription>
                  組織・企業ドメイン別の利用状況とエンゲージメント（2名以上の組織のみ表示）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* サマリー情報 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="text-sm text-muted-foreground">最多ユーザー組織</div>
                      <div className="text-lg font-semibold">
                        {data.domainAnalytics?.topDomainByUsers || 'データなし'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">最高エンゲージメント組織</div>
                      <div className="text-lg font-semibold">
                        {data.domainAnalytics?.topDomainByEngagement || 'データなし'}
                      </div>
                    </div>
                  </div>

                  {/* ドメインリスト */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data.domainAnalytics?.domains?.map((domain: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-lg">{domain.domain}</div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">エンゲージメント</div>
                              <div className="font-bold text-lg">{domain.engagementScore}%</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">総ユーザー数</div>
                            <div className="font-semibold">{domain.userCount}名</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">アクティブユーザー</div>
                            <div className="font-semibold">{domain.activeUsers}名</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">総視聴数</div>
                            <div className="font-semibold">{formatNumber(domain.totalViews)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">平均視聴時間</div>
                            <div className="font-semibold">{formatDuration(domain.avgWatchDuration)}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
                          <div>
                            <div className="text-muted-foreground">総視聴時間</div>
                            <div className="font-semibold">{domain.totalWatchTime}h</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">お気に入り</div>
                            <div className="font-semibold">{domain.totalFavorites}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">プレイリスト</div>
                            <div className="font-semibold">{domain.totalPlaylists}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">完了率</div>
                            <div className="font-semibold">{domain.avgCompletionRate}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 部門別・アクティビティレベル分析 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>部門別利用状況</CardTitle>
                  <CardDescription>部門別のユーザー数とエンゲージメント</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {data.departmentAnalytics?.map((dept: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div>
                          <div className="font-medium">{dept.department}</div>
                          <div className="text-sm text-muted-foreground">
                            {dept.userCount}名 (アクティブ: {dept.activeUsers}名)
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{dept.engagementRate}%</div>
                          <div className="text-sm text-muted-foreground">エンゲージメント率</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ユーザーアクティビティレベル</CardTitle>
                  <CardDescription>視聴頻度によるユーザー分類</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.userActivityLevels?.map((level: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                        <div>
                          <div className="font-medium">{level.activityLevel}</div>
                          <div className="text-sm text-muted-foreground">
                            平均視聴: {formatDuration(level.avgWatchDuration)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{level.userCount}名</div>
                          <div className="text-sm text-muted-foreground">{level.avgCompletionRate}% 完了率</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 役割別・トップ貢献者 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>ユーザー役割分布</CardTitle>
                  <CardDescription>システム内の権限レベル別ユーザー数</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    {!data?.userRoleDistribution || data.userRoleDistribution.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">データがありません</p>
                      </div>
                    ) : (
                      <ChartJSPieChart data={data.userRoleDistribution.map(role => ({
                        name: role.role === 'ADMIN' ? '管理者' : 
                              role.role === 'CURATOR' ? '投稿者' : 
                              role.role === 'VIEWER' ? '視聴者' : 'その他',
                        value: role.userCount
                      }))} />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>トップ貢献者</CardTitle>
                  <CardDescription>動画投稿数の多いユーザー</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topContributors?.slice(0, 8).map((contributor: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{contributor.displayName}</div>
                            <div className="text-sm text-muted-foreground">
                              {contributor.role === 'ADMIN' ? '管理者' : '投稿者'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{contributor.videoCount}</div>
                          <div className="text-sm text-muted-foreground">動画</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* リアルタイムタブ */}
          <TabsContent value="domain-videos" className="space-y-6">
            {/* ドメイン別視聴分析ヘッダー */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">分析対象ドメイン</CardTitle>
                  <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : (data.totalDomains || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    視聴データのあるドメイン数
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">分析対象動画</CardTitle>
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? '...' : (data.totalVideos || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    期間内に視聴された動画数
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">最大表示数</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">30</div>
                  <p className="text-xs text-muted-foreground">
                    各ドメインの最大表示動画数
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ドメイン別動画リスト */}
            <div className="space-y-8">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">ドメイン別視聴データを読み込み中...</p>
                </div>
              ) : data.domainVideos && Object.keys(data.domainVideos).length > 0 ? (
                Object.entries(data.domainVideos).map(([domain, videos]: [string, any[]]) => {
                  const domainSummary = data.domainSummary?.find((d: any) => d.domain === domain)
                  return (
                    <Card key={domain} className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Building className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">{domain}</h3>
                            <p className="text-sm text-muted-foreground">
                              {domainSummary ? (
                                `${domainSummary.activeViewers}名の視聴者 • ${domainSummary.totalViews}回視聴 • ${domainSummary.videosWatched}本の動画`
                              ) : (
                                `${videos.length}本の人気動画`
                              )}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">{videos.length}本</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videos.map((video: any, index: number) => (
                          <div key={video.videoId} className="bg-background border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 relative">
                                <Link href={`/watch/${video.videoId}`} className="block">
                                  {video.thumbnailUrl ? (
                                    <img 
                                      src={video.thumbnailUrl} 
                                      alt={video.title}
                                      className="w-20 h-12 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="w-20 h-12 bg-muted rounded flex items-center justify-center">
                                      <PlayCircle className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 rounded">
                                    #{index + 1}
                                  </div>
                                </Link>
                              </div>
                              <div className="flex-1 min-w-0">
                                <Link 
                                  href={`/watch/${video.videoId}`} 
                                  className="text-sm font-medium text-primary hover:text-primary/80 truncate flex items-center gap-1 mb-2 transition-colors group"
                                  title={`${video.title} - クリックして視聴`}
                                >
                                  <span className="truncate">{video.title}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                                </Link>
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  <div className="flex justify-between">
                                    <span>ドメイン視聴:</span>
                                    <span className="font-medium">{video.domainViews}回</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>視聴者数:</span>
                                    <span className="font-medium">{video.uniqueViewers}人</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>完了率:</span>
                                    <span className="font-medium">{video.avgCompletionRate}%</span>
                                  </div>
                                  {video.duration > 0 && (
                                    <div className="flex justify-between">
                                      <span>時間:</span>
                                      <span className="font-medium">
                                        {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )
                })
              ) : (
                <div className="text-center py-12">
                  <PlayCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">視聴データがありません</h3>
                  <p className="text-muted-foreground">選択された期間内にドメイン別の視聴データが見つかりませんでした</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}