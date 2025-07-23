'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Edit, Eye, EyeOff, Search, Filter, Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Video {
  id: string;
  videoId: string;
  title: string;
  description: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  duration: number;
  views?: number;
  viewCount?: number;
  createdAt: string;
  updatedAt: string;
  uploader?: {
    id: string;
    username: string;
    displayName: string;
  };
  author?: {
    id: string;
    name: string;
    username: string;
    displayName?: string;
    profileImageUrl?: string;
  };
  categories: {
    id: string;
    name: string;
    slug: string;
    color: string;
  }[];
  tags: {
    id: string;
    name: string;
    slug: string;
  }[];
  posts: {
    postId: string;
    title: string;
    visibility: string;
    createdAt: string;
  }[];
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  videoCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminVideosPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedUploader, setSelectedUploader] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalVideos, setTotalVideos] = useState(0);
  const [uploaders, setUploaders] = useState<{ id: string; username: string; displayName: string; videoCount: number }[]>([]);

  // 認証チェック
  useEffect(() => {
    if (!isLoading && (!user || !['ADMIN', 'CURATOR'].includes(user.role))) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // 投稿者一覧取得
  const fetchUploaders = async () => {
    try {
      const response = await fetch('/api/admin/users?onlyUploaders=true');
      if (response.ok) {
              const data = await response.json();
      setUploaders(data.data || data.users || []);
      }
    } catch (error) {
      console.error('投稿者取得エラー:', error);
    }
  };

  // 動画一覧取得
  const fetchVideos = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setLoading(true);
        setCurrentPage(1);
      }
      
      const page = isLoadMore ? currentPage + 1 : 1;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: searchQuery,
        category: selectedCategory !== 'all' ? selectedCategory : '',
        uploader: selectedUploader !== 'all' ? selectedUploader : '',
        sortBy,
        sortOrder,
        includePrivate: 'true' // 管理者は非公開動画も表示
      });

      const response = await fetch(`/api/videos?${params}`);
      if (!response.ok) {
        throw new Error('動画の取得に失敗しました');
      }

      const data = await response.json();
      const newVideos = data.data?.videos || data.videos || [];
      
      if (isLoadMore) {
        setVideos(prev => [...prev, ...newVideos]);
        setCurrentPage(page);
      } else {
        setVideos(newVideos);
        setCurrentPage(1);
      }
      
      setHasMore(newVideos.length === 20); // 20件未満なら最後のページ
      setTotalVideos(data.data?.total || data.total || 0);
    } catch (error) {
      console.error('動画取得エラー:', error);
      toast.error('動画の取得に失敗しました');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  // カテゴリ取得
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
              const data = await response.json();
      setCategories(data.data || data.categories || []); // data.dataからカテゴリを取得
      }
    } catch (error) {
      console.error('カテゴリ取得エラー:', error);
    }
  };

  // 動画削除
  const deleteVideo = async (videoId: string) => {
    try {
      const response = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('動画の削除に失敗しました');
      }

      toast.success('動画を削除しました');
      fetchVideos(); // 一覧を再取得
    } catch (error) {
      console.error('動画削除エラー:', error);
      toast.error('動画の削除に失敗しました');
    }
  };

  // 公開設定変更
  const changeVisibility = async (postId: string, newVisibility: string) => {
    try {
      const response = await fetch(`/api/admin/posts/${postId}/visibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (!response.ok) {
        throw new Error('公開設定の変更に失敗しました');
      }

      const visibilityText = newVisibility === 'PUBLIC' ? '学外公開' : 
                           newVisibility === 'PRIVATE' ? '学内限定' : '非公開';
      toast.success(`動画を${visibilityText}に設定しました`);
      fetchVideos(); // 一覧を再取得
    } catch (error) {
      console.error('公開設定変更エラー:', error);
      toast.error('公開設定の変更に失敗しました');
    }
  };

  // 時間フォーマット
  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || seconds === 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (user && ['ADMIN', 'CURATOR'].includes(user.role)) {
      fetchVideos(false);
    }
  }, [user, searchQuery, selectedCategory, selectedUploader, sortBy, sortOrder]);

  // 初回のみカテゴリと投稿者一覧を取得
  useEffect(() => {
    if (user && ['ADMIN', 'CURATOR'].includes(user.role)) {
      fetchCategories();
      fetchUploaders();
    }
  }, [user]);

  // 検索・フィルター変更時はリセット
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
  };

  const handleUploaderChange = (value: string) => {
    setSelectedUploader(value);
  };

  const shouldShowLoading = isLoading || loading
  const shouldShowContent = user && ['ADMIN', 'CURATOR'].includes(user.role)

  if (shouldShowLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!shouldShowContent) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">権限がありません</div>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">動画管理</h1>
            <p className="text-muted-foreground mt-2">
              全{totalVideos}件の動画
            </p>
          </div>
          <Button onClick={() => router.push('/upload')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新規動画追加
          </Button>
        </div>

      {/* 検索・フィルター */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            検索・フィルター
            {user?.role === 'CURATOR' && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                （自分がアップロードした動画のみ表示）
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${user?.role === 'ADMIN' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="動画を検索..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="カテゴリ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのカテゴリ</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {user?.role === 'ADMIN' && (
              <Select value={selectedUploader} onValueChange={handleUploaderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="投稿者" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての投稿者</SelectItem>
                  {uploaders.map((uploader) => (
                    <SelectItem key={uploader.id} value={uploader.id}>
                      {uploader.displayName || uploader.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="並び順" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">作成日時</SelectItem>
                <SelectItem value="title">タイトル</SelectItem>
                <SelectItem value="views">再生回数</SelectItem>
                <SelectItem value="duration">動画時間</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <SelectValue placeholder="昇順/降順" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">降順</SelectItem>
                <SelectItem value="asc">昇順</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 動画一覧 */}
      <div className="space-y-4">
        {videos.map((video) => (
          <Card key={video.videoId}>
            <CardContent className="p-6">
              <div className="flex gap-4">
                {/* サムネイル */}
                <div className="flex-shrink-0">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-32 h-24 object-cover rounded"
                  />
                </div>

                {/* 動画情報 */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{video.title}</h3>
                      {video.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">
                          {video.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        <span className="whitespace-nowrap">投稿者: {video.author?.displayName || video.author?.username || video.uploader?.displayName || video.uploader?.username || '不明'}</span>
                        <span className="whitespace-nowrap">時間: {formatDuration(video.duration)}</span>
                        <span className="whitespace-nowrap">再生回数: {(video.views || video.viewCount || 0).toLocaleString()}</span>
                        <span className="whitespace-nowrap">
                          作成日: {format(new Date(video.createdAt), 'yyyy/MM/dd HH:mm', { locale: ja })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {video.categories.map((cat) => (
                          <Badge key={cat.id} variant="secondary" className="text-xs">
                            {cat.name}
                          </Badge>
                        ))}
                        {video.tags.map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-xs">
                            #{tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* アクション */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
                      {video.posts.map((post) => (
                        <div key={post.postId} className="flex items-center gap-2">
                          {/* 公開設定の変更は管理者または自分の動画の場合のみ表示 */}
                          {(user?.role === 'ADMIN' || 
                            video.uploader?.id === user?.id.toString() || 
                            video.author?.id === user?.id.toString() ||
                            video.author?.id === user?.id) && (
                            <Select
                              value={post.visibility}
                              onValueChange={(value) => changeVisibility(post.postId, value)}
                            >
                              <SelectTrigger className="w-auto min-w-[120px]">
                                <SelectValue>
                                  <div className="flex items-center gap-1">
                                    {post.visibility === 'PUBLIC' ? (
                                      <>
                                        <Eye className="h-4 w-4" />
                                        学外公開
                                      </>
                                    ) : post.visibility === 'PRIVATE' ? (
                                      <>
                                        <EyeOff className="h-4 w-4" />
                                        学内限定
                                      </>
                                    ) : (
                                      <>
                                        <FileText className="h-4 w-4" />
                                        非公開
                                      </>
                                    )}
                                  </div>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PUBLIC">
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-4 w-4" />
                                    学外公開
                                  </div>
                                </SelectItem>
                                <SelectItem value="PRIVATE">
                                  <div className="flex items-center gap-2">
                                    <EyeOff className="h-4 w-4" />
                                    学内限定
                                  </div>
                                </SelectItem>
                                <SelectItem value="DRAFT">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    非公開
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/watch/${post.postId}`)}
                            className="flex items-center gap-1 whitespace-nowrap"
                          >
                            <Eye className="h-4 w-4" />
                            表示
                          </Button>
                        </div>
                      ))}
                      
                      {/* 編集・削除ボタンは管理者または自分の動画の場合のみ表示 */}
                      {(() => {
                        const isAdmin = user?.role === 'ADMIN';
                        const isOwner = video.uploader?.id === user?.id.toString() || 
                                      video.author?.id === user?.id.toString() ||
                                      video.author?.id === user?.id;
                        
                        // デバッグ情報（開発環境のみ）
                        if (process.env.NODE_ENV === 'development') {
                          console.log('権限チェック:', {
                            videoId: video.id,
                            userRole: user?.role,
                            userId: user?.id,
                            uploaderId: video.uploader?.id,
                            authorId: video.author?.id,
                            isAdmin,
                            isOwner,
                            showButtons: isAdmin || isOwner
                          });
                        }
                        
                        return isAdmin || isOwner;
                      })() && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/videos/${video.id}/edit`)}
                            className="flex items-center gap-1 whitespace-nowrap"
                          >
                            <Edit className="h-4 w-4" />
                            編集
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="flex items-center gap-1 whitespace-nowrap">
                                <Trash2 className="h-4 w-4" />
                                削除
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>動画を削除しますか？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  この操作は取り消せません。動画「{video.title}」を完全に削除します。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteVideo(video.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  削除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ページネーション */}
      {hasMore && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Button
            variant="outline"
            onClick={() => fetchVideos(true)}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                読み込み中...
              </>
            ) : (
              'さらに読み込む'
            )}
          </Button>
        </div>
      )}

      {videos.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">動画が見つかりませんでした。</p>
        </div>
      )}
      </div>
    </MainLayout>
  );
} 