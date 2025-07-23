'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, X, Calendar as CalendarIcon, Clock, SortAsc, SortDesc } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface FilterOptions {
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  categoryId: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  minDuration: string;
  maxDuration: string;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
}

interface FavoritesFiltersProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  categories: Category[];
  totalCount: number;
  onReset: () => void;
}

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'お気に入り追加日' },
  { value: 'title', label: '動画タイトル' },
  { value: 'videoCreatedAt', label: '動画投稿日' },
  { value: 'duration', label: '再生時間' },
  { value: 'viewCount', label: '再生回数' }
];

const DURATION_OPTIONS = [
  { value: 'none', label: '指定なし' },
  { value: '0', label: '0秒' },
  { value: '60', label: '1分' },
  { value: '300', label: '5分' },
  { value: '600', label: '10分' },
  { value: '1800', label: '30分' },
  { value: '3600', label: '1時間' }
];

export function FavoritesFilters({
  filters,
  onFilterChange,
  categories,
  totalCount,
  onReset
}: FavoritesFiltersProps) {
  const [showFilters, setShowFilters] = React.useState(false);

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.categoryId) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.minDuration || filters.maxDuration) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className="space-y-4">
      {/* Search and Sort Bar */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="お気に入りを検索..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={filters.sortBy}
            onValueChange={(value) => handleFilterChange('sortBy', value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2"
          >
            {filters.sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          フィルタ
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Active Filters */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">フィルタ:</span>
          
          {filters.search && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Search className="w-3 h-3" />
              "{filters.search}"
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => handleFilterChange('search', '')}
              />
            </Badge>
          )}
          
          {filters.categoryId && (
            <Badge variant="secondary" className="flex items-center gap-1">
              カテゴリ: {categories.find(c => c.id.toString() === filters.categoryId)?.name}
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => handleFilterChange('categoryId', '')}
              />
            </Badge>
          )}
          
          {(filters.dateFrom || filters.dateTo) && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              期間指定
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => {
                  handleFilterChange('dateFrom', undefined);
                  handleFilterChange('dateTo', undefined);
                }}
              />
            </Badge>
          )}
          
          {(filters.minDuration || filters.maxDuration) && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              再生時間
              <X
                className="w-3 h-3 cursor-pointer"
                onClick={() => {
                  handleFilterChange('minDuration', '');
                  handleFilterChange('maxDuration', '');
                }}
              />
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-xs"
          >
            すべてクリア
          </Button>
        </div>
      )}

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div className="space-y-2">
                <Label htmlFor="category">カテゴリ</Label>
                <Select
                  value={filters.categoryId || 'all'}
                  onValueChange={(value) => handleFilterChange('categoryId', value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="すべてのカテゴリ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべてのカテゴリ</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label>お気に入り追加日（開始）</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(filters.dateFrom, "yyyy/MM/dd", { locale: ja }) : "開始日を選択"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(date) => handleFilterChange('dateFrom', date)}
                      locale={ja}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>お気に入り追加日（終了）</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(filters.dateTo, "yyyy/MM/dd", { locale: ja }) : "終了日を選択"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(date) => handleFilterChange('dateTo', date)}
                      locale={ja}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Duration Filters */}
              <div className="space-y-2">
                <Label htmlFor="minDuration">最短再生時間</Label>
                <Select
                  value={filters.minDuration || 'none'}
                  onValueChange={(value) => handleFilterChange('minDuration', value === 'none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="指定なし" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(option => (
                      <SelectItem key={`min-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDuration">最長再生時間</Label>
                <Select
                  value={filters.maxDuration || 'none'}
                  onValueChange={(value) => handleFilterChange('maxDuration', value === 'none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="指定なし" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(option => (
                      <SelectItem key={`max-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {totalCount}件のお気に入り動画
        {activeFiltersCount > 0 && (
          <span> ({activeFiltersCount}個のフィルタが適用中)</span>
        )}
      </div>
    </div>
  );
}