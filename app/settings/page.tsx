'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft, 
  Save, 
  User, 
  Camera,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  Settings
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'

interface UserProfile {
  id: number
  username: string
  displayName: string
  email: string
  role: string
  department?: string
  bio?: string
  profileImageUrl?: string
  lastLoginAt?: string
  createdAt: string
}

export default function UserSettingsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [settings, setSettings] = useState<{ [key: string]: string }>({})

  // フォームデータ
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    department: '',
    bio: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // 認証チェック
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // VIEWERロールのユーザーは一般ユーザー用ダッシュボードにリダイレクト
    if (!isLoading && isAuthenticated && user?.role === 'VIEWER') {
      // VIEWERロールのユーザーも設定ページにアクセス可能
      return
    }
  }, [isLoading, isAuthenticated, user, router])

  // プロフィール情報取得
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchProfile()
      fetchSettings()
    }
  }, [isAuthenticated, user])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/public')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setSettings(data.data)
        } else {
          setSettings(data)
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success) {
        const userData = result.data.user
        setProfile(userData)
        setFormData({
          displayName: userData.displayName || '',
          email: userData.email || '',
          department: userData.department || '',
          bio: userData.bio || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else {
        setSaveError('プロフィール情報の取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
      setSaveError('プロフィール情報の取得に失敗しました')
    } finally {
      setIsLoadingProfile(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // エラーメッセージをクリア
    if (saveError) setSaveError('')
  }

  const handleSaveProfile = async () => {
    // バリデーション
    if (!formData.displayName.trim()) {
      setSaveError('表示名は必須です')
      return
    }

    if (!formData.email.trim()) {
      setSaveError('メールアドレスは必須です')
      return
    }

    if (formData.bio.length > 500) {
      setSaveError('紹介文は500文字以内で入力してください')
      return
    }

    // パスワード変更のバリデーション
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setSaveError('現在のパスワードを入力してください')
        return
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setSaveError('新しいパスワードと確認用パスワードが一致しません')
        return
      }
      if (formData.newPassword.length < 8) {
        setSaveError('新しいパスワードは8文字以上で入力してください')
        return
      }
    }

    setIsSaving(true)
    setSaveMessage('')
    setSaveError('')

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          displayName: formData.displayName,
          email: formData.email,
          department: formData.department,
          bio: formData.bio,
          currentPassword: formData.currentPassword || undefined,
          newPassword: formData.newPassword || undefined
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage('プロフィールを更新しました')
        // パスワードフィールドをクリア
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
        // プロフィール情報を再取得
        fetchProfile()
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'プロフィールの更新に失敗しました')
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
      setSaveError('プロフィールの更新に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // ファイルタイプの検証
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        setSaveError('サポートされていないファイル形式です（JPEG、PNG、WebPのみ）')
        return
      }

      // ファイルサイズの検証（管理画面の設定から取得）
      const maxSizeMB = parseInt(settings.max_image_size_mb || '2')
      const maxSize = maxSizeMB * 1024 * 1024
      if (file.size > maxSize) {
        setSaveError(`ファイルサイズが大きすぎます（最大${maxSizeMB}MB）`)
        return
      }

      setAvatarFile(file)
      // プレビュー用のURLを作成
      const previewUrl = URL.createObjectURL(file)
      setAvatarPreview(previewUrl)
    }
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return

    setIsUploadingAvatar(true)
    setSaveMessage('')
    setSaveError('')

    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage('プロフィール画像を更新しました')
        setAvatarFile(null)
        setAvatarPreview(null)
        // プロフィール情報を再取得
        fetchProfile()
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'プロフィール画像の更新に失敗しました')
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error)
      setSaveError('プロフィール画像の更新に失敗しました')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleAvatarDelete = async () => {
    if (!confirm('プロフィール画像を削除しますか？')) return

    try {
      const response = await fetch('/api/user/avatar', {
        method: 'DELETE',
        credentials: 'include',
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage('プロフィール画像を削除しました')
        // プロフィール情報を再取得
        fetchProfile()
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'プロフィール画像の削除に失敗しました')
      }
    } catch (error) {
      console.error('Failed to delete avatar:', error)
      setSaveError('プロフィール画像の削除に失敗しました')
    }
  }

  const cancelAvatarPreview = () => {
    setAvatarFile(null)
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
    }
  }

  const getRoleDisplayName = (role: string) => {
    const roleNames = {
      ADMIN: '管理者',
      CURATOR: '投稿者',
      VIEWER: '視聴者'
    }
    return roleNames[role as keyof typeof roleNames] || role
  }

  if (isLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">認証が必要です</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href={user?.role === 'VIEWER' ? '/account' : '/admin'}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {user?.role === 'VIEWER' ? 'アカウントに戻る' : '管理画面に戻る'}
                </Link>
              </Button>
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold">アカウント設定</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {saveMessage && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {saveMessage}
            </AlertDescription>
          </Alert>
        )}

        {saveError && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {saveError}
            </AlertDescription>
          </Alert>
        )}

        {/* Profile Image Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Camera className="w-5 h-5 mr-2" />
              プロフィール画像
            </CardTitle>
            <CardDescription>
              あなたのプロフィール画像を変更できます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-6">
              <div className="flex flex-col items-center space-y-2">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={profile.profileImageUrl} alt={profile.displayName} />
                  <AvatarFallback className="text-lg">
                    {profile.displayName?.charAt(0) || profile.username?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm text-muted-foreground">現在の画像</div>
              </div>
              
              {avatarPreview && (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-gray-300">
                    <img
                      src={avatarPreview}
                      alt="プレビュー"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">プレビュー</div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="avatar-file">新しい画像を選択</Label>
              <Input
                id="avatar-file"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="mt-1"
              />
              <p className="text-sm text-muted-foreground mt-1">
                JPEG、PNG、WebP形式、最大{settings.max_image_size_mb || '2'}MB
              </p>
            </div>

            <div className="flex justify-between">
              <div className="flex space-x-2">
                {avatarFile && (
                  <Button
                    variant="outline"
                    onClick={cancelAvatarPreview}
                  >
                    キャンセル
                  </Button>
                )}
                {profile.profileImageUrl && (
                  <Button
                    variant="outline"
                    onClick={handleAvatarDelete}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    画像を削除
                  </Button>
                )}
              </div>
              <Button
                onClick={handleAvatarUpload}
                disabled={!avatarFile || isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    アップロード中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    画像を更新
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              プロフィール情報
            </CardTitle>
            <CardDescription>
              あなたの基本情報を編集できます
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">ユーザー名</Label>
                <Input
                  id="username"
                  value={profile.username}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  ユーザー名は変更できません
                </p>
              </div>
              <div>
                <Label htmlFor="role">役割</Label>
                <Input
                  id="role"
                  value={getRoleDisplayName(profile.role)}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="displayName">
                  表示名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  placeholder="表示名を入力"
                />
              </div>
              <div>
                <Label htmlFor="email">
                  メールアドレス <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="メールアドレスを入力"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="department">所属</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                placeholder="所属名を入力"
              />
            </div>

            <div>
              <Label htmlFor="bio">紹介文</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="あなたについて簡単に紹介してください..."
                rows={4}
                className="min-h-[100px] resize-y"
              />
              <p className={`text-sm mt-1 ${
                formData.bio.length > 500 
                  ? 'text-red-500' 
                  : formData.bio.length > 450 
                    ? 'text-yellow-600' 
                    : 'text-muted-foreground'
              }`}>
                最大500文字まで入力できます（{formData.bio.length}/500文字）
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-medium">パスワード変更</h3>
              <p className="text-sm text-muted-foreground">
                パスワードを変更する場合のみ入力してください
              </p>
              
              <div>
                <Label htmlFor="currentPassword">現在のパスワード</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                  placeholder="現在のパスワードを入力"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="newPassword">新しいパスワード</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    placeholder="新しいパスワードを入力"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="新しいパスワードを再入力"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    プロフィールを保存
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 