'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { Clock, Calendar, PlayCircle, ArrowLeft, Filter } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import Image from 'next/image'

interface ViewHistoryItem {
  id: number
  watchDuration: number | null
  completionRate: number
  lastWatchedAt: string
  video: {
    id: number
    videoId: string
    title: string
    description: string | null
    duration: number | null
    thumbnailUrl: string | null
    createdAt: string
    uploadType: string
    youtubeUrl: string | null
    creator: {
      id: number
      displayName: string
      username: string
    }
    categories: Array<{
      id: number
      name: string
      slug: string
    }>
  }
}

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalCount: number
  limit: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export default function ViewHistoryPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState('lastWatchedAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [minCompletionRate, setMinCompletionRate] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated && user?.role !== 'VIEWER') {
      router.push('/admin')
      return
    }

    if (isAuthenticated && user?.role === 'VIEWER') {
      fetchViewHistory()
    }
  }, [isLoading, isAuthenticated, user, router, currentPage, sortBy, sortOrder, minCompletionRate])

  const fetchViewHistory = async () => {
    try {
      setDataLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        sortBy,
        sortOrder,
        ...(minCompletionRate && { minCompletionRate })
      })

      const response = await fetch(`/api/user/view-history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setViewHistory(data.data.viewHistory)
        setPagination(data.data.pagination)
      } else {
        console.error('視聴履歴の取得に失敗しました')
      }
    } catch (error) {
      console.error('視聴履歴の取得エラー:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '不明'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">読み込み中...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || user?.role !== 'VIEWER') {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/account">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  アカウントに戻る
                </Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Clock className="w-8 h-8" />
              視聴履歴
            </h1>
            <p className="text-muted-foreground mt-2">
              あなたの視聴した動画の履歴を確認できます
            </p>
          </div>

          {/* フィルター */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                フィルター・並び替え
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">並び替え</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lastWatchedAt">最後の視聴日時</SelectItem>
                      <SelectItem value="completionRate">完了率</SelectItem>
                      <SelectItem value="watchDuration">視聴時間</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">順序</label>
                  <Select value={sortOrder} onValueChange={setSortOrder}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">降順</SelectItem>
                      <SelectItem value="asc">昇順</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">最小完了率（%）</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="例: 30"
                    value={minCompletionRate}
                    onChange={(e) => setMinCompletionRate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 統計情報 */}
          {pagination && (
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {pagination.totalCount}件の視聴履歴が見つかりました
              </p>
            </div>
          )}

          {/* 視聴履歴リスト */}
          {dataLoading ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">読み込み中...</div>
            </div>
          ) : viewHistory.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">視聴履歴がありません</h3>
              <p className="text-muted-foreground mb-4">
                動画を視聴すると、ここに履歴が表示されます
              </p>
              <Button asChild>
                <Link href="/">動画を探す</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {viewHistory.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      {/* サムネイル */}
                      <div className="flex-shrink-0">
                        <Link href={`/watch/${item.video.videoId}`}>
                          <div className="relative w-48 h-28 bg-muted rounded-md overflow-hidden cursor-pointer">
                            {item.video.thumbnailUrl ? (
                              <Image
                                src={item.video.thumbnailUrl}
                                alt={item.video.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <PlayCircle className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            {/* 視聴進捗バー */}
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-black/20">
                              <div 
                                className="h-full bg-red-500" 
                                style={{ width: `${item.completionRate}%` }}
                              />
                            </div>
                          </div>
                        </Link>
                      </div>

                      {/* 動画情報 */}
                      <div className="flex-1 min-w-0">
                        <Link href={`/watch/${item.video.videoId}`}>
                          <h3 className="text-lg font-semibold line-clamp-2 hover:text-primary cursor-pointer mb-2">
                            {item.video.title}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span>{item.video.creator.displayName}</span>
                          <span>•</span>
                          <span>{formatDate(item.video.createdAt)}</span>
                        </div>
                        
                        {/* カテゴリ */}
                        {item.video.categories.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {item.video.categories.map((category) => (
                              <Badge key={category.id} variant="secondary" className="text-xs">
                                {category.name}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* 視聴統計 */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>最終視聴: {formatDate(item.lastWatchedAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>視聴時間: {formatDuration(item.watchDuration)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <PlayCircle className="w-4 h-4" />
                            <span>完了率: {Math.round(item.completionRate)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ページネーション */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={!pagination.hasPreviousPage}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                前のページ
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                {pagination.currentPage} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={!pagination.hasNextPage}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                次のページ
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}