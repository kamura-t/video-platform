'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { canUploadVideos } from '@/lib/auth';
import { VideoUploadForm } from '@/components/upload/video-upload-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface UploadData {
  title: string;
  description: string;
  categories: string[]; // カテゴリのスラッグを格納
  tags: string[];
  visibility: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
  file?: File;
  youtubeUrl?: string;
  uploadMethod: 'file' | 'youtube';
  preset?: string;
}

interface UploadProgress {
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  message: string;
}

export default function UploadPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    status: 'idle',
    message: '',
  });
  const [uploadMethod, setUploadMethod] = useState<'file' | 'youtube'>('file');
  const [error, setError] = useState<string>('');

  // アップロード権限チェック
  const hasUploadPermission = isAuthenticated && user && canUploadVideos(user.role);

  const handleUpload = useCallback(async (data: UploadData) => {
    try {
      setError('');
      setUploadProgress({
        progress: 0,
        status: 'uploading',
        message: 'アップロードを開始しています...',
      });

      const uploadMethod = data.uploadMethod;
      let response: Response;

      if (uploadMethod === 'file' && data.file) {
        // ファイルアップロード
        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('description', data.description);
        // 複数カテゴリの場合は最初のカテゴリのスラッグを使用
        const categoryValue = data.categories.length > 0 ? data.categories[0] : '';
        formData.append('category', categoryValue);
        formData.append('tags', JSON.stringify(data.tags || []));
        formData.append('visibility', data.visibility);
        formData.append('uploadMethod', uploadMethod);
        formData.append('preset', data.preset || 'auto');
        formData.append('file', data.file);

        // 進捗シミュレーション
        const simulateProgress = () => {
          let progress = 0;
          const interval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 90) {
              clearInterval(interval);
              progress = 90;
            }
            setUploadProgress(prev => ({
              ...prev,
              progress: Math.min(progress, 90),
              message: progress < 30 ? 'ファイルをアップロード中...' : 
                      progress < 60 ? 'サーバーで処理中...' : 
                      'データベースに保存中...'
            }));
          }, 200);
          return interval;
        };

        const progressInterval = simulateProgress();

        response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        clearInterval(progressInterval);
      } else {
        // YouTube URL
        const uploadData = {
          title: data.title,
          description: data.description,
          category: data.categories.length > 0 ? data.categories[0] : '',
          tags: data.tags || [],
          visibility: data.visibility,
          youtubeUrl: data.youtubeUrl,
          uploadMethod: uploadMethod,
        };

        setUploadProgress({
          progress: 50,
          status: 'uploading',
          message: 'YouTubeデータを処理中...',
        });

        response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(uploadData),
        });
      }

      setUploadProgress({
        progress: 95,
        status: 'processing',
        message: 'GPU変換を開始しています...',
      });

      const responseText = await response.text();
      let result;
      
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error('Response parsing failed:', responseText);
        throw new Error('サーバーからの応答を解析できませんでした');
      }

      if (!response.ok) {
        throw new Error(result.error || `アップロードに失敗しました (${response.status})`);
      }

      if (!result.success) {
        throw new Error(result.error || 'アップロードに失敗しました');
      }

      setUploadProgress({
        progress: 100,
        status: 'completed',
        message: 'アップロードが完了しました！',
      });

      // 成功時の処理
      setTimeout(() => {
        if (result.data?.videoId) {
          router.push(`/upload/complete?videoId=${result.data.videoId}`);
        } else {
          router.push('/');
        }
      }, 1500);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'アップロードに失敗しました';
      setError(errorMessage);
      setUploadProgress({
        progress: 0,
        status: 'error',
        message: errorMessage,
      });
    }
  }, [router]);

  // 権限がない場合の表示
  if (!hasUploadPermission) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                アクセス権限がありません
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDescription>
                動画のアップロードには適切な権限が必要です。管理者に連絡してください。
              </AlertDescription>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* ヘッダー */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              戻る
            </Button>
            <div>
              <h1 className="text-2xl font-bold">動画をアップロード</h1>
              <p className="text-muted-foreground">
                新しい動画をアップロードして共有しましょう
              </p>
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 成功メッセージ */}
          {uploadProgress.status === 'completed' && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                アップロードが完了しました！リダイレクトしています...
              </AlertDescription>
            </Alert>
          )}

          {/* アップロード方法選択 */}
          <Card>
            <CardHeader>
              <CardTitle>アップロード方法を選択</CardTitle>
              <CardDescription>
                ファイルをアップロードするか、YouTube URLを使用してビデオを追加できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={uploadMethod} onValueChange={(value) => setUploadMethod(value as 'file' | 'youtube')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    ファイルアップロード
                  </TabsTrigger>
                  <TabsTrigger value="youtube" className="flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    YouTube URL
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="file" className="mt-6">
                  <VideoUploadForm
                    uploadMethod="file"
                    onSubmit={handleUpload}
                    isUploading={uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'}
                    uploadProgress={uploadProgress.progress}
                  />
                </TabsContent>
                
                <TabsContent value="youtube" className="mt-6">
                  <VideoUploadForm
                    uploadMethod="youtube"
                    onSubmit={handleUpload}
                    isUploading={uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'}
                    uploadProgress={uploadProgress.progress}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}