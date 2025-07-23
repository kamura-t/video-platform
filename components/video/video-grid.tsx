'use client';

import React from 'react';
import { Video } from '@/types/video';
import { VideoCard } from './video-card';
import { VideoGridSkeleton } from './video-grid-skeleton';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { useSettings } from '@/components/providers/settings-provider';

interface VideoGridProps {
  videos: Video[];
  viewMode?: 'grid' | 'list';
  className?: string;
  // 無限スクロール関連のプロパティ
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  infiniteScroll?: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ 
  videos, 
  viewMode = 'grid', 
  className,
  hasMore = false,
  loading = false,
  onLoadMore,
  infiniteScroll = false
}) => {
  const { settings } = useSettings();
  const newBadgeDisplayDays = settings?.newBadgeDisplayDays || 7;
  
  const { isFetching, setIsFetching, lastElementRef } = useInfiniteScroll(
    () => {
      if (onLoadMore) {
        onLoadMore();
      }
    },
    hasMore && infiniteScroll,
    { threshold: 0.5, rootMargin: '100px' }
  );

  // onLoadMore完了時にisFetchingをfalseにする
  React.useEffect(() => {
    if (!loading && isFetching) {
      setIsFetching(false);
    }
  }, [loading, isFetching, setIsFetching]);

  if (videos.length === 0 && !loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">ビデオが見つかりませんでした。</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className={`space-y-4 ${className}`}>
        {videos.map((video, index) => (
          <div
            key={video.id}
            ref={infiniteScroll && index === videos.length - 1 ? lastElementRef : null}
          >
            <VideoCard 
              video={video} 
              postId={video.posts?.[0]?.postId} 
              variant="list"
              newBadgeDisplayDays={newBadgeDisplayDays}
            />
          </div>
        ))}
        {infiniteScroll && (loading || isFetching) && (
          <VideoGridSkeleton viewMode="list" count={4} />
        )}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-3 4xl:grid-cols-4 5xl:grid-cols-5 6xl:grid-cols-6 gap-4 ${className}`}>
      {videos.map((video, index) => (
        <div 
          key={video.id} 
          className="h-full"
          ref={infiniteScroll && index === videos.length - 1 ? lastElementRef : null}
        >
          <VideoCard 
            video={video} 
            postId={video.posts?.[0]?.postId} 
            variant="grid"
            className="h-full"
            newBadgeDisplayDays={newBadgeDisplayDays}
          />
        </div>
      ))}
      {infiniteScroll && (loading || isFetching) && (
        <VideoGridSkeleton viewMode="grid" count={8} />
      )}
    </div>
  );
};