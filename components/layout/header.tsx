'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { useSettings } from '@/components/providers/settings-provider';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoginDialog } from '@/components/auth/login-dialog';
import { getRoleDisplayName, canUploadVideos, canManageUsers } from '@/lib/auth';
import * as LucideIcons from 'lucide-react';
import {
  Moon,
  Sun,
  LogOut,
  Settings,
  Upload,
  Users,
  Menu,
  X,
  Search,
  Grid3X3,
  List,
  Filter,
  ChevronRight,
  PlaySquare,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface HeaderProps {
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
  showMobileFilters?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  viewMode = 'grid', 
  onViewModeChange, 
  showViewToggle = false,
  searchQuery = '',
  onSearchQueryChange,
  categories = [],
  selectedCategory = 'all',
  onCategoryChange,
  sortBy = 'latest',
  onSortChange,
  showMobileFilters = false,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { settings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  // Sync local search query with prop
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchQueryChange) {
      onSearchQueryChange(localSearchQuery);
    } else if (localSearchQuery.trim()) {
      window.location.href = `/?search=${encodeURIComponent(localSearchQuery.trim())}`;
    }
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchQuery(value);
    if (onSearchQueryChange) {
      onSearchQueryChange(value);
    }
  };

  const handleMobileCategoryChange = (categoryId: string) => {
    if (onCategoryChange) {
      onCategoryChange(categoryId);
    }
    setIsMobileMenuOpen(false);
  };

  const handleMobileSortChange = (sort: string) => {
    if (onSortChange) {
      onSortChange(sort);
    }
    setIsMobileMenuOpen(false);
  };

  const getSortDisplayName = (sort: string) => {
    switch (sort) {
      case 'latest': return '最新';
      case 'oldest': return '古い順';
      case 'popular': return '人気順';
      case 'title': return 'タイトル順';
      default: return '最新';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container px-2">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              {settings.siteLogoImage ? (
                <img 
                  src={settings.siteLogoImage} 
                  alt={settings.siteTitle}
                  className="h-8 w-8 object-contain"
                />
              ) : (
                (() => {
                  const IconComponent = (LucideIcons as any)[settings.siteLogoIcon] || LucideIcons.Video;
                  return <IconComponent className="h-8 w-8 text-primary" />;
                })()
              )}
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {settings.siteTitle}
              </span>
            </Link>

            {/* Search Bar - Center */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8">
              <form onSubmit={handleSearch} className="w-full">
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="動画を探す..."
                      value={localSearchQuery}
                      onChange={handleSearchInputChange}
                      className="pl-10 pr-4 w-full"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 px-3"
                      disabled={!localSearchQuery.trim()}
                    >
                      検索
                    </Button>
                  </div>
                  
                  {/* View Toggle Buttons */}
                  {showViewToggle && onViewModeChange && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onViewModeChange('grid')}
                        className="h-8 px-2"
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onViewModeChange('list')}
                        className="h-8 px-2"
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Right side controls */}
            <div className="flex items-center space-x-2">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="hidden sm:flex"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">テーマ切り替え</span>
              </Button>

              {/* 検索アイコン（モバイルのみ） */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileSearchOpen((v) => !v)}
              >
                <Search className="h-5 w-5" />
                <span className="sr-only">検索</span>
              </Button>

              {/* User menu or login button（PCのみ表示） */}
              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full hidden md:inline-flex">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.profileImageUrl} alt={user.displayName || user.username} />
                        <AvatarFallback>
                          {(user.displayName || user.username).charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName || user.username}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {getRoleDisplayName(user.role)}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {user.role !== 'VIEWER' && (
                      <DropdownMenuItem asChild>
                        <Link href="/playlists" className="cursor-pointer">
                          <PlaySquare className="mr-2 h-4 w-4" />
                          マイプレイリスト
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {user.role === 'VIEWER' && (
                      <DropdownMenuItem asChild>
                        <Link href="/account" className="cursor-pointer">
                          <Users className="mr-2 h-4 w-4" />
                          アカウント
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canUploadVideos(user.role) && (
                      <DropdownMenuItem asChild>
                        <Link href="/upload" className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" />
                          ビデオをアップロード
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {(canManageUsers(user.role) || canUploadVideos(user.role)) && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <Users className="mr-2 h-4 w-4" />
                          管理画面
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        設定
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      ログアウト
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
                  <Link href="/login">
                    ログイン
                  </Link>
                </Button>
              )}

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
                <span className="sr-only">メニュー</span>
              </Button>
            </div>
          </div>

          {/* Mobile Search（アイコンタップ時のみ展開） */}
          {isMobileSearchOpen && (
            <div className="md:hidden py-4 animate-fade-in">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="動画を検索..."
                    value={localSearchQuery}
                    onChange={handleSearchInputChange}
                    className="pl-10 pr-20"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 px-3"
                    disabled={!localSearchQuery.trim()}
                  >
                    検索
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t">
              <div className="flex flex-col space-y-2">
                {/* Mobile Filters Section */}
                {showMobileFilters && (categories.length > 0 || onSortChange) && (
                  <>
                    <div className="px-2 py-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Filter className="h-4 w-4" />
                        フィルター
                      </div>
                    </div>

                    {/* Category Filter */}
                    {categories.length > 0 && onCategoryChange && (
                      <div className="space-y-1">
                        <div className="px-2 text-xs font-medium text-muted-foreground">カテゴリ</div>
                        <div className="max-h-48 overflow-y-auto">
                          <Button
                            variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                            size="sm"
                            className="w-full justify-between"
                            onClick={() => handleMobileCategoryChange('all')}
                          >
                            <span>すべて</span>
                            {selectedCategory === 'all' && <ChevronRight className="h-4 w-4" />}
                          </Button>
                          {categories
                            .filter(category => category.name !== 'すべて' && category.name !== 'all')
                            .map((category) => (
                              <Button
                                key={category.id}
                                variant={selectedCategory === category.id ? 'default' : 'ghost'}
                                size="sm"
                                className="w-full justify-between"
                                onClick={() => handleMobileCategoryChange(category.id)}
                              >
                                <span>{category.name}</span>
                                {selectedCategory === category.id && <ChevronRight className="h-4 w-4" />}
                              </Button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Sort Filter */}
                    {onSortChange && (
                      <div className="space-y-1">
                        <div className="px-2 text-xs font-medium text-muted-foreground">並び順</div>
                        <div className="space-y-1">
                          {['latest', 'oldest', 'popular', 'title'].map((sort) => (
                            <Button
                              key={sort}
                              variant={sortBy === sort ? 'default' : 'ghost'}
                              size="sm"
                              className="w-full justify-between"
                              onClick={() => handleMobileSortChange(sort)}
                            >
                              <span>{getSortDisplayName(sort)}</span>
                              {sortBy === sort && <ChevronRight className="h-4 w-4" />}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags Search */}
                    <div className="space-y-1">
                      <div className="px-2 text-xs font-medium text-muted-foreground">タグ検索</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        asChild
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Link href="/tags">
                          <Search className="mr-2 h-4 w-4" />
                          タグ一覧を見る
                        </Link>
                      </Button>
                    </div>

                    {/* View Toggle for Mobile */}
                    {showViewToggle && onViewModeChange && (
                      <div className="space-y-1">
                        <div className="px-2 text-xs font-medium text-muted-foreground">表示形式</div>
                        <div className="flex gap-2">
                          <Button
                            variant={viewMode === 'grid' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onViewModeChange('grid')}
                            className="flex-1"
                          >
                            <Grid3X3 className="w-4 h-4 mr-2" />
                            グリッド
                          </Button>
                          <Button
                            variant={viewMode === 'list' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onViewModeChange('list')}
                            className="flex-1"
                          >
                            <List className="w-4 h-4 mr-2" />
                            リスト
                          </Button>
                        </div>
                      </div>
                    )}

                    <Separator className="my-2" />
                  </>
                )}

                {/* Theme toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="justify-start"
                >
                  <Sun className="h-4 w-4 mr-2 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 ml-2 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="ml-6">テーマ切り替え</span>
                </Button>

                {/* User menu items */}
                {isAuthenticated && user ? (
                  <>
                    {user.role !== 'VIEWER' && (
                      <Button variant="ghost" size="sm" className="justify-start" asChild>
                        <Link href="/playlists">
                          <PlaySquare className="mr-2 h-4 w-4" />
                          マイプレイリスト
                        </Link>
                      </Button>
                    )}
                    {user.role === 'VIEWER' && (
                      <Button variant="ghost" size="sm" className="justify-start" asChild>
                        <Link href="/account">
                          <Users className="mr-2 h-4 w-4" />
                          アカウント
                        </Link>
                      </Button>
                    )}
                    {canUploadVideos(user.role) && (
                      <Button variant="ghost" size="sm" className="justify-start" asChild>
                        <Link href="/upload">
                          <Upload className="mr-2 h-4 w-4" />
                          ビデオをアップロード
                        </Link>
                      </Button>
                    )}
                    {(canManageUsers(user.role) || canUploadVideos(user.role)) && (
                      <Button variant="ghost" size="sm" className="justify-start" asChild>
                        <Link href="/admin">
                          <Users className="mr-2 h-4 w-4" />
                          管理画面
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="justify-start" asChild>
                      <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        設定
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      ログアウト
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" className="justify-start" asChild>
                    <Link href="/login">
                      ログイン
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Login Dialog */}
      <LoginDialog open={isLoginOpen} onOpenChange={setIsLoginOpen} />
    </>
  );
};