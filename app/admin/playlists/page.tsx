'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Clock,
  Users,
  Video,
  AlertCircle,
  CheckCircle,
  Loader2,
  PlaySquare
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { MainLayout } from '@/components/layout/main-layout'

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
  const { user } = useAuth()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [creatorFilter, setCreatorFilter] = useState('all')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // プレイリスト一覧取得
  useEffect(() => {
    fetchPlaylists()
  }, [searchQuery, visibilityFilter, creatorFilter])

  const fetchPlaylists = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchQuery) params.append('search', searchQuery)
      if (visibilityFilter !== 'all') params.append('visibility', visibilityFilter)
      if (creatorFilter !== 'all') params.append('creatorId', creatorFilter)
      
      const response = await fetch(`/api/playlists?${params.toString()}`, {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success) {
        setPlaylists(result.data.playlists || [])
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

  // プレイリスト削除
  const handleDelete = async () => {
    if (!selectedPlaylist) return

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/playlists/${selectedPlaylist.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSuccess('プレイリストを削除しました')
        setShowDeleteDialog(false)
        setSelectedPlaylist(null)
        fetchPlaylists()
      } else {
        setError(result.error || 'プレイリストの削除に失敗しました')
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error)
      setError('プレイリストの削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

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
        return <Badge variant="default">学外公開</Badge>
      case 'PRIVATE':
        return <Badge variant="secondary">学内限定</Badge>
      case 'DRAFT':
        return <Badge variant="outline">非公開</Badge>
      default:
        return <Badge variant="outline">{visibility}</Badge>
    }
  }


  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">プレイリスト管理</h1>
            <p className="text-muted-foreground">
              プレイリストの作成・編集・削除を行います
            </p>
          </div>
          <Button onClick={() => router.push('/playlists/create')}>
            <Plus className="h-4 w-4 mr-2" />
            プレイリスト作成
          </Button>
        </div>

      {/* フィルター */}
      <Card>
        <CardHeader>
          <CardTitle>フィルター</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">検索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="プレイリストを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="visibility">公開設定</Label>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="PUBLIC">学外公開</SelectItem>
                  <SelectItem value="PRIVATE">学内限定</SelectItem>
                  <SelectItem value="DRAFT">非公開</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {user?.role === 'ADMIN' && (
              <div>
                <Label htmlFor="creator">作成者</Label>
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    {/* TODO: 作成者一覧を動的に取得 */}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* メッセージ表示 */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* プレイリスト一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>プレイリスト一覧</CardTitle>
          <CardDescription>
            {loading ? 'プレイリストを読み込み中...' : `${playlists.length}個のプレイリスト`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              読み込み中...
            </div>
          ) : (
            <div className="space-y-4">
              {playlists.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? '検索結果が見つかりませんでした' : 'プレイリストがありません'}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {playlists.map((playlist) => (
                    <Card key={playlist.id} className="overflow-hidden">
                      <div className="aspect-video bg-muted relative">
                        <img
                          src={playlist.thumbnail}
                          alt={playlist.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <PlaySquare className="h-8 w-8 text-white" />
                        </div>
                        <div className="absolute top-2 right-2">
                          {getVisibilityBadge(playlist.posts[0]?.visibility || 'DRAFT')}
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <h3 className="font-semibold truncate">{playlist.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
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
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={playlist.creator.avatar} />
                              <AvatarFallback>
                                {playlist.creator.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground">
                              {playlist.creator.name}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(playlist.createdAt)}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/watch/${playlist.posts[0]?.postId}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            表示
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/admin/playlists/${playlist.id}/edit`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                編集
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedPlaylist(playlist)
                                  setShowDeleteDialog(true)
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                削除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 削除確認ダイアログ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プレイリストの削除</DialogTitle>
            <DialogDescription>
              この操作は元に戻せません。本当にプレイリスト「{selectedPlaylist?.title}」を削除しますか？
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  削除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  削除
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  )
} 