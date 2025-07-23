'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface VideoGridSkeletonProps {
  viewMode?: 'grid' | 'list';
  count?: number;
}

export const VideoGridSkeleton: React.FC<VideoGridSkeletonProps> = ({ 
  viewMode = 'grid',
  count = 8
}) => {
  const skeletonCount = viewMode === 'grid' ? count : Math.min(count, 4);
  
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div key={`skeleton-${index}`} className="flex gap-4 p-4">
            <Skeleton className="w-32 h-24 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-3 4xl:grid-cols-4 5xl:grid-cols-5 6xl:grid-cols-6 gap-4">
      {Array.from({ length: skeletonCount }).map((_, index) => (
        <div key={`skeleton-${index}`} className="h-full">
          <div className="space-y-3">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};