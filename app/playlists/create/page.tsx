'use client'

import { useRouter } from 'next/navigation'
import { PlaylistCreateForm } from '@/components/playlist/playlist-create-form'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { useEffect } from 'react'
import { canManagePlaylists } from '@/lib/auth'

export default function CreatePlaylistPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()

  // 認証チェック
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    } else if (!isLoading && isAuthenticated && user && !canManagePlaylists(user.role)) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, user, router])

  // プレイリスト作成成功時の処理
  const handleCreateSuccess = (playlistId: string) => {
    // 作成したプレイリストの視聴ページにリダイレクト
    router.push(`/playlists`)
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
            <h1 className="text-3xl font-bold">プレイリスト作成</h1>
            <p className="text-muted-foreground">
              複数の動画をまとめてプレイリストを作成しましょう
            </p>
          </div>

          {/* プレイリスト作成フォーム */}
          <PlaylistCreateForm 
            onSuccess={handleCreateSuccess}
            onCancel={() => router.back()}
          />
        </div>
      </div>
    </div>
  )
} 