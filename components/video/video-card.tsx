'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Video } from '@/types/video';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingIndicator } from './trending-indicator';
import { Eye, Clock, Play, Heart } from 'lucide-react';
import { formatVideoDate, formatViewCount, formatDuration } from '@/lib/utils';
import { useFavorites } from '@/hooks/use-favorites';
import { useAuth } from '@/components/providers/auth-provider';

interface VideoCardProps {
  video: Video;
  className?: string;
  showTrendingIndicator?: boolean;
  showRanking?: boolean;
  ranking?: number;
  postId?: string;
  variant?: 'grid' | 'list';
  newBadgeDisplayDays?: number;
}

// デフォルトサムネイル画像のパス
const DEFAULT_THUMBNAIL = '/api/placeholder/400/300';

export const VideoCard: React.FC<VideoCardProps> = ({ 
  video, 
  className,
  showTrendingIndicator = false,
  showRanking = false,
  ranking,
  postId,
  variant = 'grid',
  newBadgeDisplayDays = 7
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { isFavorited, toggleFavorite, isLoading, checkFavoriteStatus } = useFavorites();
  const [thumbnailError, setThumbnailError] = useState(false);
  const [thumbnailSrc, setThumbnailSrc] = useState(video.thumbnailUrl || DEFAULT_THUMBNAIL);

  const author = video.uploader || video.author;
  const isRecent = new Date(video.createdAt).getTime() > Date.now() - (newBadgeDisplayDays * 24 * 60 * 60 * 1000);

  // ユーザーがログインしている場合、お気に入り状態を確認
  useEffect(() => {
    if (user && video.id) {
      checkFavoriteStatus([video.id]);
    }
  }, [user, video.id, checkFavoriteStatus]);

  // 動画のアスペクト比を計算
  const calculateAspectRatio = () => {
    if (video.videoResolution) {
      const [width, height] = video.videoResolution.split('x').map(Number);
      if (width && height) {
        return width / height;
      }
    }
    return 16 / 9; // デフォルトは16:9
  };

  const aspectRatio = calculateAspectRatio();
  const isPortrait = aspectRatio < 1.0; // 縦型動画の判定

  // 縦型動画用のサムネイルスタイルを生成
  const getThumbnailStyle = () => {
    if (isPortrait) {
      return {
        aspectRatio: '9/16', // 縦型動画用のアスペクト比
        maxHeight: variant === 'list' ? '120px' : '200px',
        width: 'auto'
      };
    }
    return {};
  };

  const videoUrl = postId ? `/watch/${postId}` : `/watch/${video.posts?.[0]?.postId || video.videoId}`;

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/@${video.uploader.username}`);
  };

  const handleCategoryClick = (e: React.MouseEvent, categorySlug: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/?category=${categorySlug}`);
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    
    if (!user) {
      router.push('/login');
      return;
    }

    if (video.id !== undefined && video.id !== null) {
      await toggleFavorite(video.id);
    } else {
      console.error('Video ID is undefined or null:', video);
    }
  };

  // サムネイル画像のエラーハンドリング
  const handleThumbnailError = () => {
    if (!thumbnailError) {
      setThumbnailError(true);
      
      // YouTube動画の場合、異なる解像度のサムネイルを試す
      if (video.youtubeUrl && video.thumbnail?.includes('maxresdefault.jpg')) {
        const videoId = extractYouTubeVideoId(video.youtubeUrl);
        if (videoId) {
          // maxresdefault.jpg が失敗した場合、hqdefault.jpg を試す
          setThumbnailSrc(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
          return;
        }
      } else if (video.youtubeUrl && video.thumbnail?.includes('hqdefault.jpg')) {
        const videoId = extractYouTubeVideoId(video.youtubeUrl);
        if (videoId) {
          // hqdefault.jpg も失敗した場合、mqdefault.jpg を試す
          setThumbnailSrc(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
          return;
        }
      }
      
      // 最終的にデフォルト画像を使用
      setThumbnailSrc(DEFAULT_THUMBNAIL);
    }
  };

  // YouTube動画IDを抽出する関数
  const extractYouTubeVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  };

  if (variant === 'list') {
    return (
      <Link href={videoUrl} className={className}>
        <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300">
          <div className="flex gap-4 p-4">
            {/* Thumbnail */}
            <div className="relative w-48 h-28 flex-shrink-0 overflow-hidden rounded">
              <img
                src={thumbnailSrc}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={handleThumbnailError}
                loading="lazy"
              />
              {/* Play Button Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                <div className="w-12 h-12 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Play className="w-6 h-6 text-white ml-1" />
                </div>
              </div>
              {/* Duration Badge */}
              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span className="font-medium">{formatDuration(video.duration || 0)}</span>
                </div>
              </div>
              {/* New Badge */}
              {isRecent && (
                <div className="absolute top-1 left-1 z-10">
                  <Badge variant="secondary" className="bg-green-500/90 text-white border-0 text-xs font-medium px-1.5 py-0.5">
                    NEW
                  </Badge>
                </div>
              )}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex gap-3">
                <Avatar 
                  className="w-8 h-8 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={handleAuthorClick}
                >
                  <AvatarImage src={author?.profileImageUrl} alt={author?.displayName || author?.username || ''} />
                  <AvatarFallback>{(author?.displayName || author?.username || 'U').charAt(0)}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-tight mb-1">
                      {video.title}
                    </h3>
                    
                    <p 
                      className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                      onClick={handleAuthorClick}
                    >
                      {author?.displayName || author?.username || ''}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3 flex-shrink-0" />
                          <span>{formatViewCount(video.viewCount)}回視聴</span>
                        </div>
                        <span>•</span>
                        <span>{formatVideoDate(video.createdAt)}</span>
                      </div>
                      {user && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleFavoriteClick}
                          disabled={isLoading}
                          className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-500"
                        >
                          <Heart 
                            className={`w-4 h-4 ${
                              isFavorited(video.id) 
                                ? 'fill-red-500 text-red-500' 
                                : 'text-muted-foreground'
                            } transition-colors`}
                          />
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {video.categories && video.categories.length > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="text-xs font-medium px-1.5 py-0.5 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: video.categories?.[0]?.color + '20', color: video.categories?.[0]?.color }}
                          onClick={(e) => handleCategoryClick(e, video.categories?.[0]?.slug || '')}
                        >
                          {video.categories?.[0]?.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={videoUrl} className={className}>
      <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col h-full">
        <div className="relative aspect-video overflow-hidden flex-shrink-0">
          <img
            src={thumbnailSrc}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={handleThumbnailError}
            loading="lazy"
          />
          {/* Play Button Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <div className="w-16 h-16 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </div>
          {/* Duration Badge */}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            <div className="flex items-center gap-1 whitespace-nowrap">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium">{formatDuration(video.duration || 0)}</span>
            </div>
          </div>
          {/* Ranking Badge */}
          {showRanking && ranking !== undefined && ranking <= 3 && (
            <div className="absolute -top-2 -left-2 z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                ranking === 1 ? 'bg-yellow-500' : 
                ranking === 2 ? 'bg-gray-400' : 'bg-orange-600'
              }`}>
                {ranking}
              </div>
            </div>
          )}
          {/* Trending Indicator */}
          {showTrendingIndicator && (
            <div className="absolute top-2 right-2 z-10">
              <TrendingIndicator score={video.viewCount} />
            </div>
          )}
          {/* New Badge */}
          {isRecent && (
            <div className="absolute top-2 left-2 z-10">
              <Badge variant="secondary" className="bg-green-500/90 text-white border-0 text-xs font-medium px-2 py-1">
                NEW
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-3 flex-1 flex flex-col min-h-[120px]">
          <div className="flex gap-3 h-full">
                            <Avatar 
                  className="w-9 h-9 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={handleAuthorClick}
                >
              <AvatarImage src={author?.profileImageUrl} alt={author?.displayName || author?.username || ''} />
              <AvatarFallback>{(author?.displayName || author?.username || 'U').charAt(0)}</AvatarFallback>
                </Avatar>
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="space-y-1">
                <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors leading-tight mb-1">
                  {video.title}
                </h3>
                <p 
                  className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                  onClick={handleAuthorClick}
                >
                  {author?.displayName || author?.username || ''}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3 flex-shrink-0" />
                      <span>{formatViewCount(video.viewCount)}回視聴</span>
                    </div>
                    <span>•</span>
                    <span>{formatVideoDate(video.createdAt)}</span>
                  </div>
                  {user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFavoriteClick}
                      disabled={isLoading}
                      className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-500"
                    >
                      <Heart 
                        className={`w-4 h-4 ${
                          isFavorited(video.id) 
                            ? 'fill-red-500 text-red-500' 
                            : 'text-muted-foreground'
                        } transition-colors`}
                      />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  {video.categories && video.categories.length > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="text-xs font-medium px-1.5 py-0.5 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: video.categories?.[0]?.color + '20', color: video.categories?.[0]?.color }}
                      onClick={(e) => handleCategoryClick(e, video.categories?.[0]?.slug || '')}
                    >
                      {video.categories?.[0]?.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};