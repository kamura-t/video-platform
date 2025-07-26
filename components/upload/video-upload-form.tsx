'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { 
  FileVideo, 
  Upload, 
  Link, 
  X, 
  AlertCircle, 
  Info, 
  Loader2,
  Youtube,
  Settings,
  Tag,
  Eye,
  EyeOff,
  Lock,
  Clock,
  Calendar
} from 'lucide-react';
import { TagInput } from './tag-input';
import { useSettings } from '@/components/providers/settings-provider';

// アップロードフォームのスキーマ
const uploadSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(100, 'タイトルは100文字以内で入力してください'),
  description: z.string().min(1, '説明は必須です').max(1000, '説明は1000文字以内で入力してください'),
  categories: z.array(z.string()).min(1, 'カテゴリを選択してください'),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'DRAFT']),
  youtubeUrl: z.string().optional(),
  file: z.any().optional(),
  preset: z.string().default('auto'),
  scheduleType: z.enum(['immediate', 'scheduled']).default('immediate'),
  scheduledPublishAt: z.string().optional(),
  scheduledUnpublishAt: z.string().optional(),
}).refine((data) => {
  if (data.scheduleType === 'scheduled') {
    return data.scheduledPublishAt && data.scheduledPublishAt.length > 0;
  }
  return true;
}, {
  message: "予約投稿時刻が必要です",
  path: ["scheduledPublishAt"],
}).refine((data) => {
  // 予約非公開時刻のバリデーション
  if (data.scheduledUnpublishAt && data.scheduledUnpublishAt.length > 0) {
    const now = new Date();
    const unpublishTime = new Date(data.scheduledUnpublishAt);
    
    if (unpublishTime <= now) {
      return false;
    }
    
    // 予約投稿と予約非公開の両方が設定されている場合
    if (data.scheduledPublishAt && data.scheduledPublishAt.length > 0) {
      const publishTime = new Date(data.scheduledPublishAt);
      return unpublishTime > publishTime;
    }
  }
  return true;
}, {
  message: "予約非公開時刻は現在時刻より後で、予約投稿時刻より後である必要があります",
  path: ["scheduledUnpublishAt"],
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface VideoUploadFormProps {
  uploadMethod: 'file' | 'youtube';
  onSubmit: (data: UploadFormData & { uploadMethod: 'file' | 'youtube'; tags: string[] }) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

// 設定インターフェース
interface UploadConfig {
  maxFileSizeMB: number;
  maxImageSizeMB: number;
  allowedFileTypes: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

// マルチセレクトコンポーネント
interface MultiSelectProps {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder = "選択してください",
  disabled = false,
}) => {
  const handleSelect = (value: string) => {
    if (!selected.includes(value)) {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter(item => item !== value));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selected.map((item) => (
          <Badge key={item} variant="secondary" className="flex items-center gap-1">
            {options.find(opt => opt.value === item)?.label || item}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              className="ml-1 hover:text-destructive"
              disabled={disabled}
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Select onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options
            .filter(option => !selected.includes(option.value))
            .map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export const VideoUploadForm: React.FC<VideoUploadFormProps> = ({
  uploadMethod,
  onSubmit,
  isUploading = false,
  uploadProgress = 0,
}) => {
  const { settings } = useSettings();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [youtubeMetadata, setYoutubeMetadata] = useState<any>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // SettingsProviderから設定を取得
  const uploadConfig: UploadConfig = {
    maxFileSizeMB: settings.maxFileSizeMb || 5120,
    maxImageSizeMB: 2, // 固定値
    allowedFileTypes: settings.allowedFileTypes || 'mp4,mov,avi,mkv,wmv,flv,webm'
  };

  // カテゴリを取得
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setCategories(data.data);
          }
        }
      } catch (error) {
        console.error('カテゴリの取得に失敗しました:', error);
      }
    };

    fetchCategories();
  }, []);

  // タグを取得
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setTags(data.data.map((tag: any) => tag.name));
          }
        }
      } catch (error) {
        console.error('タグの取得に失敗しました:', error);
      }
    };

    fetchTags();
  }, []);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: '',
      description: '',
      categories: [],
      tags: [] as string[],
      visibility: 'PUBLIC',
      youtubeUrl: '',
      preset: 'auto',
      scheduleType: 'immediate',
      scheduledPublishAt: '',
      scheduledUnpublishAt: '',
    },
  });

  // ファイル選択ハンドラー
  const handleFileSelect = useCallback((file: File) => {
    setFileError('');
    
    // ファイルサイズチェック（管理者設定から取得）
    const maxSize = uploadConfig.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      setFileError(`ファイルサイズが${uploadConfig.maxFileSizeMB}MBを超えています`);
      return;
    }

    // ファイル形式チェック
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-ms-wmv', 'video/x-matroska'];
    if (!allowedTypes.includes(file.type)) {
      setFileError('サポートされていないファイル形式です。MP4、MOV、AVI、WebM、WMV、MKV形式を選択してください');
      return;
    }

    setSelectedFile(file);
    form.setValue('file', file);
    
    // ファイル名からタイトルを自動設定
    if (!form.getValues('title')) {
      const filename = file.name.replace(/\.[^/.]+$/, '');
      form.setValue('title', filename);
    }
  }, [form, uploadConfig]);

  // ドラッグ&ドロップ設定
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setFileError('');
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setFileError(`ファイルサイズが${uploadConfig.maxFileSizeMB}MBを超えています`);
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setFileError('サポートされていないファイル形式です。MP4、MOV、AVI、WebM、WMV、MKV形式を選択してください');
      } else {
        setFileError('ファイルのアップロードに失敗しました');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      handleFileSelect(acceptedFiles[0]);
    }
  }, [handleFileSelect, uploadConfig]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
      'video/webm': ['.webm'],
      'video/x-ms-wmv': ['.wmv'],
      'video/x-matroska': ['.mkv']
    },
    maxSize: uploadConfig.maxFileSizeMB * 1024 * 1024, // 管理者設定から取得
    multiple: false,
    disabled: isUploading,
  });

  // YouTube URL変更ハンドラー
  const handleYouTubeUrlChange = useCallback(async (url: string) => {
    form.setValue('youtubeUrl', url);
    setYoutubeMetadata(null);
    
    if (!url) return;

    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    if (youtubeRegex.test(url)) {
      setIsLoadingMetadata(true);
      try {
        const response = await fetch('/api/youtube/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeUrl: url }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setYoutubeMetadata(data.data);
            // メタデータからタイトルと説明を自動設定
            if (!form.getValues('title')) {
              form.setValue('title', data.data.title || '');
            }
            if (!form.getValues('description')) {
              form.setValue('description', data.data.description || '');
            }
            
            // YouTubeタグを自動追加（既存のタグと重複しないように）
            if (data.data.tags && Array.isArray(data.data.tags)) {
              const currentTags = form.getValues('tags') || [];
              const newTags = data.data.tags.filter((tag: string) => 
                !currentTags.includes(tag) && tag.trim().length > 0
              );
              
              if (newTags.length > 0) {
                const updatedTags = [...currentTags, ...newTags];
                form.setValue('tags', updatedTags);
                console.log('YouTubeタグを自動追加:', newTags);
              }
            }
          }
        }
      } catch (error) {
        console.error('YouTubeメタデータの取得に失敗しました:', error);
      } finally {
        setIsLoadingMetadata(false);
      }
    }
  }, [form]);

  // フォーム送信ハンドラー
  const handleSubmit = useCallback(async (values: UploadFormData) => {
    if (uploadMethod === 'file' && !selectedFile) {
      setFileError('ビデオファイルを選択してください');
      return;
    }

    if (uploadMethod === 'youtube' && !values.youtubeUrl) {
      form.setError('youtubeUrl', { message: 'YouTube URLを入力してください' });
      return;
    }

    await onSubmit({
      ...values,
      uploadMethod,
      tags: values.tags || [],
    });
  }, [uploadMethod, selectedFile, onSubmit, form]);

  // ファイル削除ハンドラー
  const handleFileRemove = useCallback(() => {
    setSelectedFile(null);
    setFileError('');
    form.setValue('file', undefined);
  }, [form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* ファイル/URL アップロードセクション */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              {uploadMethod === 'file' ? (
                <>
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FileVideo className="w-6 h-6 text-blue-600" />
                  </div>
                  ビデオファイル
                </>
              ) : (
                <>
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Link className="w-6 h-6 text-red-600" />
                  </div>
                  YouTube URL
                </>
              )}
            </CardTitle>
            <CardDescription className="text-base">
              {uploadMethod === 'file' 
                ? `MP4、MOV、AVI、WebM、WMV、MKV形式のビデオファイルをアップロードできます（最大${(uploadConfig.maxFileSizeMB / 1000).toFixed(1)}GB）`
                : 'YouTube動画のURLを入力してください'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadMethod === 'file' ? (
              <div className="space-y-4">
                {/* ファイルアップロードエリア */}
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
                    isDragActive 
                      ? 'border-blue-500 bg-blue-50/50 shadow-lg scale-105' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
                  } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input {...getInputProps()} />
                  <div className="space-y-4">
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                      isDragActive 
                        ? 'bg-blue-500 text-white shadow-lg' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Upload className={`w-8 h-8 ${isDragActive ? 'animate-bounce' : ''}`} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-gray-700">
                        {isDragActive 
                          ? 'ファイルをドロップしてください' 
                          : 'クリックしてファイルを選択、またはドラッグ&ドロップ'
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        最大{(uploadConfig.maxFileSizeMB / 1000).toFixed(1)}GB、MP4、MOV、AVI、WebM、WMV、MKV形式
                      </p>
                    </div>
                  </div>
                </div>

                {/* 選択されたファイル表示 */}
                {selectedFile && (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <FileVideo className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{selectedFile.name}</span>
                        <Badge variant="secondary" className="w-fit mt-1">
                          {(selectedFile.size / (1024 * 1024)).toFixed(1)}MB
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleFileRemove}
                      disabled={isUploading}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* ファイルエラー表示 */}
                {fileError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{fileError}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="youtubeUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube URL</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="https://www.youtube.com/watch?v=..."
                            {...field}
                            onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                            disabled={isUploading || isLoadingMetadata}
                          />
                          {isLoadingMetadata && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* YouTubeメタデータ表示 */}
                {youtubeMetadata && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <Youtube className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">{youtubeMetadata.title}</h4>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{youtubeMetadata.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>再生時間: {Math.floor(youtubeMetadata.duration / 60)}:{(youtubeMetadata.duration % 60).toString().padStart(2, '0')}</span>
                          <span>チャンネル: {youtubeMetadata.channelTitle}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 動画情報入力セクション */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Settings className="w-6 h-6 text-green-600" />
              </div>
              動画情報
            </CardTitle>
            <CardDescription>
              動画の詳細情報を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* タイトル */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>タイトル *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="動画のタイトルを入力してください" 
                      {...field} 
                      disabled={isUploading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 説明 */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>説明 *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="動画の説明を入力してください" 
                      className="min-h-[100px]" 
                      {...field} 
                      disabled={isUploading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* カテゴリ */}
            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>カテゴリ *</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={categories.map(cat => ({ value: cat.slug, label: cat.name }))}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="カテゴリを選択してください"
                      disabled={isUploading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* タグ */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>タグ</FormLabel>
                  <FormControl>
                    <TagInput
                      selectedTags={field.value || []}
                      onTagsChange={field.onChange}
                      availableTags={tags}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 公開設定 */}
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公開設定 *</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="public"
                          value="PUBLIC"
                          checked={field.value === 'PUBLIC'}
                          onChange={(e) => field.onChange(e.target.value)}
                          disabled={isUploading}
                          className="sr-only"
                        />
                        <label
                          htmlFor="public"
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all w-full ${
                            field.value === 'PUBLIC'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                          <div>
                            <div className="font-medium">学外公開</div>
                            <div className="text-sm text-gray-500">誰でも視聴可能</div>
                          </div>
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="private"
                          value="PRIVATE"
                          checked={field.value === 'PRIVATE'}
                          onChange={(e) => field.onChange(e.target.value)}
                          disabled={isUploading}
                          className="sr-only"
                        />
                        <label
                          htmlFor="private"
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all w-full ${
                            field.value === 'PRIVATE'
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <EyeOff className="w-4 h-4" />
                          <div>
                            <div className="font-medium">学内者限定</div>
                            <div className="text-sm text-gray-500">学内者のみ視聴可能</div>
                          </div>
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="draft"
                          value="DRAFT"
                          checked={field.value === 'DRAFT'}
                          onChange={(e) => field.onChange(e.target.value)}
                          disabled={isUploading}
                          className="sr-only"
                        />
                        <label
                          htmlFor="draft"
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all w-full ${
                            field.value === 'DRAFT'
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Lock className="w-4 h-4" />
                          <div>
                            <div className="font-medium">非公開</div>
                            <div className="text-sm text-gray-500">視聴不可</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 変換設定（ファイルアップロードの場合のみ） */}
            {uploadMethod === 'file' && (
              <FormField
                control={form.control}
                name="preset"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      変換設定
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isUploading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="変換プリセットを選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            <div className="flex flex-col">
                              <span className="font-medium">自動選択</span>
                              <span className="text-xs text-gray-500">動画の品質に応じて最適な設定を自動選択</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="web_4k">
                            <div className="flex flex-col">
                              <span className="font-medium">4K高品質</span>
                              <span className="text-xs text-gray-500">4K解像度、高品質AV1エンコード</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="web_2k">
                            <div className="flex flex-col">
                              <span className="font-medium">2K高品質</span>
                              <span className="text-xs text-gray-500">2K解像度、高品質AV1エンコード</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="web_1080p">
                            <div className="flex flex-col">
                              <span className="font-medium">1080p標準</span>
                              <span className="text-xs text-gray-500">1080p解像度、標準品質AV1エンコード</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="web_720p">
                            <div className="flex flex-col">
                              <span className="font-medium">720p軽量</span>
                              <span className="text-xs text-gray-500">720p解像度、軽量AV1エンコード</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="portrait_4k">
                            <div className="flex flex-col">
                              <span className="font-medium">4K縦型高品質</span>
                              <span className="text-xs text-gray-500">4K縦型動画用、高品質AV1エンコード</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="portrait_2k">
                            <div className="flex flex-col">
                              <span className="font-medium">2K縦型高品質</span>
                              <span className="text-xs text-gray-500">2K縦型動画用、高品質AV1エンコード</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="portrait_1080p">
                            <div className="flex flex-col">
                              <span className="font-medium">1080p縦型</span>
                              <span className="text-xs text-gray-500">1080p縦型動画用、標準品質AV1エンコード</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="portrait_720p">
                            <div className="flex flex-col">
                              <span className="font-medium">720p縦型軽量</span>
                              <span className="text-xs text-gray-500">720p縦型動画用、軽量AV1エンコード</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="preview">
                            <div className="flex flex-col">
                              <span className="font-medium">プレビュー</span>
                              <span className="text-xs text-gray-500">360p解像度、高速プレビュー用</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* 投稿スケジュール設定 */}
            <Card className="border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Clock className="w-5 h-5 text-purple-600" />
                  </div>
                  投稿スケジュール
                </CardTitle>
                <CardDescription>
                  動画をすぐに投稿するか、指定した日時に予約投稿するかを選択してください
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="scheduleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="immediate"
                              value="immediate"
                              checked={field.value === 'immediate'}
                              onChange={(e) => field.onChange(e.target.value)}
                              disabled={isUploading}
                              className="sr-only"
                            />
                            <label
                              htmlFor="immediate"
                              className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all w-full ${
                                field.value === 'immediate'
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Upload className="w-5 h-5" />
                              <div>
                                <div className="font-medium">即時投稿</div>
                                <div className="text-sm text-gray-500">アップロード完了後すぐに公開</div>
                              </div>
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="scheduled"
                              value="scheduled"
                              checked={field.value === 'scheduled'}
                              onChange={(e) => field.onChange(e.target.value)}
                              disabled={isUploading}
                              className="sr-only"
                            />
                            <label
                              htmlFor="scheduled"
                              className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all w-full ${
                                field.value === 'scheduled'
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Calendar className="w-5 h-5" />
                              <div>
                                <div className="font-medium">予約投稿</div>
                                <div className="text-sm text-gray-500">指定した日時に自動公開</div>
                              </div>
                            </label>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 予約投稿時刻選択 */}
                {form.watch('scheduleType') === 'scheduled' && (
                  <FormField
                    control={form.control}
                    name="scheduledPublishAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          投稿日時
                        </FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Input
                              type="datetime-local"
                              {...field}
                              disabled={isUploading}
                              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} // 現在時刻+1分
                              className="w-full"
                            />
                            <p className="text-sm text-gray-500">
                              選択した日時に動画が自動で公開されます。現在時刻より後の時刻を指定してください。
                            </p>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* 予約非公開時刻選択 */}
                <FormField
                  control={form.control}
                  name="scheduledUnpublishAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4" />
                        予約非公開日時（任意）
                      </FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="datetime-local"
                            {...field}
                            disabled={isUploading}
                            min={(() => {
                              const publishAt = form.watch('scheduledPublishAt');
                              if (publishAt && publishAt.length > 0) {
                                return new Date(new Date(publishAt).getTime() + 60000).toISOString().slice(0, 16);
                              }
                              return new Date(Date.now() + 60000).toISOString().slice(0, 16);
                            })()}
                            className="w-full"
                          />
                          <p className="text-sm text-gray-500">
                            {form.watch('scheduleType') === 'scheduled' 
                              ? '予約投稿時刻より後の時刻を指定してください。指定した日時に動画が自動で非公開になります。'
                              : '指定した日時に動画が自動で非公開になります。現在時刻より後の時刻を指定してください。'
                            }
                          </p>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* アップロードボタン */}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={isUploading}
            className="min-w-[200px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadProgress > 0 ? `アップロード中... ${Math.floor(uploadProgress)}%` : '処理中...'}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                アップロード
              </>
            )}
          </Button>
        </div>

        {/* 注意事項 */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>注意事項:</strong>
            <ul className="mt-2 space-y-1 text-sm">
              <li>• 学外公開は著作権等に問題のないコンテンツのみアップロードしてください</li>
              <li>• アップロードされた映像データは組織のポリシーに従って確認する場合があります</li>
              {uploadMethod === 'file' && (
                <li>• ファイルサイズの上限は{(uploadConfig.maxFileSizeMB / 1000).toFixed(1)}GBです</li>
              )}
              {uploadMethod === 'youtube' && (
                <li>• YouTube動画は元の動画が削除されると視聴できなくなります</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      </form>
    </Form>
  );
};