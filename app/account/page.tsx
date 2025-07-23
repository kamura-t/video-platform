'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { User, Heart, Clock, Settings, LogOut } from 'lucide-react'
import { getRoleDisplayName } from '@/lib/auth'
import Link from 'next/link'

export default function AccountPage() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const router = useRouter()
  const [viewHistoryCount, setViewHistoryCount] = useState<number>(0)
  const [favoritesCount, setFavoritesCount] = useState<number>(0)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // VIEWERロール以外のユーザーは管理画面にリダイレクト
    if (!isLoading && isAuthenticated && user?.role !== 'VIEWER') {
      router.push('/admin')
      return
    }

    // 統計情報を取得
    if (isAuthenticated && user?.role === 'VIEWER') {
      fetchUserStats()
    }
  }, [isLoading, isAuthenticated, user, router])

  const fetchUserStats = async () => {
    try {
      setStatsLoading(true)
      const response = await fetch('/api/user/view-history/stats')
      if (response.ok) {
        const data = await response.json()
        setViewHistoryCount(data.data?.viewHistoryCount || 0)
        setFavoritesCount(data.data?.favoritesCount || 0)
      }
    } catch (error) {
      console.error('統計情報の取得に失敗:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('ログアウトに失敗しました:', error)
    }
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
        <div className="max-w-4xl mx-auto">
          {/* ヘッダー */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">アカウント</h1>
            <p className="text-muted-foreground mt-2">
              あなたのアカウント情報と設定を管理できます
            </p>
          </div>

          {/* プロフィールカード */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                プロフィール
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={user?.profileImageUrl} />
                  <AvatarFallback>
                    {user?.displayName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{user?.displayName}</h3>
                  <p className="text-muted-foreground">@{user?.username}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      {getRoleDisplayName(user?.role)}
                    </Badge>
                    {user?.department && (
                      <Badge variant="outline">{user.department}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 機能カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* お気に入り */}
            <Link href="/favorites">
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-500" />
                    お気に入り
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    お気に入りに追加した動画を管理
                  </p>
                  <div className="mt-4 text-2xl font-bold text-red-500">
                    {statsLoading ? '...' : favoritesCount}
                  </div>
                  <p className="text-sm text-muted-foreground">動画</p>
                </CardContent>
              </Card>
            </Link>

            {/* 視聴履歴 */}
            <Link href="/view-history">
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    視聴履歴
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    最近視聴した動画の履歴
                  </p>
                  <div className="mt-4 text-2xl font-bold text-blue-500">
                    {statsLoading ? '...' : viewHistoryCount}
                  </div>
                  <p className="text-sm text-muted-foreground">動画</p>
                </CardContent>
              </Card>
            </Link>

          </div>

          {/* アクションボタン */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Button variant="outline" className="flex items-center gap-2" asChild>
              <Link href="/settings">
                <Settings className="w-4 h-4" />
                設定
              </Link>
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 