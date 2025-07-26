'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { VideoGrid } from '@/components/video/video-grid'
import { SearchFiltersComponent, SearchFilters } from '@/components/video/search-filters'
import { VideoCategory } from '@/types/video'
import { useVideosPerPage } from '@/hooks/use-infinite-scroll'
import { Video, UserInfo } from '@/types/video'
import { ArrowLeft, Calendar, Eye, PlayCircle, User, Grid, List, Video as VideoIcon, ListVideo } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { formatVideoDate } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlaylists } from '@/components/user/user-playlists';

interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
}

function UserPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawUsername = decodeURIComponent(params.username as string);

  const [user, setUser] = useState<UserInfo | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalVideos, setTotalVideos] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('videos');
  
  const { videosPerPage, isLoading: isLoadingSettings } = useVideosPerPage();

  // Initialize filters from URL parameters
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const categoryParam = searchParams.get('category');
    const searchParam = searchParams.get('search');
    const sortParam = searchParams.get('sort');
    
    return {
      query: searchParam || '',
      category: categoryParam || 'all',
      tags: [],
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: sortParam || 'latest',
      duration: 'all',
    };
  });

  const username = rawUsername?.startsWith('@') ? rawUsername.substring(1) : null;

  // Get available tags from videos
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    videos.forEach(video => {
      video.tags?.forEach(tag => tagSet.add(tag.name));
    });
    return Array.from(tagSet);
  }, [videos]);

  // Load user data and videos
  const loadUserData = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setCurrentPage(1);
      }

      const page = isLoadMore ? currentPage + 1 : 1;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: videosPerPage.toString(),
        sortBy: filters.sortBy,
      });

      if (filters.category && filters.category !== 'all') {
        queryParams.append('category', filters.category);
      }
      if (filters.query) {
        queryParams.append('search', filters.query);
      }

      // Fetch user videos by username
      const response = await fetch(`/api/users/${username}/videos?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        if (!isLoadMore) {
          setUser(data.user);
        }
        
        // Transform videos to match Video type
        const transformedVideos: Video[] = data.videos.map((video: any) => ({
          id: video.videoId,
          videoId: video.videoId,
          title: video.title,
          description: video.description,
          uploadType: 'YOUTUBE',
          youtubeUrl: video.youtubeUrl,
          thumbnailUrl: video.thumbnailUrl,
          thumbnail: video.thumbnailUrl,
          duration: video.duration,
          viewCount: video.viewCount,
          visibility: 'PUBLIC',
          status: 'COMPLETED',
          uploader: {
            id: video.uploader.id.toString(),
            username: video.uploader.username,
            displayName: video.uploader.displayName,
            profileImageUrl: video.author.profileImageUrl,
            department: video.uploader.department
          },
          categories: video.categories.map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            color: cat.color
          })),
          tags: video.tags.map((tag: any) => ({
            id: tag.id.toString(),
            name: tag.name
          })),
          createdAt: video.uploadedAt,
          updatedAt: video.uploadedAt,
          publishedAt: video.publishedAt
        }));

        if (isLoadMore) {
          setVideos(prev => [...prev, ...transformedVideos]);
          setCurrentPage(page);
        } else {
          setVideos(transformedVideos);
          setCurrentPage(1);
        }
        
        setTotalVideos(data.pagination.total);
        setHasMore(data.pagination.page < data.pagination.totalPages);
      } else {
        console.error('Failed to fetch user data:', data.error);
        setUser(null);
      }

      // Fetch categories only on initial load
      if (!isLoadMore) {
        const categoriesResponse = await fetch('/api/categories');
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          if (categoriesData.success) {
            const allCategories: Category[] = [
              { id: 0, name: 'すべて', slug: 'all', color: '#6B7280' },
              ...categoriesData.data.map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                slug: cat.slug,
                color: cat.color
              }))
            ];
            setCategories(allCategories);
          }
        }
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (username && !isLoadingSettings) {
      loadUserData(false);
    }
  }, [username, filters, videosPerPage, isLoadingSettings, loadUserData]);

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const loadMoreVideos = () => {
    if (!isLoadingMore && hasMore) {
      loadUserData(true);
    }
  };

  // @で始まらない場合は404
  if (!username) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">ページが見つかりません</h1>
            <p className="text-muted-foreground">指定されたページは存在しません。</p>
            <Button onClick={() => router.push('/')}>
              ホームに戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || isLoadingSettings) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Back Button Skeleton */}
            <Skeleton className="h-10 w-20" />
            
            {/* User Profile Skeleton */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <Skeleton className="w-24 h-24 rounded-full" />
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-4">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Videos Grid Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <div className="aspect-video">
                    <Skeleton className="w-full h-full" />
                  </div>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">ユーザーが見つかりません</h1>
            <p className="text-muted-foreground">指定されたユーザーは存在しないか、削除されています。</p>
            <Button onClick={() => router.push('/')}>
              ホームに戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
        {/* User Profile */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src={user.profileImageUrl} alt={user.displayName} />
                <AvatarFallback className="text-2xl">
                  {user.displayName?.charAt(0) || user.username?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-3">
                <div>
                  <h1 className="text-3xl font-bold">{user.displayName || user.username}</h1>
                  <p className="text-muted-foreground">@{user.username}</p>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <PlayCircle className="w-4 h-4" />
                    <span>{user.totalVideos}本の動画</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ListVideo className="w-4 h-4" />
                    <span>プレイリスト: 学外公開({user.publicPlaylists || 0}) 学内公開({user.internalPlaylists || 0})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {formatVideoDate(user.memberSince)}に参加
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>
                      {videos.reduce((sum, video) => sum + video.viewCount, 0).toLocaleString()}回視聴
                    </span>
                  </div>
                </div>

                {/* Bio Section */}
                {user.bio && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <h3 className="text-sm font-semibold mb-2 text-muted-foreground">紹介文</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {user.bio}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <VideoIcon className="w-4 h-4" />
              動画 ({totalVideos})
            </TabsTrigger>
            <TabsTrigger value="playlists" className="flex items-center gap-2">
              <ListVideo className="w-4 h-4" />
              プレイリスト (学外:{user.publicPlaylists || 0} 学内:{user.internalPlaylists || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="space-y-6">
        {/* Filters */}
        <SearchFiltersComponent
          categories={categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            color: cat.color
          }))}
          availableTags={availableTags}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          searchHistory={[]}
          onClearHistory={() => {}}
        />

        {/* Content Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              {filters.query || filters.category !== 'all' ? '検索結果' : '投稿動画'}
            </h2>
            <p className="text-muted-foreground">
              {totalVideos}件の動画
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Videos Grid */}
        {videos.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                  <PlayCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">動画がありません</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {filters.query || filters.category !== 'all' 
                    ? '検索条件に一致する動画が見つかりませんでした。'
                    : 'このユーザーはまだ動画を投稿していません。'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <VideoGrid 
              videos={videos} 
              viewMode={viewMode}
              hasMore={hasMore}
              loading={isLoadingMore}
              onLoadMore={loadMoreVideos}
              infiniteScroll={true}
            />
          </div>
        )}
          </TabsContent>

          <TabsContent value="playlists" className="space-y-6">
            <UserPlaylists 
              userId={user.id.toString()} 
              userName={user.displayName || user.username}
            />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function UserPage() {
  return (
    <Suspense fallback={<UserPageContent />}>
      <UserPageContent />
    </Suspense>
  );
} 