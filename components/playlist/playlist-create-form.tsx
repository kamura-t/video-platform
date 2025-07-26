'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDuration } from '@/lib/utils'
import { 
  Plus, 
  Search, 
  Play, 
  Clock, 
  User, 
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  GripVertical,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

interface Video {
  id: string
  title: string
  description: string
  thumbnail: string
  duration: number
  viewCount: number
  author: {
    id: string
    name: string
    avatar?: string
  }
  uploadedAt: string
}

interface PlaylistCreateFormProps {
  onSuccess?: (playlistId: string) => void
  onCancel?: () => void
}

// 動画データの正規化処理を共通化
const normalizeVideoData = (video: any): Video => ({
  id: video.id || video.videoId,
  title: video.title,
  description: video.description,
  thumbnail: video.thumbnail || video.thumbnailUrl,
  duration: video.duration || 0,
  viewCount: video.viewCount || video.views || 0,
  author: {
    id: video.author?.id || video.uploader?.id,
    name: video.author?.name || video.uploader?.displayName || video.uploader?.username,
    avatar: video.author?.avatar || video.uploader?.profileImageUrl
  },
  uploadedAt: video.uploadedAt || video.createdAt
})

export function PlaylistCreateForm({ onSuccess, onCancel }: PlaylistCreateFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    visibility: 'PUBLIC'
  })
  const [selectedVideos, setSelectedVideos] = useState<Video[]>([])
  const [availableVideos, setAvailableVideos] = useState<Video[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userRole, setUserRole] = useState<string>('')

  // ユーザー情報を取得
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        })
        const result = await response.json()
        if (result.success && result.data?.user) {
          setUserRole(result.data.user.role)
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error)
      }
    }
    fetchUserInfo()
  }, [])

  // 動画を取得する関数
  const fetchVideos = useCallback(async (query?: string) => {
    if (!userRole) {
      return
    }
    
    try {
      setIsSearching(true)
      setError('')
      
      // プレイリスト作成での動画取得
      const includePrivate = formData.visibility !== 'PUBLIC'
      // ADMINは全ての動画、CURATORは自分の動画のみ
      const myVideosOnly = userRole === 'CURATOR'
      
      const params = new URLSearchParams({
        includePrivate: includePrivate.toString(),
        limit: '50'
      })
      
      if (myVideosOnly) {
        params.append('myVideosOnly', 'true')
      }
      
      if (query) {
        params.append('search', query)
      }
      
      const url = `/api/videos?${params.toString()}`
      
      const response = await fetch(url, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      
      if (result.success) {
        const videos = result.data?.videos || result.videos || []
        const normalizedVideos = videos.map(normalizeVideoData)
        setAvailableVideos(normalizedVideos)
      } else {
        setError(result.error || '動画の取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error)
      setError('動画の取得に失敗しました')
    } finally {
      setIsSearching(false)
    }
  }, [formData.visibility, userRole])

  // ユーザーロール取得後に動画を読み込み
  useEffect(() => {
    if (userRole) {
      fetchVideos()
    }
  }, [fetchVideos, userRole])

  // 検索処理（デバウンス）
  useEffect(() => {
    if (!userRole) return // ユーザーロールが取得されるまで待機
    
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchVideos(searchQuery)
      } else {
        fetchVideos()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, fetchVideos, userRole])

  // 動画を選択に追加
  const addVideo = useCallback((video: Video) => {
    setSelectedVideos(prev => prev.some(v => v.id === video.id) ? prev : [...prev, video])
  }, [])

  // 動画を選択から削除
  const removeVideo = useCallback((videoId: string) => {
    setSelectedVideos(prev => prev.filter(v => v.id !== videoId))
  }, [])

  // ドラッグ&ドロップによる並び替え
  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return

    setSelectedVideos(prev => {
      const items = Array.from(prev)
      const [reorderedItem] = items.splice(result.source.index, 1)
      items.splice(result.destination!.index, 0, reorderedItem)
      return items
    })
  }, [])

  // 動画の順序を上に移動
  const moveVideoUp = useCallback((index: number) => {
    setSelectedVideos(prev => {
      if (index === 0) return prev
      const newVideos = [...prev]
      const temp = newVideos[index]
      newVideos[index] = newVideos[index - 1]
      newVideos[index - 1] = temp
      return newVideos
    })
  }, [])

  // 動画の順序を下に移動
  const moveVideoDown = useCallback((index: number) => {
    setSelectedVideos(prev => {
      if (index === prev.length - 1) return prev
      const newVideos = [...prev]
      const temp = newVideos[index]
      newVideos[index] = newVideos[index + 1]
      newVideos[index + 1] = temp
      return newVideos
    })
  }, [])

  // 合計再生時間を計算
  const getTotalDuration = () => {
    return selectedVideos.reduce((total, video) => total + video.duration, 0)
  }

  // フォーム送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.title.trim()) {
      setError('タイトルは必須です')
      return
    }

    if (selectedVideos.length === 0) {
      setError('少なくとも1つの動画を選択してください')
      return
    }

    try {
      setIsCreating(true)
      
      const requestData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        videoIds: selectedVideos.map(v => v.id),
        visibility: formData.visibility
      }
      
      const response = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestData),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess('プレイリストを作成しました')
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(result.data.playlist.id)
          } else {
            router.push(`/watch/${result.data.post.id}`)
          }
        }, 1000)
      } else {
        setError(result.error || 'プレイリストの作成に失敗しました')
      }
    } catch (error) {
      console.error('Failed to create playlist:', error)
      setError('プレイリストの作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本情報 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">タイトル *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="プレイリストのタイトルを入力"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">説明</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="プレイリストの説明を入力（任意）"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="visibility">公開設定</Label>
                <Select 
                  value={formData.visibility} 
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, visibility: value }))
                    // 学外公開に変更した場合、選択された動画をクリア（互換性確保のため）
                    if (value === 'PUBLIC' && formData.visibility === 'PRIVATE') {
                      setSelectedVideos([])
                      setError('公開設定を学外公開に変更したため、選択された動画をクリアしました。学外公開動画のみ選択し直してください。')
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">学外公開</SelectItem>
                    <SelectItem value="PRIVATE">学内限定</SelectItem>
                  </SelectContent>
                </Select>
                {formData.visibility === 'PUBLIC' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    学外公開プレイリストには学外公開動画のみ追加できます
                    {userRole === 'CURATOR' && '（自分の投稿動画から選択）'}
                  </p>
                )}
                {userRole === 'CURATOR' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    あなたが投稿した動画から選択できます
                  </p>
                )}
              </div>
            </div>

            {/* 選択された動画一覧 */}
            {selectedVideos.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>選択された動画 ({selectedVideos.length}個)</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    合計時間: {formatDuration(getTotalDuration())}
                  </div>
                </div>
                
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="selected-videos">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2"
                      >
                        {selectedVideos.map((video, index) => (
                          <Draggable key={video.id} draggableId={video.id.toString()} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 p-2 bg-card border rounded-lg transition-colors ${
                                  snapshot.isDragging ? 'shadow-lg bg-accent' : ''
                                }`}
                              >
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                </div>
                                <div className="text-sm font-medium text-muted-foreground">
                                  {index + 1}
                                </div>
                                <img
                                  src={video.thumbnail}
                                  alt={video.title}
                                  className="w-16 h-9 object-cover rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{video.title}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {formatDuration(video.duration)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveVideoUp(index)}
                                    disabled={index === 0}
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => moveVideoDown(index)}
                                    disabled={index === selectedVideos.length - 1}
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeVideo(video.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}

            {/* 動画検索・選択 */}
            <div className="space-y-4">
              <Label>動画を選択</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="動画を検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                {isSearching ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {availableVideos.map((video) => {
                      const isSelected = selectedVideos.some(v => v.id === video.id)
                      return (
                        <div
                          key={video.id}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                            isSelected ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() =>
                              isSelected ? removeVideo(video.id) : addVideo(video)
                            }
                          />
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="w-20 h-11 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{video.title}</div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{formatDuration(video.duration)}</span>
                              <span>•</span>
                              <span>{video.author.name}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {availableVideos.length === 0 && !isSearching && (
                      <div className="text-center py-8 text-muted-foreground">
                        {error ? (
                          <div className="text-red-600">{error}</div>
                        ) : searchQuery ? (
                          '検索結果が見つかりませんでした'
                        ) : (
                          '利用可能な動画がありません'
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

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

            {/* アクションボタン */}
            <div className="flex justify-end gap-3">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  キャンセル
                </Button>
              )}
              <Button type="submit" disabled={isCreating || selectedVideos.length === 0}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    作成中...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    プレイリスト作成
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 