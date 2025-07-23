'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Header } from '@/components/layout/header'
import { 
  Plus, 
  Search, 
  Clock,
  Video,
  Loader2,
  PlaySquare,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { canManagePlaylists } from '@/lib/auth'

interface Playlist {
  id: string
  title: string
  description: string
  thumbnail: string
  videoCount: number
  totalDuration: number
  creator: {
    id: string
    name: string
    username: string
    avatar?: string
    department?: string
  }
  posts: Array<{
    postId: string
    visibility: string
    publishedAt: string
  }>
  createdAt: string
  updatedAt: string
}

export default function PlaylistsPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('latest')
  const [error, setError] = useState('')

  // 認証チェック
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    } else if (!isLoading && isAuthenticated && user && !canManagePlaylists(user.role)) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, user, router])

  // プレイリスト取得
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchPlaylists()
    }
  }, [isAuthenticated, user, searchQuery, sortBy])

  const fetchPlaylists = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        creatorId: user!.id.toString(),
        sortBy
      })
      
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/playlists?${params.toString()}`, {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success) {
        setPlaylists(result.data.playlists || [])
        setError('')
      } else {
        setError('プレイリストの取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error)
      setError('プレイリストの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 検索のデバウンス処理
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isAuthenticated && user) {
        fetchPlaylists()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // 時間フォーマット
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // 日付フォーマット
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // 公開設定のバッジ
  const getVisibilityBadge = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC':
        return <Badge variant="default" className="text-xs">学外公開</Badge>
      case 'PRIVATE':
        return <Badge variant="secondary" className="text-xs">学内限定</Badge>
      case 'DRAFT':
        return <Badge variant="outline" className="text-xs">非公開</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{visibility}</Badge>
    }
  }

  // 認証中またはユーザー情報読み込み中
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* ページヘッダー */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">マイプレイリスト</h1>
              <p className="text-muted-foreground">
                あなたが作成したプレイリストを管理します
              </p>
            </div>
            {user && canManagePlaylists(user.role) && (
              <Button onClick={() => router.push('/playlists/create')}>
                <Plus className="h-4 w-4 mr-2" />
                プレイリスト作成
              </Button>
            )}
          </div>

          {/* 検索・フィルター */}
          <Card>
            <CardHeader>
              <CardTitle>検索・フィルター</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="プレイリストを検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-[200px]">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">最新順</SelectItem>
                      <SelectItem value="title">タイトル順</SelectItem>
                      <SelectItem value="videos">動画数順</SelectItem>
                      <SelectItem value="duration">再生時間順</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* エラー表示 */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* プレイリスト一覧 */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              プレイリストを読み込み中...
            </div>
          ) : playlists.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                    <PlaySquare className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">プレイリストがありません</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    {searchQuery 
                      ? '検索条件に一致するプレイリストが見つかりませんでした。' 
                      : 'まだプレイリストを作成していません。最初のプレイリストを作成してみましょう。'
                    }
                  </p>
                  {!searchQuery && user && canManagePlaylists(user.role) && (
                    <Button onClick={() => router.push('/playlists/create')}>
                      <Plus className="h-4 w-4 mr-2" />
                      プレイリスト作成
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {playlists.map((playlist) => (
                <Card 
                  key={playlist.id} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => router.push(`/watch/${playlist.posts[0]?.postId}`)}
                >
                  <div className="aspect-video bg-muted relative">
                    <img
                      src={playlist.thumbnail}
                      alt={playlist.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlaySquare className="h-12 w-12 text-white" />
                    </div>
                    <div className="absolute top-2 right-2">
                      {getVisibilityBadge(playlist.posts[0]?.visibility || 'DRAFT')}
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                      {playlist.videoCount}本
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                        {playlist.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                        {playlist.description || '説明なし'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Video className="h-4 w-4" />
                          {playlist.videoCount}本
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(playlist.totalDuration)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(playlist.createdAt)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 