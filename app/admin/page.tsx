'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Users, 
  Video, 
  BarChart3, 
  Settings, 
  Upload, 
  Eye,
  Calendar,
  TrendingUp,
  Shield,
  LogOut,
  Home,
  Plus,
  PlaySquare,
  Database,
  Clock
} from 'lucide-react'
import Link from 'next/link'

interface DashboardStats {
  totalVideos: number
  totalUsers: number
  totalViews: number
  recentUploads: number
}

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    totalUsers: 0,
    totalViews: 0,
    recentUploads: 0
  })
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // VIEWERロールのユーザーは一般ユーザー用ダッシュボードにリダイレクト
    if (!isLoading && isAuthenticated && user?.role === 'VIEWER') {
      router.push('/account')
      return
    }
  }, [isLoading, isAuthenticated, user, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats()
    }
  }, [isAuthenticated])

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      const response = await fetch('/api/admin/stats', {
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
          recentUploads: result.data.recentUploads
        })
      } else {
        throw new Error(result.error || '統計情報の取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      // エラー時はデフォルト値を設定
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

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }



  const shouldShowLoading = isLoading
  const shouldShowContent = isAuthenticated

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!shouldShowContent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">認証が必要です</p>
        </div>
      </div>
    )
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-semibold">管理画面</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{user?.displayName || user?.username}</span>
                  <Badge variant="secondary" className="ml-2">
                    {user?.role === 'admin' ? '管理者' : '投稿者'}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/">
                    <Home className="w-4 h-4 mr-2" />
                    ホームへ
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  ログアウト
                </Button>
              </div>
            </div>
          </div>
        </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">
            おかえりなさい、{user?.displayName || user?.username}さん
          </h2>
          <p className="text-muted-foreground">
            動画プラットフォームの管理画面です。各種設定や統計情報を確認できます。
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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



        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 動画管理 - 全ユーザー利用可能 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                動画管理
              </CardTitle>
              <CardDescription>
                動画のアップロード、編集、削除を行います
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button className="w-full" asChild>
                  <Link href="/upload">
                    新しい動画をアップロード
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/videos">
                    動画一覧を管理
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/playlists/create">
                    <PlaySquare className="w-4 h-4 mr-2" />
                    プレイリスト作成
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/playlists">
                    プレイリスト管理
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/admin/scheduled-videos">
                    <Calendar className="w-4 h-4 mr-2" />
                    予約投稿管理
                  </Link>
                </Button>

              </div>
            </CardContent>
          </Card>

          {/* ユーザー管理 - 管理者のみ */}
          {user?.role?.toLowerCase() === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  ユーザー管理
                </CardTitle>
                <CardDescription>
                  ユーザーアカウントの管理を行います
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button className="w-full" asChild>
                    <Link href="/admin/users">
                      ユーザー一覧
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/users/create">
                      <Plus className="w-4 h-4 mr-2" />
                      新規ユーザー作成
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 統計・分析 - 管理者のみ */}
          {user?.role?.toLowerCase() === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  統計・分析
                </CardTitle>
                <CardDescription>
                  視聴統計やアクセス解析を確認します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button className="w-full" asChild>
                    <Link href="/admin/analytics">
                      詳細統計を見る
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/analytics/advanced">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      高度な分析・インサイト
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/reports">
                      レポート生成
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* カテゴリ・タグ管理 - 全ユーザー利用可能 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                カテゴリ・タグ管理
              </CardTitle>
              <CardDescription>
                動画のカテゴリとタグを管理します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button className="w-full" asChild>
                  <Link href="/admin/categories">
                    カテゴリ・タグ管理
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* システム設定 - 管理者のみ */}
          {user?.role?.toLowerCase() === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  システム設定
                </CardTitle>
                <CardDescription>
                  プラットフォームの基本設定を管理します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button className="w-full" asChild>
                    <Link href="/admin/settings">
                      一般設定
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* データ管理 - 管理者のみ */}
          {user?.role?.toLowerCase() === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  データ管理
                </CardTitle>
                <CardDescription>
                  システムデータの管理とメンテナンス
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button className="w-full" asChild>
                    <Link href="/admin/view-history-management">
                      <Clock className="w-4 h-4 mr-2" />
                      視聴履歴管理
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/deleted-files">
                      削除済みファイル
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* セキュリティ - 管理者のみ */}
          {user?.role?.toLowerCase() === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  セキュリティ
                </CardTitle>
                <CardDescription>
                  セキュリティ設定とログ監視
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button className="w-full" asChild>
                    <Link href="/admin/security">
                      セキュリティ設定
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/admin/logs">
                      アクセスログ
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </main>
      </div>
    </MainLayout>
  )
} 