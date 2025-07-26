'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video } from '@/types/video';
import { useVideosPerPage } from '@/hooks/use-infinite-scroll';

interface VideoFilters {
  query: string;
  category: string;
  sortBy: string;
  tags: string[];
  dateFrom?: string;
  dateTo?: string;
  duration: string;
}

export function useVideoData(filters: VideoFilters) {
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [displayedVideos, setDisplayedVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [lastApiCall, setLastApiCall] = useState<string>('');
  const { videosPerPage } = useVideosPerPage();

  // Fetch videos from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Build API URL with filters
        const apiUrl = new URL('/api/videos', window.location.origin);
        if (filters.category && filters.category !== 'all') {
          apiUrl.searchParams.set('category', filters.category);
        }
        if (filters.query) {
          apiUrl.searchParams.set('q', filters.query);
        }
        if (filters.tags.length > 0) {
          apiUrl.searchParams.set('tags', filters.tags.join(','));
        }
        apiUrl.searchParams.set('sort', filters.sortBy);
        
        const apiUrlString = apiUrl.toString();
        
        // 前回と同じAPIコールの場合はスキップ（並び順の変更時は除外）
        if (lastApiCall === apiUrlString && !apiUrlString.includes('sort=')) {
          console.log('VideoData: Skipping duplicate API call');
          setIsLoading(false);
          return;
        }
        
        setLastApiCall(apiUrlString);
        
        // Fetch videos from API
        const videosResponse = await fetch(apiUrlString);
        
        if (videosResponse.ok) {
          const videosData = await videosResponse.json();
          
          if (videosData.success && videosData.data?.videos) {
            // APIレスポンスをVideo型にマッピング
            const mappedVideos: Video[] = videosData.data.videos.map((video: any) => ({
              id: video.id,
              videoId: video.videoId || video.id,
              title: video.title,
              description: video.description,
              uploadType: video.uploadType || 'YOUTUBE',
              youtubeUrl: video.youtubeUrl,
              filePath: video.filePath,
              thumbnailUrl: video.thumbnailUrl,
              thumbnail: video.thumbnailUrl, // backward compatibility
              duration: video.duration,
              viewCount: video.viewCount,
              visibility: video.visibility || 'PUBLIC',
              status: video.status || 'READY',
              uploader: {
                id: video.uploader?.id?.toString() || video.author?.id?.toString() || '1',
                username: video.uploader?.username || video.author?.username || video.author?.name || 'unknown',
                displayName: video.uploader?.displayName || video.author?.name || 'Unknown User',
                profileImageUrl: video.uploader?.profileImageUrl || video.author?.profileImageUrl || video.author?.avatar,
                department: video.uploader?.department
              },
              categories: video.categories?.map((cat: any) => ({
                id: cat.id.toString(),
                name: cat.name,
                slug: cat.slug,
                color: cat.color
              })) || [],
              tags: video.tags?.map((tag: any) => ({
                id: tag.id.toString(),
                name: tag.name
              })) || [],
              createdAt: video.createdAt,
              updatedAt: video.updatedAt,
              publishedAt: video.publishedAt
            }));
            
            setAllVideos(mappedVideos);
          } else {
            console.error('VideoData: API returned success: false or no videos');
            setAllVideos([]);
          }
        } else {
          console.error('VideoData: Failed to fetch videos:', videosResponse.status, videosResponse.statusText);
          setAllVideos([]);
        }
        
      } catch (error) {
        console.error('VideoData: Failed to load data:', error);
        setAllVideos([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Force stop loading after 3 seconds to prevent infinite loading
    const forceStopLoading = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(forceStopLoading);
  }, [filters.category, filters.query, filters.tags, filters.sortBy]);

  // Use allVideos directly since filtering is now done server-side
  const filteredVideos = allVideos;

  // Load more videos for infinite scroll
  const loadMoreVideos = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const startIndex = (nextPage - 1) * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    
    const newVideos = filteredVideos.slice(startIndex, endIndex);
    
    if (newVideos.length === 0) {
      setHasMore(false);
    } else {
      setDisplayedVideos(prev => [...prev, ...newVideos]);
      setCurrentPage(nextPage);
    }
    
    setIsLoadingMore(false);
  }, [currentPage, videosPerPage, filteredVideos, isLoadingMore, hasMore]);

  // Update displayed videos when filters change
  useEffect(() => {
    const initialVideos = filteredVideos.slice(0, videosPerPage);
    setDisplayedVideos(initialVideos);
    setCurrentPage(1);
    setHasMore(filteredVideos.length > videosPerPage);
  }, [filteredVideos, videosPerPage]);

  return {
    allVideos,
    displayedVideos,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMoreVideos,
  };
}