'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Image as ImageIcon, 
  X, 
  AlertCircle, 
  CheckCircle, 
  Zap,
  Info
} from 'lucide-react';
import { validationService } from '@/lib/validation-service';

interface ThumbnailUploadProps {
  onThumbnailSelect: (file: File) => void;
  uploadMethod?: 'file' | 'youtube';
  optimizationInfo?: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    dimensions: string;
    format: string;
  };
  videoId?: string;
  id?: string;
  currentThumbnailUrl?: string;
}

export const ThumbnailUpload: React.FC<ThumbnailUploadProps> = ({
  onThumbnailSelect,
  uploadMethod,
  optimizationInfo,
  videoId,
  id,
  currentThumbnailUrl,
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);
  const [showOptimizationInfo, setShowOptimizationInfo] = useState(false);
  const [validationConfig, setValidationConfig] = useState<any>(null);

  // 設定を取得
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await validationService.getValidationConfig();
        setValidationConfig(config);
      } catch (error) {
        console.error('Failed to fetch validation config:', error);
      }
    };

    fetchConfig();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    setUploadError('');
    setUploadWarnings([]);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setUploadError(`画像ファイルサイズが${validationConfig?.image?.maxSizeMB || 10}MBを超えています。`);
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setUploadError('サポートされていない画像形式です。');
      } else {
        setUploadError('画像のアップロードに失敗しました。');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // バリデーション実行
      try {
        const validationResult = await validationService.validateThumbnail(file);
        
        if (!validationResult.isValid) {
          setUploadError(validationResult.error || '画像が無効です');
          return;
        }
        
        if (validationResult.warnings && validationResult.warnings.length > 0) {
          setUploadWarnings(validationResult.warnings);
        }
        
        setSelectedImage(file);
        onThumbnailSelect(file);

        // プレビューURL作成
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } catch (error) {
        console.error('Validation failed:', error);
        setUploadError('画像の検証に失敗しました');
      }
    }
  }, [onThumbnailSelect, validationConfig]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: validationConfig?.image?.allowedTypes?.reduce((acc: any, type: string) => {
      acc[type] = [];
      return acc;
    }, {}) || {},
    maxSize: validationConfig?.image?.maxSizeMB ? validationConfig.image.maxSizeMB * 1024 * 1024 : undefined,
    multiple: false,
  });

  const removeImage = () => {
    setSelectedImage(null);
    setUploadError('');
    setUploadWarnings([]);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };



  const formatFileSize = (bytes: number) => validationService.formatFileSize(bytes);

  return (
    <div className="space-y-4">


      {!selectedImage ? (
        <Card
          {...getRootProps()}
          className={`border-2 border-dashed cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          } ${uploadError ? 'border-destructive' : ''}`}
        >
          <CardContent className="flex flex-col items-center justify-center py-8 px-6">
            <input {...getInputProps()} />
            
            {/* 現在のサムネイル表示 */}
            {currentThumbnailUrl && (
              <div className="mb-4">
                <div className="flex justify-center">
                  <div className="relative inline-block">
                    <img
                      src={`${currentThumbnailUrl}?t=${Date.now()}`}
                      alt="現在のサムネイル"
                      className="w-48 h-32 object-cover rounded-lg border border-gray-200"
                      key={currentThumbnailUrl} // URLが変更されたときに再レンダリング
                    />
                    <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-medium">現在のサムネイル</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  新しい画像をアップロードすると置き換わります
                </p>
              </div>
            )}
            
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <ImageIcon className="w-6 h-6 text-primary" />
            </div>
            
            <div className="text-center space-y-2">
              <h4 className="font-medium">
                {isDragActive ? '画像をドロップしてください' : 'サムネイル画像をアップロード'}
              </h4>
              <p className="text-sm text-muted-foreground">
                ドラッグ&ドロップまたはクリックして選択
              </p>
              <p className="text-xs text-muted-foreground">
                {validationConfig?.image?.allowedExtensions?.join('、') || 'JPEG、PNG、WebP、GIF'}
                （最大{validationConfig?.image?.maxSizeMB || 10}MB）
              </p>
            </div>
            
            <Button variant="outline" size="sm" className="mt-3">
              画像を選択
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="サムネイルプレビュー"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium truncate">{selectedImage.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedImage.size)}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">画像が選択されました</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeImage}
                    className="flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最適化情報 */}
      {optimizationInfo && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">画像最適化完了</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOptimizationInfo(!showOptimizationInfo)}
                className="text-blue-600 hover:text-blue-700"
              >
                <Info className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {optimizationInfo.compressionRatio}% 削減
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {optimizationInfo.format.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {optimizationInfo.dimensions}
              </Badge>
            </div>
            
            {showOptimizationInfo && (
              <div className="text-xs text-blue-700 space-y-1">
                <div>元サイズ: {formatFileSize(optimizationInfo.originalSize)}</div>
                <div>最適化後: {formatFileSize(optimizationInfo.optimizedSize)}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* エラー表示 */}
      {uploadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {uploadError}
          </AlertDescription>
        </Alert>
      )}

      {/* 警告表示 */}
      {uploadWarnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="space-y-1">
              {uploadWarnings.map((warning, index) => (
                <div key={index}>• {warning}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {uploadMethod === 'youtube' && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            YouTube動画の場合、サムネイルは自動的に取得されます。カスタムサムネイルをアップロードすると、それが優先されます。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};