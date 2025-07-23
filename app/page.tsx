'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useCategories } from '@/components/providers/categories-provider';
import { VideoGrid } from '@/components/video/video-grid';
import { SearchFiltersSection } from '@/components/video/search-filters-section';
import { VideoListHeader } from '@/components/video/video-list-header';
import { useVideoFilters } from '@/hooks/use-video-filters';
import { useVideoData } from '@/hooks/use-video-data';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoGridSkeleton } from '@/components/video/video-grid-skeleton';
import { Header } from '@/components/layout/header';

function HomePageContent() {
  const { user, isAuthenticated } = useAuth();
  const { categories } = useCategories();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Custom hooks for state management
  const {
    filters,
    handleFiltersChange,
    handleSearchQueryChange,
    handleCategoryChange,
    handleSortChange,
    clearAllFilters,
    hasActiveFilters,
  } = useVideoFilters();

  const {
    displayedVideos,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMoreVideos,
  } = useVideoData(filters);

  // 検索クエリの同期
  useEffect(() => {
    setLocalSearchQuery(filters.query);
  }, [filters.query]);





  if (isLoading) {
    return <HomePageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header 
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={true}
        searchQuery={localSearchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        categories={categories.map(cat => ({
          id: cat.id.toString(),
          name: cat.name,
          slug: cat.slug,
          color: cat.color
        }))}
        selectedCategory={filters.category}
        onCategoryChange={handleCategoryChange}
        sortBy={filters.sortBy}
        onSortChange={handleSortChange}
        showMobileFilters={true}
      />

      <div className="flex">
        {/* Sidebar */}
        <SearchFiltersSection
          categories={categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            color: cat.color
          }))}
          selectedCategory={filters.category}
          onCategoryChange={handleCategoryChange}
          sortBy={filters.sortBy}
          onSortChange={handleSortChange}
          onClearFilters={clearAllFilters}
          showClearButton={hasActiveFilters()}
        />

        {/* Main Content */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-900">
          {/* Content */}
          <div className="px-6 py-6">
            <div className="space-y-6">
              {/* Video List Header */}
              <VideoListHeader
                query={filters.query}
                selectedCategory={filters.category}
                sortBy={filters.sortBy}
                videoCount={displayedVideos.length}
                onClearFilters={clearAllFilters}
                showClearButton={hasActiveFilters()}
              />

              <VideoGrid 
                videos={displayedVideos} 
                viewMode={viewMode}
                hasMore={hasMore}
                loading={isLoadingMore}
                onLoadMore={loadMoreVideos}
                infiniteScroll={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <div className="hidden lg:block w-64 bg-white dark:bg-gray-800 shadow-sm">
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <div className="flex-1 bg-gray-50 dark:bg-gray-900">
          <div className="px-6 py-6">
            <VideoGridSkeleton viewMode="grid" count={8} />
          </div>
        </div>
      </div>
    </div>
  );
}