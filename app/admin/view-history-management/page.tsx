'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { 
  Clock, 
  Trash2, 
  AlertTriangle, 
  Database, 
  Users, 
  Calendar,
  BarChart3,
  Settings,
  RefreshCw,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { MainLayout } from '@/components/layout/main-layout'

interface CleanupInfo {
  retentionDays: number
  cutoffDate: string
  targetCount: number
  oldestRecordDate: string | null
  newestTargetDate: string | null
  userStats: Array<{
    username: string
    displayName: string
    deleteCount: number
  }>
}

export default function ViewHistoryManagementPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [cleanupInfo, setCleanupInfo] = useState<CleanupInfo | null>(null)
  const [isLoadingInfo, setIsLoadingInfo] = useState(true)
  const [isExecutingCleanup, setIsExecutingCleanup] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated && user?.role !== 'ADMIN') {
      router.push('/')
      return
    }

    if (isAuthenticated && user?.role === 'ADMIN') {
      fetchCleanupInfo()
    }
  }, [isLoading, isAuthenticated, user, router])

  const fetchCleanupInfo = async () => {
    try {
      setIsLoadingInfo(true)
      setError('')
      const response = await fetch('/api/admin/view-history-cleanup')
      if (response.ok) {
        const data = await response.json()
        setCleanupInfo(data.data)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'クリーンアップ情報の取得に失敗しました')
      }
    } catch (error) {
      console.error('クリーンアップ情報取得エラー:', error)
      setError('クリーンアップ情報の取得中にエラーが発生しました')
    } finally {
      setIsLoadingInfo(false)
    }
  }

  const executeCleanup = async () => {
    if (!cleanupInfo || cleanupInfo.targetCount === 0) return

    const confirmMessage = `${cleanupInfo.targetCount}件の視聴履歴を削除します。この操作は取り消せません。実行しますか？`
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      setIsExecutingCleanup(true)
      setError('')
      setCleanupResult(null)

      const response = await fetch('/api/admin/view-history-cleanup', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        setCleanupResult(data.data)
        // 情報を再取得
        await fetchCleanupInfo()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'クリーンアップの実行に失敗しました')
      }
    } catch (error) {
      console.error('クリーンアップ実行エラー:', error)
      setError('クリーンアップの実行中にエラーが発生しました')
    } finally {
      setIsExecutingCleanup(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '不明'
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading || isLoadingInfo) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">読み込み中...</span>
        </div>
      </MainLayout>
    )
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return null
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="w-8 h-8" />
            視聴履歴管理
          </h1>
          <p className="text-muted-foreground mt-2">
            システムの視聴履歴データの管理とクリーンアップを行います
          </p>
        </div>

        {/* エラー表示 */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* クリーンアップ実行結果 */}
        {cleanupResult && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">{cleanupResult.message}</p>
                <div className="text-sm">
                  <p>削除件数: {cleanupResult.deletedCount.toLocaleString()}件</p>
                  <p>処理バッチ数: {cleanupResult.totalBatches}</p>
                  <p>保持期間: {cleanupResult.retentionDays}日間</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 基本情報 */}
        {cleanupInfo && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">保持期間</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{cleanupInfo.retentionDays}</div>
                  <p className="text-xs text-muted-foreground">日間（約{Math.round(cleanupInfo.retentionDays / 365 * 10) / 10}年）</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">削除対象件数</CardTitle>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {cleanupInfo.targetCount.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">件の古い履歴</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">対象ユーザー</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cleanupInfo.userStats.length}
                  </div>
                  <p className="text-xs text-muted-foreground">ユーザー</p>
                </CardContent>
              </Card>
            </div>

            {/* 削除対象の詳細情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  削除対象の詳細
                </CardTitle>
                <CardDescription>
                  {formatDate(cleanupInfo.cutoffDate)} より古い視聴履歴が削除対象です
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">最も古い対象レコード</Label>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(cleanupInfo.oldestRecordDate)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">最新の対象レコード</Label>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(cleanupInfo.newestTargetDate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ユーザー別統計 */}
            {cleanupInfo.userStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    ユーザー別削除対象件数（上位20位）
                  </CardTitle>
                  <CardDescription>
                    削除対象となる視聴履歴をユーザー別に表示
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {cleanupInfo.userStats.map((stat, index) => (
                      <div key={stat.username} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{index + 1}</Badge>
                          <div>
                            <p className="font-medium">{stat.displayName}</p>
                            <p className="text-sm text-muted-foreground">@{stat.username}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-orange-600">
                            {stat.deleteCount.toLocaleString()}件
                          </p>
                          <p className="text-xs text-muted-foreground">削除対象</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* アクションボタン */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  操作
                </CardTitle>
                <CardDescription>
                  視聴履歴のクリーンアップを実行できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={fetchCleanupInfo}
                    variant="outline"
                    disabled={isLoadingInfo}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    情報を更新
                  </Button>

                  <Button
                    onClick={executeCleanup}
                    variant="destructive"
                    disabled={isExecutingCleanup || cleanupInfo.targetCount === 0}
                  >
                    {isExecutingCleanup ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    {cleanupInfo.targetCount === 0 
                      ? '削除対象なし' 
                      : `${cleanupInfo.targetCount.toLocaleString()}件を削除`
                    }
                  </Button>
                </div>

                {cleanupInfo.targetCount > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>注意:</strong> 削除された視聴履歴は復元できません。
                      実行前に必要なデータのバックアップを取ることを推奨します。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  )
}