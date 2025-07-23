'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart3, 
  TrendingUp,
  Eye,
  Users,
  Video,
  ArrowLeft,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'

interface AnalyticsStats {
  totalVideos: number
  totalUsers: number
  totalViews: number
  recentUploads: number
  videosByStatus?: Record<string, number>
  videosByVisibility?: Record<string, number>
  usersByRole?: Record<string, number>
  topCategories?: Array<{
    id: number
    name: string
    videoCount: number
  }>
  topTags?: Array<{
    id: number
    name: string
    videoCount: number
  }>
  recentViews?: number
  dailyViews?: Record<string, number>
  watchTimeAnalytics?: {
    averageWatchDuration: number
    averageCompletionRate: number
    totalWatchTime: number
  }
  topVideos?: Array<{
    id: string
    title: string
    viewCount: number
    uploader: string
  }>
  lastUpdated?: string
  cached?: boolean
  cacheAge?: number
}

export default function AdminAnalytics() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AnalyticsStats>({
    totalVideos: 0,
    totalUsers: 0,
    totalViews: 0,
    recentUploads: 0
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [tagsLimit, setTagsLimit] = useState(10)
  const [videosLimit, setVideosLimit] = useState(10)
  const [categoriesLimit, setCategoriesLimit] = useState(10)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats()
    }
  }, [isAuthenticated, tagsLimit, videosLimit, categoriesLimit])

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      const response = await fetch(`/api/admin/stats?tagsLimit=${tagsLimit}&videosLimit=${videosLimit}&categoriesLimit=${categoriesLimit}`, {
        method: 'GET',
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('統計情報の取得に失敗しました')
      }
      
      const result = await response.json()
      
      if (result.success) {
        setStats({
          totalVideos: result.data.totalVideos,
          totalUsers: result.data.totalUsers,
          totalViews: result.data.totalViews,
          recentUploads: result.data.recentUploads,
          videosByStatus: result.data.videosByStatus,
          videosByVisibility: result.data.videosByVisibility,
          usersByRole: result.data.usersByRole,
          topCategories: result.data.topCategories,
          topTags: result.data.topTags,
          recentViews: result.data.recentViews,
          dailyViews: result.data.dailyViews,
          watchTimeAnalytics: result.data.watchTimeAnalytics,
          topVideos: result.data.topVideos,
          lastUpdated: result.data.lastUpdated,
          cached: result.data.cached,
          cacheAge: result.data.cacheAge
        })
      } else {
        throw new Error(result.error || '統計情報の取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      setStats({
        totalVideos: 0,
        totalUsers: 0,
        totalViews: 0,
        recentUploads: 0
      })
    } finally {
      setStatsLoading(false)
    }
  }

  const handleRefresh = () => {
    setStatsLoading(true)
    fetch(`/api/admin/stats?t=${Date.now()}&tagsLimit=${tagsLimit}&videosLimit=${videosLimit}&categoriesLimit=${categoriesLimit}`, {
      method: 'GET',
      credentials: 'include'
    }).then(response => response.json())
      .then(result => {
        if (result.success) {
          setStats({
            totalVideos: result.data.totalVideos,
            totalUsers: result.data.totalUsers,
            totalViews: result.data.totalViews,
            recentUploads: result.data.recentUploads,
            videosByStatus: result.data.videosByStatus,
            videosByVisibility: result.data.videosByVisibility,
            usersByRole: result.data.usersByRole,
            topCategories: result.data.topCategories,
            topTags: result.data.topTags,
            recentViews: result.data.recentViews,
            dailyViews: result.data.dailyViews,
            watchTimeAnalytics: result.data.watchTimeAnalytics,
            topVideos: result.data.topVideos,
            lastUpdated: result.data.lastUpdated,
            cached: result.data.cached,
            cacheAge: result.data.cacheAge
          })
        }
      })
      .finally(() => setStatsLoading(false))
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
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  ダッシュボードに戻る
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h1 className="text-xl font-semibold">統計・分析</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{user?.displayName || user?.username}</span>
                <Badge variant="secondary" className="ml-2">
                  {user?.role === 'admin' ? '管理者' : '投稿者'}
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={statsLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
                更新
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 基本統計情報 */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">基本統計情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総動画数</CardTitle>
                <Video className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats.totalVideos}
                </div>
                <p className="text-xs text-muted-foreground">
                  完了済み動画（公開+プライベート）
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総ユーザー数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats.totalUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  アクティブユーザー
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総視聴数</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats.totalViews}
                </div>
                <p className="text-xs text-muted-foreground">
                  累計視聴回数
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">今月のアップロード</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : stats.recentUploads}
                </div>
                <p className="text-xs text-muted-foreground">
                  新規投稿数
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 詳細統計情報 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">詳細統計情報</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 動画ステータス別 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">動画ステータス別</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.videosByStatus && Object.entries(stats.videosByStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground capitalize">
                        {status === 'completed' ? '完了' : 
                         status === 'processing' ? '処理中' : 
                         status === 'failed' ? '失敗' : 
                         status === 'deleted' ? '削除済み' : status}
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 動画可視性別 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">動画可視性別</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.videosByVisibility && Object.entries(stats.videosByVisibility).map(([visibility, count]) => (
                    <div key={visibility} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {visibility === 'public' ? '公開' : 
                         visibility === 'private' ? 'プライベート' : visibility}
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ユーザー役割別 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">ユーザー役割別</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.usersByRole && Object.entries(stats.usersByRole).map(([role, count]) => (
                    <div key={role} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {role === 'admin' ? '管理者' : 
                         role === 'curator' ? 'キュレーター' : role}
                      </span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 過去7日間の視聴数 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">過去7日間の視聴数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? '...' : (stats.recentViews || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  新しい視聴ログ数
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 人気コンテンツ */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">人気コンテンツ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 人気カテゴリ */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">人気カテゴリ（利用数順）</CardTitle>
                  <Select value={categoriesLimit.toString()} onValueChange={(value) => setCategoriesLimit(parseInt(value))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10件</SelectItem>
                      <SelectItem value="50">50件</SelectItem>
                      <SelectItem value="100">100件</SelectItem>
                      <SelectItem value="200">200件</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.topCategories && stats.topCategories.map((category, index) => (
                    <div key={category.id} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {index + 1}. {category.name}
                      </span>
                      <span className="font-medium">{category.videoCount}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 人気タグ */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">人気タグ（利用数順）</CardTitle>
                  <Select value={tagsLimit.toString()} onValueChange={(value) => setTagsLimit(parseInt(value))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10件</SelectItem>
                      <SelectItem value="50">50件</SelectItem>
                      <SelectItem value="100">100件</SelectItem>
                      <SelectItem value="200">200件</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.topTags && stats.topTags.map((tag, index) => (
                    <div key={tag.id} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {index + 1}. {tag.name}
                      </span>
                      <span className="font-medium">{tag.videoCount}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 視聴統計分析 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">視聴統計分析</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 視聴時間統計 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">視聴時間統計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">平均視聴時間</span>
                    <span className="font-medium">
                      {stats.watchTimeAnalytics ? 
                        `${Math.floor(stats.watchTimeAnalytics.averageWatchDuration / 60)}分${stats.watchTimeAnalytics.averageWatchDuration % 60}秒` : 
                        '---'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">平均完了率</span>
                    <span className="font-medium">
                      {stats.watchTimeAnalytics ? 
                        `${stats.watchTimeAnalytics.averageCompletionRate}%` : 
                        '---'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">総視聴時間</span>
                    <span className="font-medium">
                      {stats.watchTimeAnalytics ? 
                        `${Math.floor(stats.watchTimeAnalytics.totalWatchTime / 3600)}時間` : 
                        '---'
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 人気動画 */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">人気動画（視聴回数順）</CardTitle>
                  <Select value={videosLimit.toString()} onValueChange={(value) => setVideosLimit(parseInt(value))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10件</SelectItem>
                      <SelectItem value="50">50件</SelectItem>
                      <SelectItem value="100">100件</SelectItem>
                      <SelectItem value="200">200件</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.topVideos && stats.topVideos.map((video, index) => (
                    <div key={video.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {index + 1}. {video.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          アップロード者: {video.uploader}
                        </div>
                      </div>
                      <div className="text-sm font-medium ml-4">
                        {video.viewCount} 回視聴
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 更新情報 */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">統計情報更新時刻</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {statsLoading ? '更新中...' : (
                  stats.lastUpdated ? 
                  new Date(stats.lastUpdated).toLocaleString('ja-JP') : 
                  '未更新'
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                最終更新日時
                {stats.cached && (
                  <span className="ml-2 text-blue-600">
                    (キャッシュ: {stats.cacheAge}秒前)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 