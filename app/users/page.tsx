'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, Video, Calendar } from 'lucide-react';

interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  videoCount: number;
  totalViews: number;
  createdAt: string;
  lastActiveAt?: string;
}

export default function UsersPage() {
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'name' | 'videos'>('popular');

  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchQuery(query);
    fetchUsers(query, sortBy);
  }, [searchParams, sortBy]);

  const fetchUsers = async (query: string = '', sort: string = 'popular') => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (sort) params.set('sort', sort);
      
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      // エラー時は空の配列を設定
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (sortBy) params.set('sort', sortBy);
    router.push(`/users?${params.toString()}`);
  };

  const handleSortChange = (sort: 'latest' | 'popular' | 'name' | 'videos') => {
    setSortBy(sort);
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    params.set('sort', sort);
    router.push(`/users?${params.toString()}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Users className="w-8 h-8" />
                投稿者一覧
              </h1>
              <p className="text-muted-foreground mt-2">
                動画を投稿しているユーザーを探してみましょう
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                検索・フィルター
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="投稿者を検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className="flex items-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      検索
                    </Button>
                  </div>
                </div>
                
                {/* Sort Options */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={sortBy === 'popular' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortChange('popular')}
                  >
                    人気順
                  </Button>
                  <Button
                    variant={sortBy === 'latest' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortChange('latest')}
                  >
                    最新順
                  </Button>
                  <Button
                    variant={sortBy === 'name' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortChange('name')}
                  >
                    名前順
                  </Button>
                  <Button
                    variant={sortBy === 'videos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortChange('videos')}
                  >
                    動画数順
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Users Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : users.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">投稿者が見つかりません</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? `"${searchQuery}" に一致する投稿者がいません。` : 'まだ投稿者がいません。'}
                </p>
                {searchQuery && (
                  <Button onClick={() => {
                    setSearchQuery('');
                    router.push('/users');
                  }}>
                    検索をクリア
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {users.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar} alt={user.displayName} />
                        <AvatarFallback>
                          {user.displayName?.charAt(0) || user.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <Link 
                          href={`/@${user.username}`}
                          className="block hover:underline"
                        >
                          <h3 className="font-semibold text-sm truncate">
                            {user.displayName || user.username}
                          </h3>
                        </Link>
                        <p className="text-xs text-muted-foreground truncate">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                    
                    {user.bio && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {user.bio}
                      </p>
                    )}
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Video className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">動画数</span>
                        </div>
                        <span className="font-medium">{user.videoCount}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">登録日</span>
                        </div>
                        <span className="font-medium">{formatDate(user.createdAt)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t">
                      <Link 
                        href={`/@${user.username}`}
                        className="w-full"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          プロフィールを見る
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 