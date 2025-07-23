'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  EyeOff, 
  AlertCircle, 
  Save,
  X,
  FileVideo,
  FileText
} from 'lucide-react';
import Image from 'next/image';

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
  updatedAt: string;
  publishedAt?: string;
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
  tags: {
    id: number;
    name: string;
  }[];
  video?: {
    id: number;
    videoId: string;
    title: string;
    thumbnailUrl?: string;
    duration?: number;
  };
}

interface ScheduledVideoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId?: number;
  itemType?: 'video' | 'post';
  onSave?: () => void;
}

export const ScheduledVideoEditDialog: React.FC<ScheduledVideoEditDialogProps> = ({
  open,
  onOpenChange,
  itemId,
  itemType = 'video',
  onSave,
}) => {
  const [item, setItem] = useState<ScheduledItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  
  // フォーム状態
  const [scheduledPublishAt, setScheduledPublishAt] = useState('');
  const [scheduledUnpublishAt, setScheduledUnpublishAt] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE' | 'DRAFT'>('DRAFT');

  // アイテム詳細取得
  const fetchItem = async () => {
    if (!itemId) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/admin/scheduled-videos/${itemId}?type=${itemType}`);
      const data = await response.json();
      
      if (data.success) {
        setItem(data.data);
        // フォーム初期値設定
        setScheduledPublishAt(data.data.scheduledPublishAt 
          ? new Date(data.data.scheduledPublishAt).toISOString().slice(0, 16) 
          : ''
        );
        setScheduledUnpublishAt(data.data.scheduledUnpublishAt 
          ? new Date(data.data.scheduledUnpublishAt).toISOString().slice(0, 16) 
          : ''
        );
        setVisibility(data.data.visibility);
      } else {
        setError(data.error || 'アイテムの取得に失敗しました');
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && itemId) {
      fetchItem();
    } else {
      // ダイアログが閉じられたらリセット
      setItem(null);
      setScheduledPublishAt('');
      setScheduledUnpublishAt('');
      setVisibility('DRAFT');
      setError('');
    }
  }, [open, itemId, itemType]);

  // 保存
  const handleSave = async () => {
    if (!item) return;
    
    setSaving(true);
    setError('');
    
    try {
      const updateData: any = {
        type: item.type,
        scheduledPublishAt: scheduledPublishAt || null,
        scheduledUnpublishAt: scheduledUnpublishAt || null,
        visibility,
      };
      
      const response = await fetch(`/api/admin/scheduled-videos/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSave?.();
        onOpenChange(false);
      } else {
        setError(data.error || '保存に失敗しました');
      }
    } catch (err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setSaving(false);
    }
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

  // バリデーション
  const validateTimes = () => {
    const errors: string[] = [];
    const now = new Date();
    
    if (scheduledPublishAt) {
      const publishTime = new Date(scheduledPublishAt);
      if (publishTime <= now) {
        errors.push('予約投稿時刻は現在時刻より後である必要があります');
      }
    }
    
    if (scheduledUnpublishAt) {
      const unpublishTime = new Date(scheduledUnpublishAt);
      if (unpublishTime <= now) {
        errors.push('予約非公開時刻は現在時刻より後である必要があります');
      }
      
      if (scheduledPublishAt) {
        const publishTime = new Date(scheduledPublishAt);
        if (unpublishTime <= publishTime) {
          errors.push('予約非公開時刻は予約投稿時刻より後である必要があります');
        }
      }
    }
    
    return errors;
  };

  const validationErrors = validateTimes();
  const canSave = validationErrors.length === 0 && !saving && !loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            予約投稿編集
          </DialogTitle>
          <DialogDescription>
            予約投稿と予約非公開の時刻を編集できます
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">読み込み中...</span>
          </div>
        ) : item ? (
          <div className="space-y-6">
            {/* アイテム情報 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="relative w-20 h-15 bg-gray-200 rounded overflow-hidden flex-shrink-0">
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
                        <FileVideo className="w-8 h-8 text-gray-400" />
                      ) : (
                        <FileText className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">
                      {item.type === 'video' ? '動画' : '投稿'}
                    </Badge>
                    <Badge
                      variant={item.visibility === 'PUBLIC' ? 'default' : 'secondary'}
                    >
                      {item.visibility === 'PUBLIC' ? '公開' : item.visibility === 'PRIVATE' ? '非公開' : '下書き'}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>作成者: {item.user.displayName}</div>
                    <div>作成日時: {formatDateTime(item.createdAt)}</div>
                    {item.publishedAt && (
                      <div>公開日時: {formatDateTime(item.publishedAt)}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 現在の設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium text-blue-900">現在の予約投稿</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">
                    {formatDateTime(item.scheduledPublishAt)}
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-blue-900">現在の予約非公開</Label>
                <div className="flex items-center gap-2 mt-1">
                  <EyeOff className="w-4 h-4 text-blue-600" />
                  <span className="text-sm">
                    {formatDateTime(item.scheduledUnpublishAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* 編集フォーム */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scheduledPublishAt">予約投稿日時</Label>
                  <Input
                    id="scheduledPublishAt"
                    type="datetime-local"
                    value={scheduledPublishAt}
                    onChange={(e) => setScheduledPublishAt(e.target.value)}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    空白にすると予約投稿をキャンセルします
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="scheduledUnpublishAt">予約非公開日時</Label>
                  <Input
                    id="scheduledUnpublishAt"
                    type="datetime-local"
                    value={scheduledUnpublishAt}
                    onChange={(e) => setScheduledUnpublishAt(e.target.value)}
                    min={
                      scheduledPublishAt 
                        ? new Date(new Date(scheduledPublishAt).getTime() + 60000).toISOString().slice(0, 16)
                        : new Date(Date.now() + 60000).toISOString().slice(0, 16)
                    }
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    空白にすると予約非公開をキャンセルします
                  </p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="visibility">公開設定</Label>
                <Select value={visibility} onValueChange={(value: any) => setVisibility(value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">公開</SelectItem>
                    <SelectItem value="PRIVATE">非公開</SelectItem>
                    <SelectItem value="DRAFT">下書き</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* バリデーションエラー */}
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* 一般エラー */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">アイテムが見つかりません</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            <X className="w-4 h-4 mr-2" />
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};