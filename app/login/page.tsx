'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, ArrowLeft, Video } from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import * as LucideIcons from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [siteSettings, setSiteSettings] = useState({
    siteTitle: 'GVA Video Platform',
    siteLogoIcon: 'Video',
    siteLogoImage: null,
    allowedGoogleDomains: [] as string[]
  })

  // サイト設定を取得し、URLパラメータのエラーをチェック
  useEffect(() => {
    const fetchSiteSettings = async () => {
      try {
        const response = await fetch('/api/settings/public');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setSiteSettings({
              siteTitle: data.data.site_title || 'Video Archive',
              siteLogoIcon: data.data.site_logo_icon || 'Video',
              siteLogoImage: data.data.site_logo_image || '',
              allowedGoogleDomains: data.data.allowed_google_domains || []
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch site settings:', error);
      }
    };


    fetchSiteSettings();
  }, []);

  // URLパラメータのエラーチェック（siteSettingsが更新された後）
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    
    if (errorParam && siteSettings.allowedGoogleDomains.length > 0) {
      const errorMessages: { [key: string]: string } = {
        'google_auth_failed': 'Googleログインに失敗しました。もう一度お試しください。',
        'google_auth_cancelled': 'Googleログインがキャンセルされました。',
        'domain_not_allowed': `許可されていないドメインです。`,
        'email_not_verified': 'メールアドレスが確認されていません。Googleアカウントの設定を確認してください。',
        'email_already_exists': 'このメールアドレスは既に別の方法で登録されています。',
        'account_disabled': 'アカウントが無効になっています。管理者にお問い合わせください。'
      };
      
      setError(errorMessages[errorParam] || 'ログインエラーが発生しました。');
      
      // URLからエラーパラメータを削除（ブラウザ履歴を残さない）
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [siteSettings.allowedGoogleDomains]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (data.success) {
        // 認証プロバイダーの状態を更新（既に取得したユーザーデータを使用）
        await login({ email: username, password }, data.user)
        
        // 権限に応じたリダイレクト先を設定
        const redirectPath = data.redirectTo || (data.user?.role === 'VIEWER' ? '/account' : '/admin')
        router.push(redirectPath)
      } else {
        setError(data.error || 'ログインに失敗しました')
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async (role: 'admin' | 'curator' | 'viewer') => {
    const credentials = {
      admin: { username: 'admin', password: 'admin123456' },
      curator: { username: 'curator', password: 'curator123456' },
      viewer: { username: 'viewer', password: 'viewer123456' }
    }
    
    const cred = credentials[role]
    setUsername(cred.username)
    setPassword(cred.password)
    
    // 自動ログイン
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cred),
      })

      const data = await response.json()

      if (data.success) {
        await login({ email: cred.username, password: cred.password }, data.user)
        // 権限に応じたリダイレクト先を設定
        const redirectPath = data.redirectTo || (data.user?.role === 'VIEWER' ? '/account' : '/admin')
        router.push(redirectPath)
      } else {
        setError(data.error || 'ログインに失敗しました')
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            {siteSettings.siteLogoImage ? (
              <img 
                src={siteSettings.siteLogoImage} 
                alt={siteSettings.siteTitle}
                className="h-10 w-10 object-contain"
              />
            ) : (
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                {(() => {
                  const IconComponent = (LucideIcons as any)[siteSettings.siteLogoIcon] || LucideIcons.Video;
                  return <IconComponent className="w-6 h-6 text-primary-foreground" />;
                })()}
              </div>
            )}
            <h1 className="text-2xl font-bold">{siteSettings.siteTitle}</h1>
          </div>
          <p className="text-muted-foreground">ログイン</p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle>ログイン</CardTitle>
            <CardDescription>
              ユーザー名またはメールアドレスでログインしてください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">ユーザー名 / メールアドレス</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin または admin@example.com"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                ログイン
              </Button>
            </form>

            {/* Google Login */}
            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    または
                  </span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = '/api/auth/google/login'}
                disabled={isLoading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                藝大アカウントでログイン
              </Button>
              {/*
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>組織のGoogleアカウントでログインできます（視聴者権限）</p>
                {siteSettings.allowedGoogleDomains.length > 0 && (
                  <p className="text-xs">
                  許可ドメイン: {siteSettings.allowedGoogleDomains.join(', ')}
                  </p>
                )}
              </div>
              */}
            </div>

            {/* Demo Login Buttons */}
            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    デモアカウント
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDemoLogin('admin')}
                  disabled={isLoading}
                  className="w-full"
                >
                  管理者
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDemoLogin('curator')}
                  disabled={isLoading}
                  className="w-full"
                >
                  投稿者
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDemoLogin('viewer')}
                  disabled={isLoading}
                  className="w-full"
                >
                  一般ユーザー
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground text-center space-y-1">
                <p>管理者: admin / admin123456</p>
                <p>投稿者: curator / curator123456</p>
                <p>一般ユーザー: viewer / viewer123456</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center">
          <Link href="/">
            <Button variant="ghost" className="text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              ホームに戻る
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
} 