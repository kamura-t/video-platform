'use client';

import React from 'react';
import { Header } from './header';

interface MainLayoutProps {
  children: React.ReactNode;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  showViewToggle?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  categories?: Array<{ id: string; name: string; slug: string; color: string }>;
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  viewMode, 
  onViewModeChange, 
  showViewToggle,
  searchQuery,
  onSearchQueryChange,
  categories,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange
}) => {
  return (
    <div className="min-h-screen bg-background">
      <Header 
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        showViewToggle={showViewToggle}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
      />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};