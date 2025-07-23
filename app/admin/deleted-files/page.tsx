'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, FileText, User, HardDrive, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface DeletedFile {
  deletedAt: string;
  videoId: string;
  title: string;
  originalFilePath: string;
  originalThumbnailPath: string;
  archivedFilePath: string;
  archivedThumbnailPath: string;
  uploaderId: number;
  deletedBy: number;
  fileSize: string;
  originalFilename: string;
  mimeType: string;
  deleter: {
    id: number;
    username: string;
    displayName: string;
  } | null;
  uploader: {
    id: number;
    username: string;
    displayName: string;
  } | null;
}

interface DeletedFilesResponse {
  success: boolean;
  data: {
    logs: DeletedFile[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

export default function DeletedFilesPage() {
  const [deletedFiles, setDeletedFiles] = useState<DeletedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const fetchDeletedFiles = async (page: number = 1, date?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (date) {
        params.append('date', date);
      }

      const response = await fetch(`/api/admin/deleted-files?${params}`);
      const data: DeletedFilesResponse = await response.json();

      if (data.success) {
        setDeletedFiles(data.data.logs);
        setPagination(data.data.pagination);
      } else {
        console.error('削除ログの取得に失敗しました');
      }
    } catch (error) {
      console.error('削除ログ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedFiles(currentPage, searchDate);
  }, [currentPage, searchDate]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchDeletedFiles(1, searchDate);
  };

  const handleRefresh = () => {
    fetchDeletedFiles(currentPage, searchDate);
  };

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy/MM/dd HH:mm:ss', { locale: ja });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">削除済みファイル管理</h1>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          更新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            検索・フィルター
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">
                削除日で検索 (YYYY-MM-DD)
              </label>
              <Input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                placeholder="例: 2024-12-15"
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              検索
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchDate('');
                setCurrentPage(1);
                fetchDeletedFiles(1);
              }}
            >
              クリア
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            削除済みファイル一覧
            <Badge variant="secondary" className="ml-2">
              {pagination.totalCount}件
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">読み込み中...</p>
            </div>
          ) : deletedFiles.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">削除されたファイルはありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>削除日時</TableHead>
                    <TableHead>動画情報</TableHead>
                    <TableHead>アップロード者</TableHead>
                    <TableHead>削除者</TableHead>
                    <TableHead>ファイルサイズ</TableHead>
                    <TableHead>待避場所</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedFiles.map((file, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDate(file.deletedAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{file.title}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {file.videoId}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {file.originalFilename}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {file.uploader?.displayName || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {file.deleter?.displayName || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">
                            {formatFileSize(file.fileSize)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground font-mono">
                            {file.archivedFilePath}
                          </div>
                          {file.archivedThumbnailPath && (
                            <div className="text-xs text-muted-foreground font-mono">
                              サムネイル: {file.archivedThumbnailPath}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* ページネーション */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {pagination.totalCount}件中 {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, pagination.totalCount)}件を表示
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={!pagination.hasPrevPage}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      前のページ
                    </Button>
                    <span className="px-4 py-2 text-sm">
                      {currentPage} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={!pagination.hasNextPage}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      次のページ
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 