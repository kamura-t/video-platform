import { useState, useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
}

interface UseInfiniteScrollResult {
  isFetching: boolean;
  setIsFetching: (isFetching: boolean) => void;
  lastElementRef: (node: HTMLElement | null) => void;
}

export function useInfiniteScroll(
  fetchMore: () => void,
  hasMore: boolean,
  options: UseInfiniteScrollOptions = {}
): UseInfiniteScrollResult {
  const [isFetching, setIsFetching] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);
  
  const { threshold = 1.0, rootMargin = '0px' } = options;

  const lastElementRef = useCallback((node: HTMLElement | null) => {
    if (isFetching) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setIsFetching(true);
        fetchMore();
      }
    }, {
      threshold,
      rootMargin
    });
    
    if (node) observer.current.observe(node);
  }, [isFetching, hasMore, fetchMore, threshold, rootMargin]);

  useEffect(() => {
    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, []);

  return { isFetching, setIsFetching, lastElementRef };
}

// システム設定から動画表示数を取得するフック
export function useVideosPerPage() {
  const [videosPerPage, setVideosPerPage] = useState(20); // デフォルト値
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVideosPerPage = async () => {
      try {
        const response = await fetch('/api/settings/public');
        const result = await response.json();
        
        if (result.success && result.data.videos_per_page) {
          const perPage = parseInt(result.data.videos_per_page);
          if (!isNaN(perPage) && perPage > 0) {
            setVideosPerPage(perPage);
          }
        }
      } catch (error) {
        console.error('Failed to fetch videos per page setting:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideosPerPage();
  }, []);

  return { videosPerPage, isLoading };
} 