'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  ArrowLeft, 
  Plus, 
  Edit2,
  Trash2,
  Users,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Camera,
  Upload,
  X,
  ArrowRightLeft,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { validationService } from '@/lib/validation-service'
import { storageService } from '@/lib/storage-service'

interface User {
  id: number
  username: string
  displayName: string
  email: string
  role: string
  department?: string
  profileImageUrl?: string
  isActive: boolean
  failedLoginCount: number
  lastFailedLoginAt?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  _count: {
    videos: number
    posts: number
  }
}

interface Pagination {
  currentPage: number
  totalPages: number
  totalCount: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export default function UsersPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  })
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showAddUser, setShowAddUser] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingAvatar, setEditingAvatar] = useState<User | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [avatarValidation, setAvatarValidation] = useState<{
    isValid: boolean;
    error?: string;
    warnings?: string[];
  } | null>(null)
  const [newUser, setNewUser] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    role: 'CURATOR',
    department: ''
  })

  // コンテンツ移譲機能の状態管理
  const [transferringUser, setTransferringUser] = useState<User | null>(null)
  const [transferTargetUserId, setTransferTargetUserId] = useState('')
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [availableTargetUsers, setAvailableTargetUsers] = useState<User[]>([])
  const [settings, setSettings] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role?.toLowerCase() !== 'admin')) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, user, router])

  useEffect(() => {
    if (isAuthenticated && user?.role?.toLowerCase() === 'admin') {
      fetchUsers()
      fetchSettings()
    }
  }, [isAuthenticated, user, pagination.currentPage, searchQuery, roleFilter])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/public')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: '20',
        search: searchQuery,
        role: roleFilter
      })

      const response = await fetch(`/api/admin/users?${params}`, {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success) {
        setUsers(result.data.users)
        setPagination(result.data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  // 移譲先候補ユーザーを取得
  const fetchAvailableTargetUsers = async (excludeUserId: number) => {
    try {
      const response = await fetch('/api/admin/users?limit=100', {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success) {
        // 移譲元ユーザーと非アクティブユーザーを除外
        const filteredUsers = result.data.users.filter((u: User) => 
          u.id !== excludeUserId && u.isActive
        )
        setAvailableTargetUsers(filteredUsers)
      }
    } catch (error) {
      console.error('Failed to fetch target users:', error)
    }
  }

  // コンテンツ移譲処理
  const handleTransferContent = async () => {
    if (!transferringUser || !transferTargetUserId) return

    setIsTransferring(true)
    try {
      const response = await fetch(`/api/admin/users/${transferringUser.id}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: transferTargetUserId,
          deleteAfterTransfer: deleteAfterTransfer
        }),
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers()
        setTransferringUser(null)
        setTransferTargetUserId('')
        setDeleteAfterTransfer(false)
        setSaveMessage(result.message)
        setTimeout(() => setSaveMessage(''), 5000)
      } else {
        setSaveError(result.error || 'コンテンツの移譲に失敗しました')
      }
    } catch (error) {
      console.error('Failed to transfer content:', error)
      setSaveError('コンテンツの移譲に失敗しました')
    } finally {
      setIsTransferring(false)
    }
  }

  // 移譲ダイアログを開く
  const openTransferDialog = (user: User) => {
    setTransferringUser(user)
    setTransferTargetUserId('')
    setDeleteAfterTransfer(false)
    fetchAvailableTargetUsers(user.id)
  }

  // 移譲ダイアログを閉じる
  const closeTransferDialog = () => {
    setTransferringUser(null)
    setTransferTargetUserId('')
    setDeleteAfterTransfer(false)
    setAvailableTargetUsers([])
  }

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.displayName || !newUser.email || !newUser.password) return

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newUser),
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers()
        setNewUser({
          username: '',
          displayName: '',
          email: '',
          password: '',
          role: 'CURATOR',
          department: ''
        })
        setShowAddUser(false)
        setSaveMessage('ユーザーを追加しました')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'ユーザーの追加に失敗しました')
      }
    } catch (error) {
      console.error('Failed to add user:', error)
      setSaveError('ユーザーの追加に失敗しました')
    }
  }

  const handleEditUser = async () => {
    if (!editingUser) return

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editingUser),
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers()
        setEditingUser(null)
        setSaveMessage('ユーザーを更新しました')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'ユーザーの更新に失敗しました')
      }
    } catch (error) {
      console.error('Failed to update user:', error)
      setSaveError('ユーザーの更新に失敗しました')
    }
  }

  const handleDeleteUser = async (userId: number) => {
    const userToDelete = users.find(u => u.id === userId)
    if (!userToDelete) return

    // コンテンツがあるユーザーの場合は警告を表示
    if (userToDelete._count.videos > 0 || userToDelete._count.posts > 0) {
      const hasVideos = userToDelete._count.videos > 0
      const hasPosts = userToDelete._count.posts > 0
      let contentDescription = ''
      
      if (hasVideos && hasPosts) {
        contentDescription = `動画${userToDelete._count.videos}個、投稿${userToDelete._count.posts}個`
      } else if (hasVideos) {
        contentDescription = `動画${userToDelete._count.videos}個`
      } else {
        contentDescription = `投稿${userToDelete._count.posts}個`
      }

      const shouldTransfer = confirm(
        `${userToDelete.displayName}は${contentDescription}を投稿しています。\n\n` +
        `このユーザーを削除する前に、コンテンツを他のユーザーに移譲する必要があります。\n\n` +
        `「OK」を押すとコンテンツ移譲画面を開きます。\n` +
        `「キャンセル」を押すと削除を中止します。`
      )

      if (shouldTransfer) {
        openTransferDialog(userToDelete)
        return
      } else {
        return // 削除を中止
      }
    }

    // コンテンツがないユーザーの場合は通常の削除確認
    if (!confirm(`${userToDelete.displayName}を削除しますか？\n\nこの操作は取り消せません。`)) return

    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id: userId }),
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers()
        setSaveMessage('ユーザーを削除しました')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'ユーザーの削除に失敗しました')
      }
    } catch (error) {
      console.error('Failed to delete user:', error)
      setSaveError('ユーザーの削除に失敗しました')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, currentPage: 1 }))
    fetchUsers()
  }

  const handleAvatarUpload = async () => {
    if (!editingAvatar || !avatarFile) return

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)

      const response = await fetch(`/api/admin/users/${editingAvatar.id}/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers()
        setEditingAvatar(null)
        setAvatarFile(null)
        setAvatarValidation(null)
        setSaveMessage('プロフィール画像を更新しました')
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

  const handleAvatarDelete = async (userId: number) => {
    if (!confirm('プロフィール画像を削除しますか？')) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/avatar`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const result = await response.json()

      if (result.success) {
        fetchUsers()
        setSaveMessage('プロフィール画像を削除しました')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'プロフィール画像の削除に失敗しました')
      }
    } catch (error) {
      console.error('Failed to delete avatar:', error)
      setSaveError('プロフィール画像の削除に失敗しました')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // バリデーション実行
      const validation = await validationService.validateAvatar(file)
      setAvatarValidation(validation)
      
      if (validation.isValid) {
        setAvatarFile(file)
      } else {
        setAvatarFile(null)
      }
    }
  }

  const getRoleDisplayName = (role: string) => {
    const roleNames = {
      ADMIN: '管理者',
      CURATOR: 'キュレーター',
      VIEWER: '閲覧者'
    }
    return roleNames[role as keyof typeof roleNames] || role
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800'
      case 'CURATOR':
        return 'bg-blue-100 text-blue-800'
      case 'VIEWER':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const shouldShowLoading = isLoading || isLoadingUsers
  const shouldShowContent = isAuthenticated && user?.role?.toLowerCase() === 'admin'

  if (shouldShowLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </div>
    )
  }

  if (!shouldShowContent) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">権限がありません</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">ユーザー管理</h1>
          <p className="text-muted-foreground mt-2">
            システムユーザーの管理
          </p>
        </div>
        <Button onClick={() => setShowAddUser(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          新規ユーザー追加
        </Button>
      </div>

      {/* メッセージ表示 */}
      {saveMessage && (
        <Alert className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {saveMessage}
          </AlertDescription>
        </Alert>
      )}

      {saveError && (
        <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            {saveError}
          </AlertDescription>
        </Alert>
      )}

      {/* 検索・フィルター */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            検索・フィルター
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ユーザーを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="役割でフィルター" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての役割</SelectItem>
                <SelectItem value="ADMIN">管理者</SelectItem>
                <SelectItem value="CURATOR">キュレーター</SelectItem>
                <SelectItem value="VIEWER">閲覧者</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => fetchUsers()} variant="outline">
              検索
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ユーザー一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>ユーザー一覧</CardTitle>
          <CardDescription>
            全{pagination.totalCount}件のユーザー
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ユーザー</TableHead>
                <TableHead>役割</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>最終ログイン</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImageUrl} alt={user.displayName} />
                        <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.displayName}</div>
                        <div className="text-sm text-muted-foreground">@{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        {(user._count.videos > 0 || user._count.posts > 0) && (
                          <div className="text-xs text-blue-600 mt-1">
                            動画: {user._count.videos}個 | 投稿: {user._count.posts}個
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {getRoleDisplayName(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.department || '-'}</TableCell>
                  <TableCell>
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ja-JP') : '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString('ja-JP')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                        title="ユーザー情報を編集"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAvatar(user)}
                        title="プロフィール画像を変更"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      {(user._count.videos > 0 || user._count.posts > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTransferDialog(user)}
                          className="text-blue-600 hover:text-blue-700"
                          title="コンテンツを移譲"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-destructive hover:text-destructive"
                        title="ユーザーを削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* アバター編集フォーム */}
      {editingAvatar && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>プロフィール画像を編集</CardTitle>
            <CardDescription>
              {editingAvatar.displayName} のプロフィール画像を変更します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-6">
              <div className="flex flex-col items-center space-y-2">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={editingAvatar.profileImageUrl} alt={editingAvatar.displayName} />
                  <AvatarFallback className="text-lg">{editingAvatar.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-sm text-muted-foreground">現在の画像</div>
              </div>
              
              {avatarFile && avatarValidation?.isValid && (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-gray-300">
                    <img
                      src={URL.createObjectURL(avatarFile)}
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
                JPEG、PNG、WebP形式、最大{parseInt(settings.max_image_size_mb || '2')}MB
              </p>
            </div>

            {/* バリデーション結果表示 */}
            {avatarValidation && (
              <div className="space-y-2">
                {avatarValidation.error && (
                  <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      {avatarValidation.error}
                    </AlertDescription>
                  </Alert>
                )}
                {avatarValidation.warnings && avatarValidation.warnings.length > 0 && (
                  <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                      {avatarValidation.warnings.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingAvatar(null)
                    setAvatarFile(null)
                    setAvatarValidation(null)
                  }}
                >
                  キャンセル
                </Button>
                {editingAvatar.profileImageUrl && (
                  <Button
                    variant="outline"
                    onClick={() => handleAvatarDelete(editingAvatar.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    画像を削除
                  </Button>
                )}
              </div>
              <Button
                onClick={handleAvatarUpload}
                disabled={!avatarFile || !avatarValidation?.isValid || isUploadingAvatar}
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
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
      )}

      {/* Content Transfer Dialog */}
      {transferringUser && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <ArrowRightLeft className="w-5 h-5" />
              コンテンツ移譲
            </CardTitle>
            <CardDescription className="text-blue-700">
              {transferringUser.displayName}のコンテンツを別のユーザーに移譲します
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800">移譲対象のコンテンツ</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    動画: {transferringUser._count.videos}個、投稿: {transferringUser._count.posts}個
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    これらのコンテンツの所有者が変更されます。この操作は取り消せません。
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="transfer-target">移譲先ユーザー</Label>
              <Select value={transferTargetUserId} onValueChange={setTransferTargetUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="移譲先ユーザーを選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {availableTargetUsers.map((targetUser) => (
                    <SelectItem key={targetUser.id} value={targetUser.id.toString()}>
                      {targetUser.displayName} (@{targetUser.username}) - {getRoleDisplayName(targetUser.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={deleteAfterTransfer}
                onCheckedChange={setDeleteAfterTransfer}
              />
              <Label>移譲後にユーザーを削除</Label>
            </div>

            {deleteAfterTransfer && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">ユーザー削除の注意</h4>
                    <p className="text-sm text-red-700 mt-1">
                      コンテンツ移譲後、{transferringUser.displayName}のユーザーアカウントが完全に削除されます。
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={closeTransferDialog}
                disabled={isTransferring}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleTransferContent}
                disabled={!transferTargetUserId || isTransferring}
              >
                {isTransferring ? '移譲中...' : '移譲を実行'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add User Form */}
      {showAddUser && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>新しいユーザーを追加</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">ユーザー名</Label>
                <Input
                  id="username"
                  placeholder="user123"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="displayName">表示名</Label>
                <Input
                  id="displayName"
                  placeholder="田中 太郎"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@company.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="パスワード"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="role">役割</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">管理者</SelectItem>
                    <SelectItem value="CURATOR">キュレーター</SelectItem>
                    <SelectItem value="VIEWER">閲覧者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="department">部署</Label>
                <Input
                  id="department"
                  placeholder="開発部"
                  value={newUser.department}
                  onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowAddUser(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleAddUser}>
                追加
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>ユーザーを編集</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-username">ユーザー名</Label>
                <Input
                  id="edit-username"
                  value={editingUser.username}
                  onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, username: e.target.value }) : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-displayName">表示名</Label>
                <Input
                  id="edit-displayName"
                  value={editingUser.displayName}
                  onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, displayName: e.target.value }) : null)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-email">メールアドレス</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-password">新しいパスワード（変更する場合のみ）</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="新しいパスワード"
                  onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, password: e.target.value }) : null)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-role">役割</Label>
                <Select 
                  value={editingUser.role} 
                  onValueChange={(value) => setEditingUser(prev => prev ? ({ ...prev, role: value }) : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">管理者</SelectItem>
                    <SelectItem value="CURATOR">キュレーター</SelectItem>
                    <SelectItem value="VIEWER">閲覧者</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-department">部署</Label>
                <Input
                  id="edit-department"
                  value={editingUser.department || ''}
                  onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, department: e.target.value }) : null)}
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  checked={editingUser.isActive}
                  onCheckedChange={(checked) => setEditingUser(prev => prev ? ({ ...prev, isActive: checked }) : null)}
                />
                <Label>アクティブ</Label>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setEditingUser(null)}
              >
                キャンセル
              </Button>
              <Button onClick={handleEditUser}>
                更新
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            {pagination.totalCount}件中 {((pagination.currentPage - 1) * 20) + 1}〜{Math.min(pagination.currentPage * 20, pagination.totalCount)}件を表示
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
              disabled={!pagination.hasPrevPage}
            >
              <ChevronLeft className="w-4 h-4" />
              前へ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
              disabled={!pagination.hasNextPage}
            >
              次へ
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
