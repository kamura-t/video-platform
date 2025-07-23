'use client';

import React, { useState, useEffect } from 'react';
import { VideoCategory } from '@/types/video';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, Calendar as CalendarIcon, X, Clock, Tag, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface SearchFilters {
  query: string;
  category: string;
  tags: string[];
  dateFrom?: Date;
  dateTo?: Date;
  sortBy: string;
  duration: string;
}

interface SearchFiltersProps {
  categories: VideoCategory[];
  availableTags: string[];
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  searchHistory: string[];
  onClearHistory: () => void;
}

export const SearchFiltersComponent: React.FC<SearchFiltersProps> = ({
  categories,
  availableTags,
  filters,
  onFiltersChange,
  searchHistory,
  onClearHistory,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (filters.query && filters.query.length > 0) {
      const suggestions = searchHistory
        .filter(item => 
          item.toLowerCase().includes(filters.query.toLowerCase()) && 
          item !== filters.query
        )
        .slice(0, 5);
      setSearchSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [filters.query, searchHistory]);

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    handleFilterChange('tags', newTags);
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            <CardTitle>検索・フィルター</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4 mr-1" />
                クリア
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Filter className="w-4 h-4 mr-1" />
              {showAdvanced ? '簡易表示' : '詳細フィルター'}
            </Button>
          </div>
        </div>
        <CardDescription>
          ビデオを検索・フィルタリングして目的のコンテンツを見つけましょう
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Search Input */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="ビデオを検索..."
              value={filters.query}
              onChange={(e) => handleFilterChange('query', e.target.value)}
              className="pl-10"
              onFocus={() => setShowSuggestions(searchSuggestions.length > 0)}
            />
          </div>
          
          {/* Search Suggestions */}
          {showSuggestions && (
            <Card className="absolute top-full left-0 right-0 z-10 mt-1 shadow-lg">
              <CardContent className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">検索履歴</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearHistory}
                    className="h-6 px-2 text-xs"
                  >
                    履歴をクリア
                  </Button>
                </div>
                <div className="space-y-1">
                  {searchSuggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 px-2 text-sm"
                      onClick={() => {
                        handleFilterChange('query', suggestion);
                        setShowSuggestions(false);
                      }}
                    >
                      <Clock className="w-3 h-3 mr-2" />
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Basic Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>カテゴリ</Label>
            <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="カテゴリを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのカテゴリ</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.slug}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>並び順</Label>
            <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
              <SelectTrigger>
                <SelectValue placeholder="並び順" />
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

          <div className="space-y-2">
            <Label>再生時間</Label>
            <Select value={filters.duration} onValueChange={(value) => handleFilterChange('duration', value)}>
              <SelectTrigger>
                <SelectValue placeholder="再生時間" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="short">短い (5分未満)</SelectItem>
                <SelectItem value="medium">中程度 (5-20分)</SelectItem>
                <SelectItem value="long">長い (20分以上)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <>
            <Separator />
            
            <div className="space-y-6">
              {/* Date Range Filter */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  投稿日期間
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">開始日</Label>
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
                          {filters.dateFrom ? format(filters.dateFrom, "yyyy年M月d日", { locale: ja }) : "開始日を選択"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.dateFrom}
                          onSelect={(date) => handleFilterChange('dateFrom', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">終了日</Label>
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
                          {filters.dateTo ? format(filters.dateTo, "yyyy年M月d日", { locale: ja }) : "終了日を選択"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.dateTo}
                          onSelect={(date) => handleFilterChange('dateTo', date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Tag Filter */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  <span>タグフィルター</span>
                </Label>
                <ScrollArea className="h-32 w-full border rounded-md p-3">
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={filters.tags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80 transition-colors"
                        onClick={() => handleTagToggle(tag)}
                      >
                        <span>{tag}</span>
                        {filters.tags.includes(tag) && (
                          <X className="w-3 h-3 ml-1" />
                        )}
                      </Badge>
                    ))}
                  </div>
                </ScrollArea>
                {filters.tags.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-4 h-4" />
                    <span>選択中のタグ: {filters.tags.length}個</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">適用中のフィルター</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {filters.query && (
                  <Badge variant="outline" className="text-xs">
                    <span>検索: "{filters.query}"</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 ml-1 hover:bg-transparent"
                      onClick={() => handleFilterChange('query', '')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                )}
                {filters.category && (
                  <Badge variant="outline" className="text-xs">
                    <span>カテゴリ: {filters.category}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 ml-1 hover:bg-transparent"
                      onClick={() => handleFilterChange('category', 'all')}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                )}
                {filters.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    <span>タグ: {tag}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 ml-1 hover:bg-transparent"
                      onClick={() => handleTagToggle(tag)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};