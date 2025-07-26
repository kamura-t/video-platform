'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ThumbnailUpload } from '@/components/upload/thumbnail-upload';
import { VideoPreviewPlayer } from '@/components/video/video-preview-player';
import { ArrowLeft, Save, Eye, Plus, Hash, Clock, Calendar, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface Video {
  videoId: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  duration: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  filePath: string;
  convertedFilePath: string | null;
  transcodeJobId: string | null;
  uploadType: string;
  uploader: {
    id: number;
    username: string;
    displayName: string;
    profileImageUrl: string;
  };
  categories: {
    category: {
      id: number;
      name: string;
    };
  }[];
  tags: {
    tag: {
      id: number;
      name: string;
    };
  }[];
  posts: {
    postId: string;
    title: string;
    visibility: string;
    scheduledPublishAt: string | null;
    scheduledUnpublishAt: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
}

interface Category {
  id: number;
  name: string;
}

interface Tag {
  id: number;
  name: string;
}

export default function VideoEditClient({ id }: { id: string }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewTagDialog, setShowNewTagDialog] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // フォームデータ
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState('PUBLIC');
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledPublishAt, setScheduledPublishAt] = useState('');
  const [scheduledUnpublishAt, setScheduledUnpublishAt] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [optimizationInfo, setOptimizationInfo] = useState<{
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    dimensions: string;
    format: string;
  } | null>(null);

  const [thumbnailUpdateKey, setThumbnailUpdateKey] = useState(0);

  // 変換結果とメタデータの状態
  const [transcodeInfo, setTranscodeInfo] = useState<{
    inputSizeMB: number;
    outputSizeMB: number;
    compressionRate: number;
    processingTime: number;
    completedAt: string;
    videoMetadata: {
      video: {
        resolution: string;
        bitrate: string;
        frameRate: string;
        codec: string;
        pixelFormat: string;
        aspectRatio: string;
        colorSpace: string;
        profile?: string;
        level?: string;
      };
      audio: {
        codec: string;
        bitrate: string;
        sampleRate: string;
        channels: number;
        channelLayout: string;
        sampleFormat: string;
        profile?: string;
      };
    };
  } | null>(null);

  // 認証チェック
  useEffect(() => {
    if (!isLoading && (!user || !['ADMIN', 'CURATOR'].includes(user.role))) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // 動画データ取得
  const fetchVideo = async () => {
    try {
      setLoading(true);
      console.log('Fetching video with ID:', id);
      const response = await fetch(`/api/admin/videos/${id}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
        console.error('Response URL:', response.url);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        
        let errorData = {};
        try {
          const responseText = await response.text();
          console.error('Raw response:', responseText);
          if (responseText) {
            errorData = JSON.parse(responseText);
          }
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
        }
        
        console.error('Parsed error data:', errorData);
        
        if (response.status === 404 && errorData && typeof errorData === 'object' && 'debug' in errorData) {
          console.log('Debug info:', (errorData as any).debug);
          const debug = (errorData as any).debug;
          throw new Error(`動画が見つかりません (ID: ${id}). 利用可能な動画: ${debug?.availableVideos?.join(', ') || 'なし'}`);
        }
        
        throw new Error(`動画の取得に失敗しました: ${(errorData && typeof errorData === 'object' && 'error' in errorData) ? (errorData as any).error : response.statusText}`);
      }

      const data = await response.json();
      setVideo(data.video);
      
      // フォームデータを設定（IDを文字列に変換）
      setTitle(data.video.title);
      setDescription(data.video.description || '');
      setYoutubeUrl(data.video.youtubeUrl || '');
      setSelectedCategories(data.video.categories.map((c: any) => c.category.id.toString()));
      setSelectedTags(data.video.tags.map((t: any) => t.tag.id.toString()));
      const initialVisibility = data.video.posts[0]?.visibility || 'PUBLIC';
      setVisibility(initialVisibility);
      
      // 予約投稿の設定を初期化
      const post = data.video.posts[0];
      if (post?.scheduledPublishAt) {
        setScheduleType('scheduled');
        setScheduledPublishAt(new Date(post.scheduledPublishAt).toISOString().slice(0, 16));
      } else {
        setScheduleType('immediate');
      }
      
      if (post?.scheduledUnpublishAt) {
        setScheduledUnpublishAt(new Date(post.scheduledUnpublishAt).toISOString().slice(0, 16));
      }

      // 変換結果とメタデータを取得（FILEタイプの場合のみ）
      if (data.video.uploadType === 'FILE' && data.video.transcodeJobId) {
        console.log('TranscodeJobId found:', data.video.transcodeJobId);
        try {
          const transcodeResponse = await fetch(`/api/transcode/job/${data.video.transcodeJobId}`, {
            credentials: 'include'
          });
          console.log('Transcode response status:', transcodeResponse.status);
          if (transcodeResponse.ok) {
            const transcodeData = await transcodeResponse.json();
            console.log('Transcode data:', transcodeData);
            if (transcodeData.success && transcodeData.data.status === 'COMPLETED') {
              setTranscodeInfo({
                inputSizeMB: transcodeData.data.inputSizeMB || 0,
                outputSizeMB: transcodeData.data.outputSizeMB || 0,
                compressionRate: transcodeData.data.compressionRate || 0,
                processingTime: transcodeData.data.processingTime || 0,
                completedAt: transcodeData.data.completedAt || '',
                videoMetadata: transcodeData.data.videoMetadata
              });
              console.log('TranscodeInfo set successfully');
            }
          } else {
            console.error('Transcode response not ok:', transcodeResponse.status);
          }
        } catch (transcodeError) {
          console.error('変換情報の取得に失敗:', transcodeError);
        }
      } else {
        console.log('No transcodeJobId or not FILE type:', {
          uploadType: data.video.uploadType,
          transcodeJobId: data.video.transcodeJobId
        });
      }
    } catch (error) {
      console.error('動画取得エラー:', error);
      toast.error('動画の取得に失敗しました');
      router.push('/admin/videos');
    } finally {
      setLoading(false);
    }
  };

  // カテゴリ・タグ取得
  const fetchCategoriesAndTags = async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch('/api/categories', { credentials: 'include' }),
        fetch('/api/tags', { credentials: 'include' })
      ]);

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        if (categoriesData.success) {
          // IDを数値のまま保持
          const categories = (categoriesData.data || []).map((cat: any) => ({
            ...cat,
            id: parseInt(cat.id)
          }));
          setCategories(categories);
        }
      }

      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        if (tagsData.success) {
          // IDを数値のまま保持
          const tags = (tagsData.data || []).map((tag: any) => ({
            ...tag,
            id: parseInt(tag.id)
          }));
          setTags(tags);
        }
      }
    } catch (error) {
      console.error('カテゴリ・タグ取得エラー:', error);
    }
  };

  // サムネイル選択
  const handleThumbnailSelect = (file: File) => {
    setThumbnailFile(file);
  };

  const handleThumbnailGenerated = (thumbnailUrl: string) => {
    // サムネイルが生成されたら、動画のサムネイルURLを更新
    if (video) {
      console.log('サムネイル生成後のURL更新:', {
        oldUrl: video.thumbnailUrl,
        newUrl: thumbnailUrl
      });
      setVideo({
        ...video,
        thumbnailUrl
      });
      // 強制的に再レンダリングを促す
      setThumbnailUpdateKey(prev => prev + 1);
      // 成功メッセージを表示
      toast.success('サムネイルが生成されました');
      
      // 少し待ってから再度状態を更新（キャッシュ対策）
      setTimeout(() => {
        setThumbnailUpdateKey(prev => prev + 1);
      }, 100);
    }
  };

  // ThumbnailUpload用のサムネイル生成ハンドラー
  const handleThumbnailUploadGenerated = (thumbnailFile: File) => {
    // ファイルからURLを生成してvideoのthumbnailUrlを更新
    const thumbnailUrl = URL.createObjectURL(thumbnailFile);
    if (video) {
      setVideo({
        ...video,
        thumbnailUrl
      });
    }
    setThumbnailFile(thumbnailFile);
    // 強制的に再レンダリングを促す
    setThumbnailUpdateKey(prev => prev + 1);
  };

  // サムネイル削除時のハンドラー
  const handleThumbnailDeleted = () => {
    if (video) {
      setVideo({
        ...video,
        thumbnailUrl: ''
      });
    }
    setThumbnailFile(null);
    // 強制的に再レンダリングを促す
    setThumbnailUpdateKey(prev => prev + 1);
    // 成功メッセージを表示
    toast.success('サムネイルを削除しました');
  };

  // 新しいタグ作成
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('タグ名を入力してください');
      return;
    }

    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          name: newTagName.trim(),
          slug: newTagName.trim().toLowerCase().replace(/\s+/g, '-')
        }),
      });

      if (!response.ok) {
        throw new Error('タグの作成に失敗しました');
      }

      const result = await response.json();
      if (result.success) {
        setTags(prev => [...prev, result.data]);
        setSelectedTags(prev => [...prev, result.data.id.toString()]);
        setShowNewTagDialog(false);
        setNewTagName('');
        toast.success('新しいタグを作成しました');
      }
    } catch (error) {
      console.error('タグ作成エラー:', error);
      toast.error('タグの作成に失敗しました');
    }
  };

  // 動画更新
  const handleSave = async () => {
    try {
      setSaving(true);
      
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('youtubeUrl', youtubeUrl);
      formData.append('categories', JSON.stringify(selectedCategories.map(id => parseInt(id))));
      formData.append('tags', JSON.stringify(selectedTags.map(id => parseInt(id))));
      
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
      }

      const videoResponse = await fetch(`/api/admin/videos/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });

      if (!videoResponse.ok) {
        throw new Error('動画の更新に失敗しました');
      }

      const videoResult = await videoResponse.json();

      if (videoResult.thumbnailUrl && video) {
        setVideo(prev => prev ? { ...prev, thumbnailUrl: videoResult.thumbnailUrl } : null);
        setThumbnailFile(null);
      }

      if (videoResult.compressionInfo) {
        setOptimizationInfo(videoResult.compressionInfo);
      }

      if (video?.posts[0]?.postId) {
        // 予約投稿データを準備
        const postUpdateData: any = { visibility };
        
        if (scheduleType === 'scheduled') {
          if (scheduledPublishAt) {
            postUpdateData.scheduledPublishAt = new Date(scheduledPublishAt).toISOString();
          }
        } else {
          postUpdateData.scheduledPublishAt = null;
        }
        
        if (scheduledUnpublishAt) {
          postUpdateData.scheduledUnpublishAt = new Date(scheduledUnpublishAt).toISOString();
        } else {
          postUpdateData.scheduledUnpublishAt = null;
        }

        const visibilityResponse = await fetch(`/api/admin/posts/${video.posts[0].postId}/visibility`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(postUpdateData),
        });

        if (!visibilityResponse.ok) {
          const errorData = await visibilityResponse.json().catch(() => ({}));
          throw new Error(`公開設定の更新に失敗しました: ${errorData.error || visibilityResponse.statusText}`);
        }

        const visibilityResult = await visibilityResponse.json();
      }

      toast.success('動画を更新しました');
      router.push('/admin/videos');
    } catch (error) {
      console.error('動画更新エラー:', error);
      toast.error('動画の更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (user && ['ADMIN', 'CURATOR'].includes(user.role)) {
      fetchVideo();
      fetchCategoriesAndTags();
    }
  }, [user, id]);

  if (isLoading || loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!user || !['ADMIN', 'CURATOR'].includes(user.role)) {
    return null;
  }

  if (!video) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <p className="text-muted-foreground">動画が見つかりません。</p>
          <Button onClick={() => router.push('/admin/videos')} className="mt-4">
            動画一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/videos')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            動画一覧に戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">動画編集</h1>
            <p className="text-muted-foreground mt-1">
              動画ID: {video.videoId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {video.posts[0] && (
            <Button
              variant="outline"
              onClick={() => router.push(`/watch/${video.posts[0].postId}`)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              動画を表示
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側のカラム */}
        <div className="lg:col-span-1 space-y-6">
          {/* サムネイル編集 */}
          <Card>
            <CardHeader>
              <CardTitle>サムネイル</CardTitle>
              <CardDescription>
                動画のサムネイル画像を変更できます
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 動画プレビュー */}
              <div className="space-y-4">
                
                <VideoPreviewPlayer
                  video={{
                    videoId: video.videoId,
                    title: video.title,
                    filePath: video.filePath,
                    convertedFilePath: video.convertedFilePath || undefined,
                    youtubeUrl: video.youtubeUrl,
                    duration: video.duration,
                    uploadType: video.uploadType
                  }}
                  onThumbnailGenerated={handleThumbnailGenerated}
                  className="w-full"
                />
              </div>
              
              <ThumbnailUpload
                onThumbnailSelect={handleThumbnailUploadGenerated}
                uploadMethod={video.uploadType === 'YOUTUBE' ? 'youtube' : 'file'}
                optimizationInfo={optimizationInfo || undefined}
                videoId={video.videoId}
                currentThumbnailUrl={video.thumbnailUrl}
                onThumbnailDeleted={handleThumbnailDeleted}
              />
              {thumbnailFile && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    新しいサムネイルが選択されました: {thumbnailFile.name}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 動画プレビュー */}
          <Card>
            <CardHeader>
              <CardTitle>動画情報</CardTitle>
            
               {/* 動画基本情報 */}
             <div className="space-y-2 text-sm text-muted-foreground">
              <p>投稿者: {video.uploader.displayName}</p>
                <p>再生回数: {video.viewCount.toLocaleString()}</p>
                <p>時間: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</p>
                {video.youtubeUrl && (
                  <p>YouTube URL: 
                    <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                      {video.youtubeUrl}
                    </a>
                  </p>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">

              {/* 変換結果とメタデータ（FILEタイプの場合のみ） */}
              {video.uploadType === 'FILE' && transcodeInfo && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-sm text-gray-700">変換結果</h4>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div>
                        <span className="text-gray-500">元ファイルサイズ</span>
                        <p className="font-medium">{transcodeInfo.inputSizeMB.toFixed(1)} MB</p>
                      </div>
                      <div>
                        <span className="text-gray-500">変換後サイズ</span>
                        <p className="font-medium">{transcodeInfo.outputSizeMB.toFixed(1)} MB</p>
                      </div>
                      <div>
                        <span className="text-gray-500">圧縮率</span>
                        <p className="font-medium">{transcodeInfo.compressionRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <span className="text-gray-500">処理時間</span>
                        <p className="font-medium">
                          {transcodeInfo.processingTime < 60 
                            ? `${Math.round(transcodeInfo.processingTime)}秒`
                            : transcodeInfo.processingTime < 3600
                            ? `${Math.floor(transcodeInfo.processingTime / 60)}分${Math.floor(transcodeInfo.processingTime % 60)}秒`
                            : `${Math.floor(transcodeInfo.processingTime / 3600)}時間${Math.floor((transcodeInfo.processingTime % 3600) / 60)}分`
                          }
                        </p>
                      </div>
                    </div>

                    {/* 変換後メタデータ */}
                    {transcodeInfo.videoMetadata && (
                      <div className="border-t border-green-200 pt-3">
                        <h5 className="font-medium text-xs text-gray-700 mb-2">変換後メタデータ</h5>
                        <div className="space-y-2 text-xs">
                          {/* 映像情報 */}
                          <div className="bg-blue-50 p-2 rounded">
                            <h6 className="font-medium text-blue-700 mb-1">映像情報</h6>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">解像度</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.video.resolution}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">ビットレート</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.video.bitrate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">フレームレート</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.video.frameRate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">コーデック</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.video.codec}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">ピクセルフォーマット</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.video.pixelFormat}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">アスペクト比</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.video.aspectRatio}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">カラースペース</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.video.colorSpace}</span>
                              </div>
                              {transcodeInfo.videoMetadata.video.profile && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">プロファイル</span>
                                  <span className="font-medium">{transcodeInfo.videoMetadata.video.profile}</span>
                                </div>
                              )}
                              {transcodeInfo.videoMetadata.video.level && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">レベル</span>
                                  <span className="font-medium">{transcodeInfo.videoMetadata.video.level}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 音声情報 */}
                          <div className="bg-purple-50 p-2 rounded">
                            <h6 className="font-medium text-purple-700 mb-1">音声情報</h6>
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-500">コーデック</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.audio.codec}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">ビットレート</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.audio.bitrate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">サンプリングレート</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.audio.sampleRate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">チャンネル数</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.audio.channels}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">チャンネルレイアウト</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.audio.channelLayout}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">サンプルフォーマット</span>
                                <span className="font-medium">{transcodeInfo.videoMetadata.audio.sampleFormat}</span>
                              </div>
                              {transcodeInfo.videoMetadata.audio.profile && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">プロファイル</span>
                                  <span className="font-medium">{transcodeInfo.videoMetadata.audio.profile}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 編集フォーム */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {/* 動画情報 */}
            <Card>
              <CardHeader>
                <CardTitle>動画情報</CardTitle>
                <CardDescription>
                  動画の詳細情報を編集できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="title">タイトル</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="動画タイトルを入力"
                  />
                </div>

                {/* YouTube URL入力フィールド - YouTube投稿の場合のみ表示 */}
                {video?.uploadType === 'YOUTUBE' && (
                  <div>
                    <Label htmlFor="youtubeUrl">YouTube URL</Label>
                    <Input
                      id="youtubeUrl"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      type="url"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      YouTube動画のURLを変更できます
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="description">説明</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="動画の説明を入力"
                    rows={16}
                  />
                </div>

                <div>
                  <Label htmlFor="visibility">公開設定</Label>
                  <Select value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger>
                      <SelectValue placeholder="公開設定を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">パブリック（インターネット公開）</SelectItem>
                      <SelectItem value="PRIVATE">プライベート（組織内LAN限定）</SelectItem>
                      <SelectItem value="DRAFT">非公開（完全非公開）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* 予約投稿設定 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-purple-600" />
                  投稿スケジュール
                </CardTitle>
                <CardDescription>
                  動画の公開・非公開スケジュールを設定できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* スケジュールタイプ選択 */}
                <div>
                  <Label className="text-base font-medium">投稿タイプ</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="immediate-edit"
                        value="immediate"
                        checked={scheduleType === 'immediate'}
                        onChange={(e) => setScheduleType(e.target.value as 'immediate' | 'scheduled')}
                        disabled={saving}
                        className="sr-only"
                      />
                      <label
                        htmlFor="immediate-edit"
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all w-full ${
                          scheduleType === 'immediate'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Eye className="w-5 h-5" />
                        <div>
                          <div className="font-medium">即時公開</div>
                          <div className="text-sm text-gray-500">現在の公開設定に従って表示</div>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="scheduled-edit"
                        value="scheduled"
                        checked={scheduleType === 'scheduled'}
                        onChange={(e) => setScheduleType(e.target.value as 'immediate' | 'scheduled')}
                        disabled={saving}
                        className="sr-only"
                      />
                      <label
                        htmlFor="scheduled-edit"
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all w-full ${
                          scheduleType === 'scheduled'
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
                </div>

                {/* 予約投稿時刻選択 */}
                {scheduleType === 'scheduled' && (
                  <div>
                    <Label htmlFor="scheduledPublishAt" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      投稿日時
                    </Label>
                    <Input
                      id="scheduledPublishAt"
                      type="datetime-local"
                      value={scheduledPublishAt}
                      onChange={(e) => setScheduledPublishAt(e.target.value)}
                      disabled={saving}
                      min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                      className="mt-2"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      選択した日時に動画が自動で公開されます。現在時刻より後の時刻を指定してください。
                    </p>
                  </div>
                )}

                {/* 予約非公開時刻選択 */}
                <div>
                  <Label htmlFor="scheduledUnpublishAt" className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4" />
                    予約非公開日時（任意）
                  </Label>
                  <Input
                    id="scheduledUnpublishAt"
                    type="datetime-local"
                    value={scheduledUnpublishAt}
                    onChange={(e) => setScheduledUnpublishAt(e.target.value)}
                    disabled={saving}
                    min={(() => {
                      if (scheduleType === 'scheduled' && scheduledPublishAt) {
                        return new Date(new Date(scheduledPublishAt).getTime() + 60000).toISOString().slice(0, 16);
                      }
                      return new Date(Date.now() + 60000).toISOString().slice(0, 16);
                    })()}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {scheduleType === 'scheduled' 
                      ? '予約投稿時刻より後の時刻を指定してください。指定した日時に動画が自動で非公開になります。'
                      : '指定した日時に動画が自動で非公開になります。現在時刻より後の時刻を指定してください。'
                    }
                  </p>
                </div>

                {/* 現在のスケジュール状態表示 */}
                {(scheduleType === 'scheduled' && scheduledPublishAt) || scheduledUnpublishAt ? (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">設定されたスケジュール</h4>
                    <div className="space-y-2 text-sm">
                      {scheduleType === 'scheduled' && scheduledPublishAt && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="text-blue-800">
                            投稿予定: {new Date(scheduledPublishAt).toLocaleString('ja-JP')}
                          </span>
                        </div>
                      )}
                      {scheduledUnpublishAt && (
                        <div className="flex items-center gap-2">
                          <EyeOff className="w-4 h-4 text-blue-600" />
                          <span className="text-blue-800">
                            非公開予定: {new Date(scheduledUnpublishAt).toLocaleString('ja-JP')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* カテゴリとタグ */}
            <Card>
              <CardHeader>
                <CardTitle>カテゴリとタグ</CardTitle>
                <CardDescription>
                  動画のカテゴリとタグを設定できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* 現在の設定確認 - 上段に移動 */}
                <div className="space-y-4 pb-4 border-b">
                  <Label className="text-base font-medium">現在の設定</Label>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">選択中のカテゴリ</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedCategories.length > 0 ? (
                          selectedCategories.map((categoryId) => {
                            const category = categories.find(c => c.id.toString() === categoryId);
                            return category ? (
                              <Badge key={categoryId} variant="secondary">
                                {category.name}
                              </Badge>
                            ) : (
                              <Badge key={categoryId} variant="destructive">
                                ID:{categoryId} (見つからない)
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-sm text-muted-foreground">なし</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">選択中のタグ</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTags.length > 0 ? (
                          selectedTags.map((tagId) => {
                            const tag = tags.find(t => t.id.toString() === tagId);
                            return tag ? (
                              <Badge key={tagId} variant="outline">
                                #{tag.name}
                              </Badge>
                            ) : (
                              <Badge key={tagId} variant="destructive">
                                ID:{tagId} (見つからない)
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-sm text-muted-foreground">なし</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* カテゴリ選択 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">カテゴリ</Label>
                    <Badge variant="outline" className="text-xs">
                      {selectedCategories.length}個選択中
                    </Badge>
                  </div>
                  
                  {categories.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {categories.map((category) => {
                        const isSelected = selectedCategories.includes(category.id.toString());
                        return (
                          <div
                            key={category.id}
                            onClick={() => {
                              setSelectedCategories(prev =>
                                prev.includes(category.id.toString())
                                  ? prev.filter(id => id !== category.id.toString())
                                  : [...prev, category.id.toString()]
                              );
                            }}
                            className={`
                              p-3 rounded-lg border-2 cursor-pointer transition-all
                              ${isSelected 
                                ? 'border-primary bg-primary/10 text-primary' 
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${isSelected ? 'bg-primary' : 'bg-gray-300'}`} />
                              <span className="text-sm font-medium">{category.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>カテゴリがありません</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        <Plus className="w-4 h-4 mr-2" />
                        カテゴリを作成
                      </Button>
                    </div>
                  )}
                </div>

                {/* タグ選択 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">タグ</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {selectedTags.length}/5個選択中
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewTagDialog(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        新規作成
                      </Button>
                    </div>
                  </div>
                  
                  {tags.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {tags.map((tag) => {
                          const isSelected = selectedTags.includes(tag.id.toString());
                          const isDisabled = !isSelected && selectedTags.length >= 5;
                          return (
                            <div
                              key={tag.id}
                              onClick={() => {
                                if (isDisabled) return;
                                setSelectedTags(prev =>
                                  prev.includes(tag.id.toString())
                                    ? prev.filter(id => id !== tag.id.toString())
                                    : [...prev, tag.id.toString()]
                                );
                              }}
                              className={`
                                p-2 rounded-md border cursor-pointer transition-all text-sm
                                ${isSelected 
                                  ? 'border-primary bg-primary text-primary-foreground' 
                                  : isDisabled
                                  ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }
                              `}
                            >
                              <div className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                <span className="truncate">{tag.name}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>タグがありません</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setShowNewTagDialog(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        タグを作成
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* 新しいタグ作成ダイアログ */}
      <Dialog open={showNewTagDialog} onOpenChange={setShowNewTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいタグを作成</DialogTitle>
            <DialogDescription>
              新しいタグを作成して動画に追加します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newTagName">タグ名</Label>
              <Input
                id="newTagName"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="タグ名を入力"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTag();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNewTagDialog(false);
              setNewTagName('');
            }}>
              キャンセル
            </Button>
            <Button onClick={handleCreateTag} disabled={!newTagName.trim()}>
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 