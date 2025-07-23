'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Video } from '@/types/video';
import { getAllTags } from '@/lib/search';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Tag, 
  TrendingUp, 
  BarChart3, 
  Grid3X3, 
  List,
  Hash,
  Eye,
  Video as VideoIcon,
  Filter,
  SortAsc,
  SortDesc,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface TagInfo {
  name: string;
  count: number;
  videos: Video[];
  popularity: number; // Based on total views of videos with this tag
  recentActivity: number; // Based on recent video uploads
}

type SortOption = 'name' | 'count' | 'popularity' | 'recent';
type ViewMode = 'grid' | 'list' | 'cloud';

export default function TagsPage() {
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [minCount, setMinCount] = useState(1);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/videos', {
          credentials: 'include'
        });
        const result = await response.json();
        
        if (result.success) {
          // API レスポンスの形式に合わせて動画データを取得
          const videos = result.data?.videos || result.videos || [];
          setAllVideos(videos);
        } else {
          console.error('Failed to load videos:', result.error);
        }
      } catch (error) {
        console.error('Failed to load videos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Process tags with detailed information
  const tagInfos = useMemo(() => {
    const tagMap = new Map<string, TagInfo>();
    
    allVideos.forEach(video => {
      video.tags?.forEach(tagItem => {
        const tagName = tagItem.name;
        if (!tagName) return;
        
        if (!tagMap.has(tagName)) {
          tagMap.set(tagName, {
            name: tagName,
            count: 0,
            videos: [],
            popularity: 0,
            recentActivity: 0,
          });
        }
        
        const tagInfo = tagMap.get(tagName)!;
        tagInfo.count++;
        tagInfo.videos.push(video);
        tagInfo.popularity += video.viewCount || 0;
        
        // Recent activity (videos from last 30 days get higher score)
        if (video.createdAt) {
          const createdAtDate = new Date(video.createdAt);
          const daysSinceCreated = (Date.now() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceCreated <= 30) {
            tagInfo.recentActivity += Math.max(0, 30 - daysSinceCreated);
          }
        }
      });
    });

    return Array.from(tagMap.values());
  }, [allVideos]);

  // Filter and sort tags
  const filteredAndSortedTags = useMemo(() => {
    let filtered = tagInfos.filter(tag => 
      tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      tag.count >= minCount
    );

    // Sort tags
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name, 'ja');
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
        case 'popularity':
          comparison = a.popularity - b.popularity;
          break;
        case 'recent':
          comparison = a.recentActivity - b.recentActivity;
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [tagInfos, searchQuery, sortBy, sortOrder, minCount]);

  // Statistics
  const stats = useMemo(() => {
    const totalTags = tagInfos.length;
    const totalTagUsage = tagInfos.reduce((sum, tag) => sum + tag.count, 0);
    const averageTagsPerVideo = allVideos.length > 0 ? totalTagUsage / allVideos.length : 0;
    const mostPopularTag = tagInfos.reduce((max, tag) => 
      tag.popularity > max.popularity ? tag : max, 
      { name: '', popularity: 0 }
    );

    return {
      totalTags,
      totalTagUsage,
      averageTagsPerVideo: Math.round(averageTagsPerVideo * 10) / 10,
      mostPopularTag: mostPopularTag.name,
    };
  }, [tagInfos, allVideos]);

  const getTagSize = (count: number, maxCount: number) => {
    const minSize = 0.8;
    const maxSize = 2.5;
    const ratio = count / maxCount;
    return minSize + (maxSize - minSize) * ratio;
  };

  const getTagColor = (popularity: number, maxPopularity: number) => {
    const ratio = popularity / maxPopularity;
    if (ratio > 0.8) return 'bg-red-500/20 text-red-700 border-red-300';
    if (ratio > 0.6) return 'bg-orange-500/20 text-orange-700 border-orange-300';
    if (ratio > 0.4) return 'bg-yellow-500/20 text-yellow-700 border-yellow-300';
    if (ratio > 0.2) return 'bg-green-500/20 text-green-700 border-green-300';
    return 'bg-blue-500/20 text-blue-700 border-blue-300';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" asChild>
                  <Link href="/">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    ホームに戻る
                  </Link>
                </Button>
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Tag className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">タグ管理</h1>
                  <p className="text-sm text-muted-foreground">
                    ビデオに使用されているタグの統計と管理
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const maxCount = Math.max(...tagInfos.map(tag => tag.count));
  const maxPopularity = Math.max(...tagInfos.map(tag => tag.popularity));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  ホームに戻る
                </Link>
              </Button>
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Tag className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">タグ管理</h1>
                <p className="text-sm text-muted-foreground">
                  ビデオに使用されているタグの統計と管理
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Hash className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">総タグ数</p>
                  <p className="text-2xl font-bold">{stats.totalTags}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">総使用回数</p>
                  <p className="text-2xl font-bold">{stats.totalTagUsage}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <VideoIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">平均タグ数/動画</p>
                  <p className="text-2xl font-bold">{stats.averageTagsPerVideo}</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">人気タグ</p>
                  <p className="text-lg font-bold truncate">{stats.mostPopularTag}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                フィルター・表示設定
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">タグ検索</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="タグを検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Sort By */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">並び順</label>
                  <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">使用回数</SelectItem>
                      <SelectItem value="popularity">人気度</SelectItem>
                      <SelectItem value="recent">最近の活動</SelectItem>
                      <SelectItem value="name">名前</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Order */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">順序</label>
                  <Button
                    variant="outline"
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    className="w-full justify-start"
                  >
                    {sortOrder === 'desc' ? (
                      <>
                        <SortDesc className="w-4 h-4 mr-2" />
                        降順
                      </>
                    ) : (
                      <>
                        <SortAsc className="w-4 h-4 mr-2" />
                        昇順
                      </>
                    )}
                  </Button>
                </div>

                {/* Min Count Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">最小使用回数</label>
                  <Select value={minCount.toString()} onValueChange={(value) => setMinCount(Number(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1回以上</SelectItem>
                      <SelectItem value="5">5回以上</SelectItem>
                      <SelectItem value="10">10回以上</SelectItem>
                      <SelectItem value="50">50回以上</SelectItem>
                      <SelectItem value="100">100回以上</SelectItem>
                      <SelectItem value="200">200回以上</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* View Mode */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm font-medium">表示モード:</span>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'cloud' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('cloud')}
                >
                  <Sparkles className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredAndSortedTags.length}個のタグが見つかりました
              </p>
            </div>

            {/* Tag Display */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAndSortedTags.map((tag) => (
                  <Card key={tag.name} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="font-medium">
                            {tag.name}
                          </Badge>
                          <span className="text-sm font-bold text-primary">
                            {tag.count}回
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            総視聴: {tag.popularity.toLocaleString()}回
                          </div>
                          <div className="flex items-center gap-1">
                            <VideoIcon className="w-3 h-3" />
                            {tag.videos.length}本の動画
                          </div>
                        </div>

                        <Link href={`/?tag=${encodeURIComponent(tag.name)}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            動画を見る
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {viewMode === 'list' && (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {filteredAndSortedTags.map((tag, index) => (
                      <div key={tag.name} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground w-8">
                              #{index + 1}
                            </span>
                            <Badge variant="secondary" className="font-medium">
                              {tag.name}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <div className="font-bold">{tag.count}</div>
                              <div className="text-muted-foreground text-xs">使用回数</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold">{tag.popularity.toLocaleString()}</div>
                              <div className="text-muted-foreground text-xs">総視聴数</div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold">{tag.videos.length}</div>
                              <div className="text-muted-foreground text-xs">動画数</div>
                            </div>
                            <Link href={`/?tag=${encodeURIComponent(tag.name)}`}>
                              <Button variant="outline" size="sm">
                                動画を見る
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode === 'cloud' && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-wrap gap-3 justify-center">
                    {filteredAndSortedTags.map((tag) => (
                      <Link key={tag.name} href={`/?tag=${encodeURIComponent(tag.name)}`}>
                        <Badge
                          variant="outline"
                          className={`cursor-pointer hover:shadow-md transition-all ${getTagColor(tag.popularity, maxPopularity)}`}
                          style={{
                            fontSize: `${getTagSize(tag.count, maxCount)}rem`,
                            padding: `${0.25 * getTagSize(tag.count, maxCount)}rem ${0.5 * getTagSize(tag.count, maxCount)}rem`,
                          }}
                        >
                          {tag.name}
                          <span className="ml-2 text-xs opacity-70">
                            {tag.count}
                          </span>
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredAndSortedTags.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                      <Tag className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">タグが見つかりませんでした</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      検索条件を変更するか、フィルターを調整して再度お試しください。
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}