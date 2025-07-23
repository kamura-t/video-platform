'use client';

import React from 'react';
import Link from 'next/link';
import { VideoCategory } from '@/types/video';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SearchFilters } from './search-filters';
import { Search, X, ExternalLink } from 'lucide-react';

interface SidebarFiltersProps {
  categories: VideoCategory[];
  availableTags: string[];
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  searchHistory: string[];
  onClearHistory: () => void;
  compact?: boolean;
}

export const SidebarFilters: React.FC<SidebarFiltersProps> = ({
  categories,
  availableTags,
  filters,
  onFiltersChange,
  searchHistory,
  onClearHistory,
  compact = false,
}) => {
  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      query: '',
      category: 'all',
      tags: [],
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: 'latest',
      duration: 'all',
    });
  };

  const hasActiveFilters = 
    filters.query || 
    filters.category !== 'all' || 
    filters.tags.length > 0 || 
    filters.dateFrom || 
    filters.dateTo || 
    filters.duration !== 'all';

  return (
    <div className={`${compact ? 'space-y-4' : 'p-4 space-y-6'} h-full`}>
      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearAllFilters}
          className="w-full flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          フィルターをクリア
        </Button>
      )}

      {/* Categories */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">カテゴリ</Label>
        <div className="space-y-1">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={filters.category === category.slug ? 'default' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => handleFilterChange('category', category.slug)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Sort By */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">並び順</Label>
        <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">最新順</SelectItem>
            <SelectItem value="popular">人気順</SelectItem>
            <SelectItem value="liked">高評価順</SelectItem>
            <SelectItem value="title">タイトル順</SelectItem>
            <SelectItem value="duration">再生時間順</SelectItem>
          </SelectContent>
        </Select>
      </div>


    </div>
  );
};