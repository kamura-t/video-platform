'use client';

import { Button } from '@/components/ui/button';
import { VideoCategory } from '@/types/video';
import Link from 'next/link';
import { Search, Users } from 'lucide-react';

interface SearchFiltersProps {
  categories: VideoCategory[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  sortBy: string;
  onSortChange: (sortBy: string) => void;
  onClearFilters: () => void;
  showClearButton: boolean;
}

export function SearchFiltersSection({
  categories,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  onClearFilters,
  showClearButton
}: SearchFiltersProps) {
  return (
    <div className="hidden lg:block w-64 bg-white dark:bg-gray-800 shadow-sm">
      <div className="p-6">
        <div className="space-y-6">
          {/* Categories Filter */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">カテゴリ</h3>
            <div className="space-y-2">
              <button
                onClick={() => onCategoryChange('all')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                すべて
              </button>
              {categories
                .filter(category => category.name !== 'すべて' && category.name !== 'all')
                .map((category) => (
                <button
                  key={category.id}
                  onClick={() => onCategoryChange(category.slug)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedCategory === category.slug
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Filter */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">並び順</h3>
            <div className="space-y-2">
              <button
                onClick={() => onSortChange('latest')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  sortBy === 'latest'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                最新
              </button>
              <button
                onClick={() => onSortChange('oldest')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  sortBy === 'oldest'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                古い順
              </button>
              <button
                onClick={() => onSortChange('popular')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  sortBy === 'popular'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                人気順
              </button>
              <button
                onClick={() => onSortChange('title')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  sortBy === 'title'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                タイトル順
              </button>
            </div>
          </div>

          {/* Tags Search */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">タグ検索</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                asChild
              >
                <Link href="/tags">
                  <Search className="mr-2 h-4 w-4" />
                  タグ一覧を見る
                </Link>
              </Button>
            </div>
          </div>

          {/* Users Search */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">投稿者</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                asChild
              >
                <Link href="/users">
                  <Users className="mr-2 h-4 w-4" />
                  投稿者一覧を見る
                </Link>
              </Button>
            </div>
          </div>

          {/* Clear Filters */}
          {showClearButton && (
            <div className="pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="w-full"
              >
                フィルターをクリア
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}