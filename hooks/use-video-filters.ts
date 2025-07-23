'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSearchHistory } from '@/hooks/use-search-history';

interface VideoFilters {
  query: string;
  category: string;
  sortBy: string;
  tags: string[];
  dateFrom?: string;
  dateTo?: string;
  duration: string;
}

export function useVideoFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToHistory } = useSearchHistory();

  // Initialize filters from URL parameters
  const [filters, setFilters] = useState<VideoFilters>(() => {
    const categoryParam = searchParams.get('category');
    const tagParam = searchParams.get('tag');
    const searchParam = searchParams.get('q');
    
    return {
      query: searchParam || '',
      category: categoryParam || 'all',
      sortBy: 'latest',
      tags: tagParam ? [tagParam] : [],
      dateFrom: undefined,
      dateTo: undefined,
      duration: 'all',
    };
  });

  // Update filters when URL parameters change
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const tagParam = searchParams.get('tag');
    const searchParam = searchParams.get('q') || searchParams.get('search');
    
    setFilters(prev => ({
      ...prev,
      query: searchParam || '',
      category: categoryParam || 'all',
      sortBy: 'latest',
      tags: tagParam ? [tagParam] : [],
    }));
  }, [searchParams]);

  const handleFiltersChange = (newFilters: VideoFilters) => {
    setFilters(newFilters);
    if (newFilters.query) {
      addToHistory(newFilters.query);
    }
  };

  const handleSearchQueryChange = (query: string) => {
    setFilters(prev => ({ ...prev, query }));
    if (query) {
      addToHistory(query);
    }
  };

  const handleCategoryChange = (category: string) => {
    setFilters(prev => ({ ...prev, category }));
  };

  const handleSortChange = (sortBy: string) => {
    setFilters(prev => ({ ...prev, sortBy }));
  };

  const clearAllFilters = () => {
    setFilters({
      query: '',
      category: 'all',
      sortBy: 'latest',
      tags: [],
      dateFrom: undefined,
      dateTo: undefined,
      duration: 'all',
    });
    // Clear URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('category');
    url.searchParams.delete('tag');
    url.searchParams.delete('q');
    router.push(url.pathname);
  };

  const hasActiveFilters = (): boolean => {
    return (
      filters.category !== 'all' ||
      filters.sortBy !== 'latest' ||
      Boolean(filters.query) ||
      filters.tags.length > 0
    );
  };

  return {
    filters,
    handleFiltersChange,
    handleSearchQueryChange,
    handleCategoryChange,
    handleSortChange,
    clearAllFilters,
    hasActiveFilters,
  };
}