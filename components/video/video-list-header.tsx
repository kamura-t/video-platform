'use client';

import { Button } from '@/components/ui/button';

interface VideoListHeaderProps {
  query: string;
  selectedCategory: string;
  sortBy: string;
  videoCount: number;
  onClearFilters: () => void;
  showClearButton: boolean;
}

export function VideoListHeader({
  query,
  selectedCategory,
  sortBy,
  videoCount,
  onClearFilters,
  showClearButton
}: VideoListHeaderProps) {
  const getTitle = () => {
    if (query || selectedCategory !== 'all') {
      return '検索結果';
    }
    return 'すべての動画';
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">
          {getTitle()}
        </h2>
        <span className="text-sm text-muted-foreground">
          {videoCount}件の動画
        </span>
      </div>
      {showClearButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          フィルターをクリア
        </Button>
      )}
    </div>
  );
}