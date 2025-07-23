'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDuration, formatVideoDate } from '@/lib/utils'
import { 
  Search, 
  Play,
  Clock,
  Video,
  Loader2,
  PlaySquare,
  Eye
} from 'lucide-react'

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
  previewVideos: Array<{
    id: string
    title: string
    thumbnail: string
    duration: number
  }>
  posts: Array<{
    postId: string
    visibility: string
    publishedAt: string
  }>
  createdAt: string
  updatedAt: string
}

interface UserPlaylistsProps {
  userId: string
  userName: string
}

export function UserPlaylists({ userId, userName }: UserPlaylistsProps) {
  const router = useRouter()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('latest')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')

  // プレイリスト取得
  useEffect(() => {
    fetchPlaylists(true)
  }, [userId, searchQuery, sortBy])

  const fetchPlaylists = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true)
        setPage(1)
      }

      const currentPage = reset ? 1 : page
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
        sortBy
      })
      
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/users/${userId}/playlists?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        const newPlaylists = result.playlists || []
        if (reset) {
          setPlaylists(newPlaylists)
        } else {
          setPlaylists(prev => [...prev, ...newPlaylists])
        }
        
        setHasMore(result.pagination.page < result.pagination.totalPages)
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

  // さらに読み込み
  const loadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1)
      fetchPlaylists(false)
    }
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

  // 検索のデバウンス処理
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPlaylists(true)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  return (
    <div className="space-y-6">
      {/* フィルター */}
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

      {/* エラー表示 */}
      {error && (
        <div className="text-center py-8 text-red-600">
          {error}
        </div>
      )}

      {/* プレイリスト一覧 */}
      {loading && playlists.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          プレイリストを読み込み中...
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? '検索結果が見つかりませんでした' : `${userName}さんのプレイリストはまだありません`}
        </div>
      ) : (
        <>
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
                      {formatVideoDate(playlist.createdAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* さらに読み込みボタン */}
          {hasMore && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    読み込み中...
                  </>
                ) : (
                  'さらに表示'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
} 