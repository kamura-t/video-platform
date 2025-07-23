'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ArrowLeft, 
  Plus, 
  Edit,
  Trash2,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  Tag
} from 'lucide-react'
import Link from 'next/link'
import CategoryDragList from '@/components/admin/category-drag-list'

interface Category {
  id: string
  name: string
  slug: string
  description?: string
  color: string
  videoCount: number
  sortOrder: number
  _count: {
    videos: number
  }
}

interface Tag {
  id: string
  name: string
  videoCount: number
  _count: {
    videos: number
  }
}

export default function CategoriesPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isLoadingTags, setIsLoadingTags] = useState(true)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [newCategory, setNewCategory] = useState({ name: '', slug: '', description: '', color: '#6B7280' })
  const [newTag, setNewTag] = useState({ name: '' })
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddTag, setShowAddTag] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !['admin', 'curator'].includes(user?.role?.toLowerCase() || ''))) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, user, router])

  useEffect(() => {
    if (isAuthenticated && ['admin', 'curator'].includes(user?.role?.toLowerCase() || '')) {
      // 管理者のみカテゴリを取得
      if (user?.role?.toLowerCase() === 'admin') {
        fetchCategories()
      } else {
        // curatorの場合はカテゴリのローディングを無効にする
        setIsLoadingCategories(false)
      }
      fetchTags()
    }
  }, [isAuthenticated, user])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/categories', {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success) {
        setCategories(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags', {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success) {
        setTags(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    } finally {
      setIsLoadingTags(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategory.name || !newCategory.slug) return

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newCategory),
      })

      const result = await response.json()

      if (result.success) {
        setCategories(prev => [...prev, result.data])
        setNewCategory({ name: '', slug: '', description: '', color: '#6B7280' })
        setShowAddCategory(false)
        setSaveMessage('カテゴリを追加しました')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'カテゴリの追加に失敗しました')
      }
    } catch (error) {
      console.error('Failed to add category:', error)
      setSaveError('カテゴリの追加に失敗しました')
    }
  }

  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name || !editingCategory.slug) return

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editingCategory),
      })

      const result = await response.json()

      if (result.success) {
        setCategories(prev => prev.map(cat => 
          cat.id === editingCategory.id ? result.data : cat
        ))
        setEditingCategory(null)
        setSaveMessage('カテゴリを更新しました')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'カテゴリの更新に失敗しました')
      }
    } catch (error) {
      console.error('Failed to update category:', error)
      setSaveError('カテゴリの更新に失敗しました')
    }
  }

  const handleDeleteCategory = async (id: string, force: boolean = false) => {
    if (!force && !confirm('このカテゴリを削除しますか？')) return

    try {
      const response = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id, force }),
      })

      const result = await response.json()

      if (result.success) {
        setCategories(prev => prev.filter(cat => cat.id !== id))
        setSaveMessage(result.message || 'カテゴリを削除しました')
        setSaveError('')
        setTimeout(() => setSaveMessage(''), 3000)
      } else if (result.requiresForce) {
        // Show confirmation dialog for force deletion
        const shouldForceDelete = confirm(
          `このカテゴリは${result.usageCount}個の動画で使用されています。\n` +
          `強制削除すると、関連する動画からもこのカテゴリが削除されます。\n` +
          `本当に削除しますか？`
        )
        
        if (shouldForceDelete) {
          handleDeleteCategory(id, true)
        }
      } else {
        setSaveError(result.error || 'カテゴリの削除に失敗しました')
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      setSaveError('カテゴリの削除に失敗しました')
    }
  }

  const handleAddTag = async () => {
    if (!newTag.name) return

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(newTag),
      })

      const result = await response.json()

      if (result.success) {
        setTags(prev => [...prev, result.data])
        setNewTag({ name: '' })
        setShowAddTag(false)
        setSaveMessage('タグを追加しました')
        setSaveError('')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'タグの追加に失敗しました')
      }
    } catch (error) {
      console.error('Failed to add tag:', error)
      setSaveError('タグの追加に失敗しました')
    }
  }

  const handleEditTag = async () => {
    if (!editingTag || !editingTag.name) return

    try {
      const response = await fetch('/api/tags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(editingTag),
      })

      const result = await response.json()

      if (result.success) {
        setTags(prev => prev.map(tag => 
          tag.id === editingTag.id ? result.data : tag
        ))
        setEditingTag(null)
        setSaveMessage('タグを更新しました')
        setSaveError('')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'タグの更新に失敗しました')
      }
    } catch (error) {
      console.error('Failed to update tag:', error)
      setSaveError('タグの更新に失敗しました')
    }
  }

  const handleDeleteTag = async (id: string, force: boolean = false) => {
    if (!force && !confirm('このタグを削除しますか？')) return

    try {
      const response = await fetch('/api/tags', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ id, force }),
      })

      const result = await response.json()

      if (result.success) {
        setTags(prev => prev.filter(tag => tag.id !== id))
        setSaveMessage(result.message || 'タグを削除しました')
        setSaveError('')
        setTimeout(() => setSaveMessage(''), 3000)
      } else if (result.requiresForce) {
        // Show confirmation dialog for force deletion
        const shouldForceDelete = confirm(
          `このタグは${result.usageCount}個の動画で使用されています。\n` +
          `強制削除すると、関連する動画からもこのタグが削除されます。\n` +
          `本当に削除しますか？`
        )
        
        if (shouldForceDelete) {
          handleDeleteTag(id, true)
        }
      } else {
        setSaveError(result.error || 'タグの削除に失敗しました')
      }
    } catch (error) {
      console.error('Failed to delete tag:', error)
      setSaveError('タグの削除に失敗しました')
    }
  }

  const handleCategoryReorder = async (newOrder: Category[]) => {
    try {
      const categoryIds = newOrder.map(cat => cat.id)
      
      const response = await fetch('/api/admin/categories/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ categoryIds }),
      })

      const result = await response.json()

      if (result.success) {
        setCategories(newOrder)
        setSaveMessage('カテゴリの並び順を更新しました')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveError(result.error || 'カテゴリの並び替えに失敗しました')
      }
    } catch (error) {
      console.error('Failed to reorder categories:', error)
      setSaveError('カテゴリの並び替えに失敗しました')
      throw error
    }
  }

  const shouldShowLoading = isLoading || isLoadingCategories || isLoadingTags
  const shouldShowContent = isAuthenticated && ['admin', 'curator'].includes(user?.role?.toLowerCase() || '')

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!shouldShowContent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">権限がありません</p>
        </div>
      </div>
    )
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" asChild>
                  <Link href="/admin">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    管理画面に戻る
                  </Link>
                </Button>
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-xl font-semibold">
                  {user?.role?.toLowerCase() === 'admin' ? 'カテゴリ・タグ管理' : 'タグ管理'}
                </h1>
              </div>
              
              <div className="flex space-x-2">
                {user?.role?.toLowerCase() === 'admin' && (
                  <Button onClick={() => setShowAddCategory(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    新しいカテゴリ
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowAddTag(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新しいタグ
                </Button>
              </div>
            </div>
          </div>
        </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Add Category Form */}
        {showAddCategory && user?.role?.toLowerCase() === 'admin' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>新しいカテゴリを追加</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category-name">カテゴリ名</Label>
                  <Input
                    id="category-name"
                    placeholder="プログラミング"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="category-slug">スラッグ</Label>
                  <Input
                    id="category-slug"
                    placeholder="programming"
                    value={newCategory.slug}
                    onChange={(e) => setNewCategory(prev => ({ ...prev, slug: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="category-description">説明</Label>
                <Textarea
                  id="category-description"
                  placeholder="カテゴリの説明"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="category-color">色</Label>
                <Input
                  id="category-color"
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddCategory(false)}
                >
                  キャンセル
                </Button>
                <Button onClick={handleAddCategory}>
                  追加
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Category Form */}
        {editingCategory && user?.role?.toLowerCase() === 'admin' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>カテゴリを編集</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-category-name">カテゴリ名</Label>
                  <Input
                    id="edit-category-name"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category-slug">スラッグ</Label>
                  <Input
                    id="edit-category-slug"
                    value={editingCategory.slug}
                    onChange={(e) => setEditingCategory(prev => prev ? ({ ...prev, slug: e.target.value }) : null)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-category-description">説明</Label>
                <Textarea
                  id="edit-category-description"
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-category-color">色</Label>
                <Input
                  id="edit-category-color"
                  type="color"
                  value={editingCategory.color}
                  onChange={(e) => setEditingCategory(prev => prev ? ({ ...prev, color: e.target.value }) : null)}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingCategory(null)}
                >
                  キャンセル
                </Button>
                <Button onClick={handleEditCategory}>
                  更新
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Tag Form */}
        {showAddTag && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>新しいタグを追加</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="tag-name">タグ名</Label>
                  <Input
                    id="tag-name"
                    placeholder="JavaScript"
                    value={newTag.name}
                    onChange={(e) => setNewTag(prev => ({ ...prev, name: e.target.value }))}
                  />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddTag(false)}
                >
                  キャンセル
                </Button>
                <Button onClick={handleAddTag}>
                  追加
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Tag Form */}
        {editingTag && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>タグを編集</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="edit-tag-name">タグ名</Label>
                  <Input
                    id="edit-tag-name"
                    value={editingTag.name}
                    onChange={(e) => setEditingTag(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingTag(null)}
                >
                  キャンセル
                </Button>
                <Button onClick={handleEditTag}>
                  更新
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className={user?.role?.toLowerCase() === 'admin' ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "max-w-2xl mx-auto"}>
          {/* Categories List - 管理者のみ */}
          {user?.role?.toLowerCase() === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle>カテゴリ一覧</CardTitle>
                <CardDescription>
                  現在登録されているカテゴリの一覧です
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryDragList
                  categories={categories}
                  onReorder={handleCategoryReorder}
                  onEdit={setEditingCategory}
                  onDelete={handleDeleteCategory}
                />
              </CardContent>
            </Card>
          )}

          {/* Tags List */}
          <Card>
            <CardHeader>
              <CardTitle>タグ一覧</CardTitle>
              <CardDescription>
                現在登録されているタグの一覧です
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 rounded-full bg-gray-300" />
                        <div>
                          <div className="font-medium">#{tag.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {tag._count.videos}個の動画
                            {tag._count.videos > 0 && (
                              <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                                使用中
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingTag(tag)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTag(tag.id)}
                          className={tag._count.videos > 0 ? "text-orange-600 hover:text-orange-700" : ""}
                          title={tag._count.videos > 0 ? `${tag._count.videos}個の動画で使用中 - 強制削除可能` : "削除"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    タグがありません。新しいタグを追加してください。
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      </div>
    </MainLayout>
  )
} 