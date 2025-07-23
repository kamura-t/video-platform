'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { VideoGrid } from '@/components/video/video-grid';
import { Video } from '@/types/video';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, ArrowLeft } from 'lucide-react';
import { FavoritesFilters, FilterOptions } from '@/components/favorites/favorites-filters';
import { useCategories } from '@/components/providers/categories-provider';
import { useDebounce } from '@/hooks/use-debounce';

interface FavoriteData {
  id: number;
  createdAt: string;
  video: Video;
}

interface FavoritesResponse {
  favorites: FavoriteData[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export default function FavoritesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { categories } = useCategories();
  const [favorites, setFavorites] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false
  });
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
    categoryId: '',
    dateFrom: undefined,
    dateTo: undefined,
    minDuration: '',
    maxDuration: ''
  });

  const debouncedSearch = useDebounce(filters.search, 500);

  const fetchFavorites = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      // URLパラメータを構築
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) params.append('dateTo', filters.dateTo.toISOString());
      if (filters.minDuration) params.append('minDuration', filters.minDuration);
      if (filters.maxDuration) params.append('maxDuration', filters.maxDuration);

      const response = await fetch(`/api/user/favorites?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        const result: FavoritesResponse = data.data;
        setFavorites(result.favorites.map(f => f.video));
        setPagination({
          page: result.pagination.page,
          totalPages: result.pagination.totalPages,
          totalCount: result.pagination.totalCount,
          hasNext: result.pagination.hasNext,
          hasPrev: result.pagination.hasPrev
        });
      } else {
        setError(data.message || 'お気に入りの取得に失敗しました');
      }
    } catch (error) {
      console.error('お気に入り取得エラー:', error);
      setError('お気に入りの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchFavorites(1);
    }
  }, [user, authLoading, router, fetchFavorites]);

  // フィルタが変更されたときに検索を実行
  useEffect(() => {
    if (user) {
      fetchFavorites(1);
    }
  }, [user, fetchFavorites, debouncedSearch, filters.sortBy, filters.sortOrder, filters.categoryId, 
      filters.dateFrom, filters.dateTo, filters.minDuration, filters.maxDuration]);

  const handlePageChange = (newPage: number) => {
    fetchFavorites(newPage);
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      categoryId: '',
      dateFrom: undefined,
      dateTo: undefined,
      minDuration: '',
      maxDuration: ''
    });
  };

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
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
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-red-500" />
            <h1 className="text-2xl font-bold">お気に入り</h1>
          </div>
        </div>

        {/* Filters */}
        <FavoritesFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          categories={categories}
          totalCount={pagination.totalCount}
          onReset={handleResetFilters}
        />

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchFavorites(pagination.page)}>
              再試行
            </Button>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">お気に入りが見つかりません</h2>
            <p className="text-muted-foreground mb-4">
              動画のハートアイコンをクリックしてお気に入りに追加しましょう
            </p>
            <Button onClick={() => router.push('/')}>
              動画を探す
            </Button>
          </div>
        ) : (
          <>
            <VideoGrid videos={favorites} />
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrev}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  前へ
                </Button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const startPage = Math.max(1, pagination.page - 2);
                    const pageNum = startPage + i;
                    
                    if (pageNum > pagination.totalPages) return null;
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  次へ
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}