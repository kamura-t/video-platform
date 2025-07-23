'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PlaylistEditForm } from '@/components/playlist/playlist-edit-form'

export default function EditPlaylistPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(true)
  const [playlist, setPlaylist] = useState(null)
  const [error, setError] = useState('')

  const playlistId = params.id as string

  // 認証チェック
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  // プレイリスト詳細を取得
  useEffect(() => {
    const fetchPlaylist = async () => {
      if (!playlistId || !isAuthenticated) return

      try {
        setIsLoadingPlaylist(true)
        setError('')

        const response = await fetch(`/api/playlists/${playlistId}`, {
          credentials: 'include'
        })

        const result = await response.json()

        if (result.success) {
          setPlaylist(result.data)
        } else {
          setError(result.error || 'プレイリストの取得に失敗しました')
        }
      } catch (error) {
        console.error('Failed to fetch playlist:', error)
        setError('プレイリストの取得に失敗しました')
      } finally {
        setIsLoadingPlaylist(false)
      }
    }

    fetchPlaylist()
  }, [playlistId, isAuthenticated])

  // プレイリスト更新成功時の処理
  const handleUpdateSuccess = () => {
    // 管理画面のプレイリスト一覧に戻る
    router.push('/admin/playlists')
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

  // 権限チェック
  if (user && !['ADMIN', 'CURATOR'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">アクセス権限がありません</h1>
            <p className="text-muted-foreground">
              このページにアクセスするには管理者またはキュレーター権限が必要です。
            </p>
            <Button onClick={() => router.push('/')}>
              ホームに戻る
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // プレイリスト読み込み中
  if (isLoadingPlaylist) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                戻る
              </Button>
            </div>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // エラー表示
  if (error || !playlist) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.back()}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                戻る
              </Button>
            </div>
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold">プレイリストが見つかりません</h1>
              <p className="text-muted-foreground">
                {error || '指定されたプレイリストは存在しないか、削除されています。'}
              </p>
              <Button onClick={() => router.push('/admin/playlists')}>
                プレイリスト一覧に戻る
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 戻るボタン */}
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              戻る
            </Button>
          </div>

          {/* ページヘッダー */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">プレイリスト編集</h1>
            <p className="text-muted-foreground">
              プレイリストの詳細情報と動画を編集できます
            </p>
          </div>

          {/* プレイリスト編集フォーム */}
          <PlaylistEditForm 
            playlist={playlist}
            onSuccess={handleUpdateSuccess}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </div>
  )
}