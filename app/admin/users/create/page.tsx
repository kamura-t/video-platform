'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, UserPlus, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function CreateUserPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [newUser, setNewUser] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'CURATOR',
    department: ''
  })

  // Redirect if not authenticated or not admin
  if (!isLoading && (!isAuthenticated || user?.role?.toLowerCase() !== 'admin')) {
    router.push('/login')
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    // Validation
    if (!newUser.username || !newUser.displayName || !newUser.email || !newUser.password) {
      setErrorMessage('すべての必須フィールドを入力してください')
      return
    }

    if (newUser.password !== newUser.confirmPassword) {
      setErrorMessage('パスワードが一致しません')
      return
    }

    if (newUser.password.length < 6) {
      setErrorMessage('パスワードは6文字以上で入力してください')
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newUser.email)) {
      setErrorMessage('有効なメールアドレスを入力してください')
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: newUser.username,
          displayName: newUser.displayName,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          department: newUser.department || undefined
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccessMessage('ユーザーを作成しました')
        // Reset form
        setNewUser({
          username: '',
          displayName: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'CURATOR',
          department: ''
        })
        // Redirect to users list after 2 seconds
        setTimeout(() => {
          router.push('/admin/users')
        }, 2000)
      } else {
        setErrorMessage(result.error || 'ユーザーの作成に失敗しました')
      }
    } catch (error) {
      console.error('Failed to create user:', error)
      setErrorMessage('ユーザーの作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setNewUser(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errorMessage) setErrorMessage('')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/admin/users">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  ユーザー管理に戻る
                </Link>
              </Button>
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-semibold">新規ユーザー作成</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {successMessage && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Create User Form */}
        <Card>
          <CardHeader>
            <CardTitle>新しいユーザーを作成</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">基本情報</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">
                      ユーザー名 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="username"
                      placeholder="user123"
                      value={newUser.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      英数字、アンダースコア、ハイフンのみ使用可能
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="displayName">
                      表示名 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="displayName"
                      placeholder="田中 太郎"
                      value={newUser.displayName}
                      onChange={(e) => handleInputChange('displayName', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">
                    メールアドレス <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@company.com"
                    value={newUser.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="department">部署</Label>
                  <Input
                    id="department"
                    placeholder="開発部"
                    value={newUser.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">権限設定</h3>
                
                <div>
                  <Label htmlFor="role">
                    役割 <span className="text-red-500">*</span>
                  </Label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(value) => handleInputChange('role', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CURATOR">キュレーター</SelectItem>
                      <SelectItem value="ADMIN">管理者</SelectItem>
                      <SelectItem value="VIEWER">視聴者</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    {newUser.role === 'ADMIN' 
                      ? '管理者: すべての機能にアクセス可能' 
                      : newUser.role === 'VIEWER'
                        ? '視聴者: 動画を閲覧のみ可能'
                        : 'キュレーター: 動画の投稿・管理が可能'
                    }
                  </p>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">パスワード設定</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="password">
                      パスワード <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="パスワード"
                      value={newUser.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      6文字以上で入力してください
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="confirmPassword">
                      パスワード確認 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="パスワード確認"
                      value={newUser.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin/users')}
                  disabled={isCreating}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      作成中...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      ユーザーを作成
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 