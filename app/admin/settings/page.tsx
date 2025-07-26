'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Upload, X, Save, RefreshCw, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { validationService } from '@/lib/validation-service'

interface SystemSettings {
  [key: string]: {
    value: string
    type: string
    description?: string
  }
}

interface ValidationResult {
  isValid: boolean
  error?: string
  warnings?: string[]
}

export default function SystemSettingsPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<SystemSettings>({})
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoValidation, setLogoValidation] = useState<ValidationResult | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoadingSettings(true)
      setSaveError('')
      
      // APIから設定を取得
      const response = await fetch('/api/admin/settings', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('認証が必要です。ログインしてください。')
        } else if (response.status === 403) {
          throw new Error('管理者権限が必要です。')
        } else {
          throw new Error('設定の取得に失敗しました')
        }
      }
      
      const responseData = await response.json()
      
      if (!responseData.success) {
        throw new Error(responseData.error || '設定の取得に失敗しました')
      }
      
      const allSettings = responseData.data || []
      
      // allSettingsが配列でない場合の処理
      if (!Array.isArray(allSettings)) {
        console.error('API response data is not an array:', allSettings)
        throw new Error('設定データの形式が正しくありません')
      }
      
      // 設定を適切な形式に変換
      const formattedSettings = allSettings.reduce((acc: any, setting: any) => {
        acc[setting.key] = {
          value: setting.value,
          type: setting.type,
          description: setting.description
        }
        return acc
      }, {} as SystemSettings)
      setSettings(formattedSettings)
    } catch (error) {
      console.error('Failed to fetch settings:', error)
      setSaveError(error instanceof Error ? error.message : '設定の取得に失敗しました')
    } finally {
      setIsLoadingSettings(false)
    }
  }, [])

  const updateSetting = useCallback((key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: value
      }
    }))
  }, [])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setSaveMessage('')
      setSaveError('')

      // 設定値をバリデーション
      const validationErrors: string[] = []
      
      // 数値設定のバリデーション
      const numericSettings = ['max_file_size_mb', 'max_thumbnail_size_mb', 'max_avatar_size_mb', 'view_count_threshold_percent', 'view_count_threshold_seconds', 'view_duplicate_hours', 'view_history_retention_days']
      numericSettings.forEach(key => {
        if (settings[key]?.value) {
          const value = parseInt(settings[key].value)
          if (isNaN(value) || value <= 0) {
            validationErrors.push(`${key}は正の整数で入力してください`)
          }
        }
      })

      // 視聴回数設定の特別バリデーション
      if (settings.view_count_threshold_percent?.value) {
        const percent = parseInt(settings.view_count_threshold_percent.value)
        if (percent < 1 || percent > 100) {
          validationErrors.push('視聴回数カウント閾値（%）は1〜100の範囲で入力してください')
        }
      }
      
      if (settings.view_count_threshold_seconds?.value) {
        const seconds = parseInt(settings.view_count_threshold_seconds.value)
        if (seconds < 1) {
          validationErrors.push('視聴回数カウント閾値（秒）は1秒以上で入力してください')
        }
      }
      
      if (settings.view_duplicate_hours?.value) {
        const hours = parseInt(settings.view_duplicate_hours.value)
        if (hours < 1 || hours > 168) { // 1時間〜1週間
          validationErrors.push('重複視聴制御時間は1〜168時間の範囲で入力してください')
        }
      }

      // 視聴履歴保持期間のバリデーション
      if (settings.view_history_retention_days?.value) {
        const days = parseInt(settings.view_history_retention_days.value)
        if (days < 30 || days > 3650) { // 30日〜10年
          validationErrors.push('視聴履歴保持期間は30〜3650日の範囲で入力してください')
        }
      }

      // サムネイル設定のバリデーション
      if (settings.thumbnail_format?.value) {
        const format = settings.thumbnail_format.value
        if (format !== 'jpg' && format !== 'webp') {
          validationErrors.push('サムネイル形式はjpgまたはwebpを選択してください')
        }
      }
      
      if (settings.thumbnail_quality?.value) {
        const quality = parseInt(settings.thumbnail_quality.value)
        if (isNaN(quality) || quality < 1 || quality > 100) {
          validationErrors.push('サムネイル品質は1〜100の範囲で入力してください')
        }
      }

      // URL設定のバリデーション
      const urlSettings = ['gpu_server_url']
      urlSettings.forEach(key => {
        if (settings[key]?.value) {
          try {
            new URL(settings[key].value)
          } catch {
            validationErrors.push(`${key}は有効なURLで入力してください`)
          }
        }
      })

      // JSON設定のバリデーション
      const jsonSettings = ['private_video_allowed_ips']
      jsonSettings.forEach(key => {
        if (settings[key]?.value) {
          try {
            const parsed = JSON.parse(settings[key].value)
            if (key === 'private_video_allowed_ips') {
              if (!Array.isArray(parsed)) {
                validationErrors.push('IPアドレス設定は配列形式で入力してください')
              } else {
                // IPアドレス/CIDR形式の簡易バリデーション
                const invalidIps = parsed.filter((ip: any) => {
                  if (typeof ip !== 'string') return true
                  // 簡易的なIPアドレス/CIDR形式チェック
                  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
                  return !ipPattern.test(ip)
                })
                if (invalidIps.length > 0) {
                  validationErrors.push(`無効なIPアドレス形式が含まれています: ${invalidIps.join(', ')}`)
                }
              }
            }
          } catch {
            validationErrors.push(`${key}は有効なJSON形式で入力してください`)
          }
        }
      })

      if (validationErrors.length > 0) {
        setSaveError(validationErrors.join(', '))
        return
      }

      // 設定を一括更新
      const settingsToUpdate = Object.entries(settings).map(([key, setting]) => ({
        key,
        value: setting.value,
        type: setting.type as any,
        description: setting.description
      }))

      // APIで設定を更新
      const updateResponse = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ settings: settingsToUpdate })
      })

      const updateResult = await updateResponse.json()
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || '設定の更新に失敗しました')
      }

      setSaveMessage('設定を保存しました')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveError('設定の保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    
    if (!isLoading && isAuthenticated && user?.role?.toLowerCase() !== 'admin') {
      router.push('/admin')
      return
    }
  }, [isLoading, isAuthenticated, user?.role, router])

  useEffect(() => {
    if (isAuthenticated && user?.role?.toLowerCase() === 'admin') {
      fetchSettings()
    }
  }, [isAuthenticated, user?.role, fetchSettings])

  // ロゴ画像アップロード
  const handleLogoUpload = async () => {
    if (!logoFile) return

    setIsUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', logoFile)

      const response = await fetch('/api/admin/settings/logo', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage('ロゴ画像がアップロードされました')
        setTimeout(() => setSaveMessage(''), 3000)
        setLogoFile(null)
        setLogoPreview('')
        setLogoValidation(null)
        fetchSettings() // 設定を再取得
      } else {
        setSaveError(result.error || 'ロゴ画像のアップロードに失敗しました')
      }
    } catch (error) {
      console.error('Failed to upload logo:', error)
      setSaveError('ロゴ画像のアップロードに失敗しました')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  // ロゴ画像削除
  const handleLogoDelete = async () => {
    try {
      const response = await fetch('/api/admin/settings/logo', {
        method: 'DELETE',
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage('ロゴ画像が削除されました')
        setTimeout(() => setSaveMessage(''), 3000)
        fetchSettings() // 設定を再取得
      } else {
        setSaveError(result.error || 'ロゴ画像の削除に失敗しました')
      }
    } catch (error) {
      console.error('Failed to delete logo:', error)
      setSaveError('ロゴ画像の削除に失敗しました')
    }
  }

  // ファイル選択時の処理
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // バリデーション実行
      const validation = await validationService.validateImageFile(file)
      setLogoValidation(validation)
      
      if (validation.isValid) {
        setLogoFile(file)
        const reader = new FileReader()
        reader.onload = (e) => {
          setLogoPreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setLogoFile(null)
        setLogoPreview('')
      }
    }
  }

  // ローディング状態や認証状態をチェックするが、早期リターンは避ける
  const shouldShowLoading = isLoading || isLoadingSettings
  const shouldShowContent = isAuthenticated && user?.role?.toLowerCase() === 'admin'

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!shouldShowContent) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">アクセス権限がありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">システム設定</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              システム全体の動作を設定できます
            </p>
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

          <div className="grid grid-cols-1 gap-6">
            {/* 保存ボタン */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end">
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    size="lg"
                    className="min-w-[120px]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        設定を保存
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* システム設定 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  システム設定
                </CardTitle>
                <CardDescription>
                  動画変換、ファイル保存、アップロード制限などの設定
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="nas_mount_path" className="text-sm font-medium">
                      動画保存パス
                    </Label>
                    <Input
                      id="nas_mount_path"
                      value={settings.nas_mount_path?.value || ''}
                      onChange={(e) => updateSetting('nas_mount_path', e.target.value)}
                      placeholder="/uploads/videos"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      動画ファイルを保存する完全パス（例: /uploads/videos, /mnt/nas/videos）
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="view_history_retention_days" className="text-sm font-medium">
                      視聴履歴保持期間（日数）
                    </Label>
                    <Input
                      id="view_history_retention_days"
                      type="number"
                      value={settings.view_history_retention_days?.value || ''}
                      onChange={(e) => updateSetting('view_history_retention_days', e.target.value)}
                      placeholder="1825"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      視聴履歴を保持する期間（日数）。この期間を過ぎた古い履歴は自動削除対象となります。デフォルト: 1825日（約5年）
                    </p>
                  </div>

                </div>
              </CardContent>
            </Card>

            {/* サイト設定 */}
            <Card>
              <CardHeader>
                <CardTitle>サイト設定</CardTitle>
                <CardDescription>
                  サイト名、説明、ロゴなどの基本情報
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="site_title" className="text-sm font-medium">
                      サイトタイトル
                    </Label>
                    <Input
                      id="site_title"
                      value={settings.site_title?.value || ''}
                      onChange={(e) => updateSetting('site_title', e.target.value)}
                      placeholder="VideoShare"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="site_description" className="text-sm font-medium">
                      サイト説明
                    </Label>
                    <Textarea
                      id="site_description"
                      value={settings.site_description?.value || ''}
                      onChange={(e) => updateSetting('site_description', e.target.value)}
                      placeholder="動画を共有するためのプラットフォーム"
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="site_logo_icon" className="text-sm font-medium">
                      ロゴアイコン
                    </Label>
                    <Input
                      id="site_logo_icon"
                      value={settings.site_logo_icon?.value || ''}
                      onChange={(e) => updateSetting('site_logo_icon', e.target.value)}
                      placeholder="Video"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      サイトのファビコンとして使用されるアイコン名
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="videos_per_page" className="text-sm font-medium">
                        1ページあたりの動画表示数
                      </Label>
                      <Input
                        id="videos_per_page"
                        type="number"
                        value={settings.videos_per_page?.value || ''}
                        onChange={(e) => updateSetting('videos_per_page', e.target.value)}
                        placeholder="20"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new_badge_display_days" className="text-sm font-medium">
                        新着バッジ表示日数
                      </Label>
                      <Input
                        id="new_badge_display_days"
                        type="number"
                        value={settings.new_badge_display_days?.value || ''}
                        onChange={(e) => updateSetting('new_badge_display_days', e.target.value)}
                        placeholder="7"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <Label>ロゴ画像</Label>
                    
                    {/* 現在のロゴ画像表示 */}
                    {settings.site_logo_image?.value && (
                      <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <img 
                          src={settings.site_logo_image.value} 
                          alt="現在のロゴ" 
                          className="h-12 w-12 object-contain"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">現在のロゴ画像</p>
                          <p className="text-xs text-muted-foreground">
                            {settings.site_logo_image.value}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleLogoDelete}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* ロゴ画像アップロード */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="flex-1"
                        />
                        {logoFile && logoValidation?.isValid && (
                          <Button
                            onClick={handleLogoUpload}
                            disabled={isUploadingLogo}
                            size="sm"
                          >
                            {isUploadingLogo ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="animate-spin h-4 w-4" />
                                アップロード中...
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                アップロード
                              </div>
                            )}
                          </Button>
                        )}
                      </div>
                      
                                             {/* バリデーション結果表示 */}
                       {logoValidation && (
                         <div className="space-y-2">
                           {logoValidation.error && (
                             <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
                               <AlertCircle className="h-4 w-4 text-red-600" />
                               <AlertDescription className="text-red-800 dark:text-red-200">
                                 {logoValidation.error}
                               </AlertDescription>
                             </Alert>
                           )}
                           {logoValidation.warnings && logoValidation.warnings.length > 0 && (
                             <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
                               <AlertCircle className="h-4 w-4 text-yellow-600" />
                               <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                                 {logoValidation.warnings.join(', ')}
                               </AlertDescription>
                             </Alert>
                           )}
                         </div>
                       )}
                      
                      {/* プレビュー */}
                      {logoPreview && logoValidation?.isValid && (
                        <div className="flex items-center gap-2 p-2 border rounded">
                          <img 
                            src={logoPreview} 
                            alt="プレビュー" 
                            className="h-8 w-8 object-contain"
                          />
                          <span className="text-sm text-muted-foreground">
                            {logoFile?.name}
                          </span>
                          <Badge variant="secondary" className="ml-auto">
                            {Math.round((logoFile?.size || 0) / 1024)}KB
                          </Badge>
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground">
                        JPEG、PNG、GIF、WebP形式、{parseInt(settings.max_image_size_mb?.value || '2')}MB以下。faviconとしても使用されます。
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* アップロード設定 */}
            <Card>
              <CardHeader>
                <CardTitle>アップロード設定</CardTitle>
                <CardDescription>
                  ファイルアップロードに関する設定
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max_file_size_mb" className="text-sm font-medium">
                        最大動画サイズ (MB)
                      </Label>
                      <Input
                        id="max_file_size_mb"
                        type="number"
                        value={settings.max_file_size_mb?.value || ''}
                        onChange={(e) => updateSetting('max_file_size_mb', e.target.value)}
                        placeholder="5120"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_image_size_mb" className="text-sm font-medium">
                        最大画像サイズ (MB)
                      </Label>
                      <Input
                        id="max_image_size_mb"
                        type="number"
                        value={settings.max_image_size_mb?.value || ''}
                        onChange={(e) => updateSetting('max_image_size_mb', e.target.value)}
                        placeholder="2"
                        className="mt-1"
                      />
                    </div>
                  </div>



                  <div>
                    <Label htmlFor="allowed_file_types" className="text-sm font-medium">
                      許可するファイル形式
                    </Label>
                    <Input
                      id="allowed_file_types"
                      value={settings.allowed_file_types?.value || ''}
                      onChange={(e) => updateSetting('allowed_file_types', e.target.value)}
                      placeholder="mp4,mov,avi,mkv,wmv,webm"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      カンマ区切りでファイル形式を指定
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="nfs_mounted"
                      checked={settings.nfs_mounted?.value === 'true'}
                      onCheckedChange={(checked) => updateSetting('nfs_mounted', checked.toString())}
                    />
                    <Label htmlFor="nfs_mounted" className="text-sm font-medium">
                      NFSマウント状態
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GPU変換設定 */}
            <Card>
              <CardHeader>
                <CardTitle>GPU変換設定</CardTitle>
                <CardDescription>
                  動画変換処理に関する設定
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="gpu_server_url" className="text-sm font-medium">
                      GPU変換サーバーURL
                    </Label>
                    <Input
                      id="gpu_server_url"
                      value={settings.gpu_server_url?.value || ''}
                      onChange={(e) => updateSetting('gpu_server_url', e.target.value)}
                      placeholder="http://172.16.1.172:3001"
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="gpu_transcoding_enabled"
                      checked={settings.gpu_transcoding_enabled?.value === 'true'}
                      onCheckedChange={(checked) => updateSetting('gpu_transcoding_enabled', checked.toString())}
                    />
                    <Label htmlFor="gpu_transcoding_enabled" className="text-sm font-medium">
                      GPU変換機能有効化
                    </Label>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-sm font-medium mb-3 block">サムネイル生成設定</Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="thumbnail_format" className="text-sm font-medium">
                          サムネイル形式
                        </Label>
                        <select
                          id="thumbnail_format"
                          value={settings.thumbnail_format?.value || 'jpg'}
                          onChange={(e) => updateSetting('thumbnail_format', e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-input bg-background text-sm rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        >
                          <option value="jpg">JPEG (.jpg)</option>
                          <option value="webp">WebP (.webp)</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          JPEG: 互換性が高い、WebP: ファイルサイズが小さい
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="thumbnail_quality" className="text-sm font-medium">
                          サムネイル品質
                        </Label>
                        <Input
                          id="thumbnail_quality"
                          type="number"
                          min="1"
                          max="100"
                          value={settings.thumbnail_quality?.value || '95'}
                          onChange={(e) => updateSetting('thumbnail_quality', e.target.value)}
                          placeholder="95"
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          1-100の範囲で指定（推奨: 85-95）
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
                      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                        🖼️ 現在のサムネイル設定
                      </h4>
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p>• 形式: {settings.thumbnail_format?.value === 'webp' ? 'WebP (.webp)' : 'JPEG (.jpg)'}</p>
                        <p>• 品質: {settings.thumbnail_quality?.value || '95'}</p>
                        <p className="text-xs mt-2">
                          ※ 新規動画アップロード時に適用されます
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* セキュリティ設定 */}
            <Card>
              <CardHeader>
                <CardTitle>セキュリティ設定</CardTitle>
                <CardDescription>
                  セキュリティに関する設定
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="session_timeout" className="text-sm font-medium">
                      セッションタイムアウト（秒）
                    </Label>
                    <Input
                      id="session_timeout"
                      type="number"
                      value={settings.session_timeout?.value || ''}
                      onChange={(e) => updateSetting('session_timeout', e.target.value)}
                      placeholder="1800"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="private_video_allowed_ips" className="text-sm font-medium">
                      学内限定動画アクセス許可IPアドレス
                    </Label>
                    <Textarea
                      id="private_video_allowed_ips"
                      value={settings.private_video_allowed_ips?.value || '[]'}
                      onChange={(e) => updateSetting('private_video_allowed_ips', e.target.value)}
                      placeholder='["192.168.1.0/24", "10.0.0.0/8", "172.16.0.0/12"]'
                      className="mt-1"
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      学内限定動画にアクセス可能なIPアドレスまたはCIDR範囲をJSON配列形式で入力してください。<br />
                      例: [&quot;192.168.1.0/24&quot;, &quot;10.0.0.0/8&quot;, &quot;172.16.0.0/12&quot;, &quot;192.168.10.64&quot;]
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 視聴回数設定 */}
            <Card>
              <CardHeader>
                <CardTitle>視聴回数設定</CardTitle>
                <CardDescription>
                  視聴回数カウントの閾値設定
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="view_count_threshold_percent" className="text-sm font-medium">
                        視聴回数カウント閾値（%）
                      </Label>
                      <Input
                        id="view_count_threshold_percent"
                        type="number"
                        value={settings.view_count_threshold_percent?.value || '30'}
                        onChange={(e) => updateSetting('view_count_threshold_percent', e.target.value)}
                        placeholder="30"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        動画の何%以上視聴した場合に視聴回数としてカウントするか
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="view_count_threshold_seconds" className="text-sm font-medium">
                        視聴回数カウント閾値（秒）
                      </Label>
                      <Input
                        id="view_count_threshold_seconds"
                        type="number"
                        value={settings.view_count_threshold_seconds?.value || '600'}
                        onChange={(e) => updateSetting('view_count_threshold_seconds', e.target.value)}
                        placeholder="600"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        何秒以上視聴した場合に視聴回数としてカウントするか
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="view_duplicate_hours" className="text-sm font-medium">
                      重複視聴制御時間（時間）
                    </Label>
                    <Input
                      id="view_duplicate_hours"
                      type="number"
                      value={settings.view_duplicate_hours?.value || '24'}
                      onChange={(e) => updateSetting('view_duplicate_hours', e.target.value)}
                      placeholder="24"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        同一セッションからの重複視聴を制御する時間（時間単位）
                      </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      📊 現在の設定
                    </h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <p>• 視聴率: {settings.view_count_threshold_percent?.value || '30'}%以上</p>
                      <p>• 視聴時間: {settings.view_count_threshold_seconds?.value || '600'}秒（{Math.round((parseInt(settings.view_count_threshold_seconds?.value || '600') / 60))}分）以上</p>
                      <p>• 重複制御: {settings.view_duplicate_hours?.value || '24'}時間以内</p>
                      <p className="text-xs mt-2">
                        ※ 上記のいずれかの条件を満たした場合に視聴回数としてカウントされます
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API設定 */}
            <Card>
              <CardHeader>
                <CardTitle>API設定</CardTitle>
                <CardDescription>
                  外部API連携の設定
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="youtube_api_key" className="text-sm font-medium">
                      YouTube Data API v3 キー
                    </Label>
                    <Input
                      id="youtube_api_key"
                      type="password"
                      value={settings.youtube_api_key?.value || ''}
                      onChange={(e) => updateSetting('youtube_api_key', e.target.value)}
                      placeholder="AIzaSy..."
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      YouTube動画のメタデータ取得に使用されます。設定しない場合はoEmbed APIが使用されます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 