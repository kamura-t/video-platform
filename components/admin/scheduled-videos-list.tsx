'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar, 
  Clock, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash2, 
  Play, 
  Pause,
  RefreshCw,
  Filter,
  Search,
  AlertCircle,
  CheckCircle,
  Users,
  FileVideo,
  FileText
} from 'lucide-react';
import Image from 'next/image';
import { ScheduledVideoEditDialog } from './scheduled-video-edit-dialog';

interface ScheduledItem {
  id: number;
  type: 'video' | 'post';
  itemId: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  duration?: number;
  visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT';
  isScheduled: boolean;
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    profileImageUrl?: string;
  };
  categories: {
    id: number;
    name: string;
    slug: string;
    color?: string;
  }[];
  video?: {
    id: number;
    videoId: string;
    title: string;
    thumbnailUrl?: string;
  };
}

interface ScheduledVideosListProps {
  className?: string;
}

export const ScheduledVideosList: React.FC<ScheduledVideosListProps> = ({
  className = '',
}) => {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  
  // フィルター状態
  const [typeFilter, setTypeFilter] = useState<'all' | 'publish' | 'unpublish'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // バッチ操作状態
  const [batchLoading, setBatchLoading] = useState(false);
  
  // 編集ダイアログ状態
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: number; type: 'video' | 'post' } | null>(null);

  // データ取得
  const fetchScheduledItems = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        type: typeFilter,
        status: statusFilter,
      });
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      const response = await fetch(`/api/admin/scheduled-videos?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setItems(data.data.items);
        setTotalPages(data.data.pagination.totalPages);
        setTotalItems(data.data.pagination.total);
      } else {
        setError(data.error || '予約投稿の取得に失敗しました');
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentPage, typeFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchScheduledItems();
  }, [fetchScheduledItems]);

  // 選択アイテムの管理
  const handleItemSelect = (itemId: number, checked: boolean) => {
    const newSelection = new Set(selectedItems);
    if (checked) {
      newSelection.add(itemId);
    } else {
      newSelection.delete(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(items.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  // バッチ操作
  const handleBatchOperation = async (action: string) => {
    if (selectedItems.size === 0) return;
    
    setBatchLoading(true);
    try {
      const selectedItemsData = items
        .filter(item => selectedItems.has(item.id))
        .map(item => ({ id: item.id, type: item.type }));
      
      const response = await fetch('/api/admin/scheduled-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          items: selectedItemsData,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchScheduledItems();
        setSelectedItems(new Set());
      } else {
        setError(data.error || 'バッチ操作に失敗しました');
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setBatchLoading(false);
    }
  };

  // 個別操作
  const handleIndividualOperation = async (item: ScheduledItem, action: string) => {
    try {
      const response = await fetch(`/api/admin/scheduled-videos/${item.id}?type=${item.type}&action=${action}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchScheduledItems();
      } else {
        setError(data.error || '操作に失敗しました');
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました');
    }
  };

  // 編集ダイアログを開く
  const handleEditItem = (item: ScheduledItem) => {
    setEditingItem({ id: item.id, type: item.type });
    setEditDialogOpen(true);
  };

  // 編集ダイアログ保存後
  const handleEditSave = async () => {
    await fetchScheduledItems();
    setEditDialogOpen(false);
    setEditingItem(null);
  };

  // 時刻フォーマット
  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ステータス判定
  const getItemStatus = (item: ScheduledItem) => {
    const now = new Date();
    
    if (item.scheduledPublishAt) {
      const publishTime = new Date(item.scheduledPublishAt);
      if (publishTime > now) {
        return { type: 'scheduled', label: '予約投稿待ち', color: 'blue' };
      }
    }
    
    if (item.scheduledUnpublishAt) {
      const unpublishTime = new Date(item.scheduledUnpublishAt);
      if (unpublishTime > now) {
        return { type: 'scheduled_unpublish', label: '予約非公開待ち', color: 'orange' };
      }
    }
    
    return { type: 'completed', label: '処理完了', color: 'green' };
  };

  if (loading && items.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          読み込み中...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダー */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                予約投稿管理
              </CardTitle>
              <CardDescription>
                予約投稿と予約非公開の管理・編集を行います
              </CardDescription>
            </div>
            <Button onClick={fetchScheduledItems} variant="outline" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              更新
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* フィルター */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">種類</label>
              <Select value={typeFilter} onValueChange={(value: any) => {
                setTypeFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="publish">予約投稿</SelectItem>
                  <SelectItem value="unpublish">予約非公開</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">ステータス</label>
              <Select value={statusFilter} onValueChange={(value: any) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="pending">待機中</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">検索</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="タイトルで検索..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* バッチ操作 */}
      {selectedItems.size > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">
                  {selectedItems.size}件選択中
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBatchOperation('cancel_scheduled')}
                  disabled={batchLoading}
                >
                  <Pause className="w-4 h-4 mr-1" />
                  予約投稿キャンセル
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBatchOperation('cancel_unpublish')}
                  disabled={batchLoading}
                >
                  <EyeOff className="w-4 h-4 mr-1" />
                  予約非公開キャンセル
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBatchOperation('execute_now')}
                  disabled={batchLoading}
                >
                  <Play className="w-4 h-4 mr-1" />
                  即座に公開
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* エラー表示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* アイテム一覧 */}
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">予約投稿はありません</p>
            </div>
          ) : (
            <div className="space-y-0">
              {/* ヘッダー */}
              <div className="flex items-center p-4 border-b bg-gray-50">
                <Checkbox
                  checked={selectedItems.size === items.length && items.length > 0}
                  onCheckedChange={handleSelectAll}
                  className="mr-4"
                />
                <div className="flex-1 grid grid-cols-12 gap-4 text-sm font-medium text-gray-600">
                  <div className="col-span-4">コンテンツ</div>
                  <div className="col-span-2">作成者</div>
                  <div className="col-span-2">予約投稿</div>
                  <div className="col-span-2">予約非公開</div>
                  <div className="col-span-1">ステータス</div>
                  <div className="col-span-1">操作</div>
                </div>
              </div>

              {/* アイテムリスト */}
              {items.map((item) => {
                const status = getItemStatus(item);
                
                return (
                  <div key={`${item.type}-${item.id}`} className="flex items-center p-4 border-b hover:bg-gray-50">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={(checked) => handleItemSelect(item.id, !!checked)}
                      className="mr-4"
                    />
                    
                    <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                      {/* コンテンツ情報 */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className="relative w-16 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                          {item.thumbnailUrl ? (
                            <Image
                              src={item.thumbnailUrl}
                              alt={item.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {item.type === 'video' ? (
                                <FileVideo className="w-6 h-6 text-gray-400" />
                              ) : (
                                <FileText className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium truncate">{item.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {item.type === 'video' ? '動画' : '投稿'}
                            </Badge>
                            <Badge
                              variant={item.visibility === 'PUBLIC' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {item.visibility === 'PUBLIC' ? '公開' : item.visibility === 'PRIVATE' ? '非公開' : '下書き'}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* 作成者 */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs">
                            {item.user.profileImageUrl ? (
                              <Image
                                src={item.user.profileImageUrl}
                                alt={item.user.displayName}
                                width={24}
                                height={24}
                                className="rounded-full"
                              />
                            ) : (
                              <Users className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                          <span className="text-sm truncate">{item.user.displayName}</span>
                        </div>
                      </div>

                      {/* 予約投稿時刻 */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="truncate">
                            {formatDateTime(item.scheduledPublishAt)}
                          </span>
                        </div>
                      </div>

                      {/* 予約非公開時刻 */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1 text-sm">
                          <EyeOff className="w-3 h-3 text-gray-400" />
                          <span className="truncate">
                            {formatDateTime(item.scheduledUnpublishAt)}
                          </span>
                        </div>
                      </div>

                      {/* ステータス */}
                      <div className="col-span-1">
                        <Badge
                          variant={status.color === 'green' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {status.label}
                        </Badge>
                      </div>

                      {/* 操作 */}
                      <div className="col-span-1">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            title="編集"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleIndividualOperation(item, 'cancel_scheduled')}
                            disabled={!item.scheduledPublishAt}
                            title="予約投稿をキャンセル"
                          >
                            <Pause className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleIndividualOperation(item, 'cancel_unpublish')}
                            disabled={!item.scheduledUnpublishAt}
                            title="予約非公開をキャンセル"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ページネーション */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {totalItems}件中 {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, totalItems)}件を表示
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  前へ
                </Button>
                <span className="text-sm">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages || loading}
                >
                  次へ
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 編集ダイアログ */}
      <ScheduledVideoEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        itemId={editingItem?.id}
        itemType={editingItem?.type}
        onSave={handleEditSave}
      />
    </div>
  );
};