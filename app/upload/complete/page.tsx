'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  Volume2,
  FileImage,
  RefreshCw,
  Clock,
  Monitor,
  HardDrive,
  Upload,
  List
} from 'lucide-react';

interface VideoInfo {
  id: number;
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  duration: number;
  viewCount: number;
  uploadType: 'FILE' | 'YOUTUBE';
  filePath?: string;
  originalFilename?: string;
  fileSize?: number;
  mimeType?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  uploaderId: number;
  visibility: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  gpuJobId?: string;
  createdAt: string;
  updatedAt: string;
}

interface TranscodeJob {
  id: number;
  jobId: string;
  videoId: number;
  inputFile: string;
  outputFile: string;
  preset: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  createdAt: string;
  updatedAt: string;
  // GPU変換サーバーからの詳細情報
  videoTitle?: string;
  originalFileName?: string;
  convertedFileName?: string;
  inputSizeMB?: number;
  outputSizeMB?: number;
  compressionRate?: number;
  processingTime?: number;
  duration?: number;
  presetDetails?: {
    description: string;
    videoCodec: string;
    audioCodec: string;
    resolution: string;
    bitrate: string;
    fps: number;
  };
  audioCodec?: string;
  videoMetadata?: {
    video: {
      resolution: string;
      bitrate: string;
      frameRate: string;
      codec: string;
      pixelFormat: string;
      aspectRatio: string;
      colorSpace: string;
    };
    audio: {
      codec: string;
      bitrate: string;
      sampleRate: string;
      channels: number;
      channelLayout: string;
      sampleFormat: string;
    };
  };
  errorMessage?: string; // エラーメッセージを追加
  gpuJobStatus?: { // GPUジョブの状態を追加
    state: string;
    message: string;
  };
  errorDetails?: { // エラー詳細を追加
    message: string;
    status: number;
    isJobNotFound: boolean;
  };
  estimatedTimeRemaining?: number; // 推定残り時間を追加
}

export default function UploadCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const videoId = searchParams.get('videoId');
  
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [transcodeJob, setTranscodeJob] = useState<TranscodeJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // GPU変換ステータスの定期更新
  useEffect(() => {
    if (!transcodeJob) return;

    // 変換中または待機中の場合は定期的にステータスを更新
    if (transcodeJob.status === 'PROCESSING' || transcodeJob.status === 'PENDING') {
      setIsPolling(true);
      
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/transcode/job/${transcodeJob.jobId}`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setTranscodeJob(result.data);
              
              // 完了または失敗した場合はポーリングを停止
              if (result.data.status === 'COMPLETED' || result.data.status === 'FAILED') {
                setIsPolling(false);
                clearInterval(pollInterval);
              }
            }
          }
        } catch (error) {
          // エラーは無視
        }
      }, 10000); // 10秒ごとに更新

      return () => {
        clearInterval(pollInterval);
        setIsPolling(false);
      };
    }
  }, [transcodeJob?.jobId, transcodeJob?.status]);

  useEffect(() => {
    if (!videoId) {
      setError('動画IDが指定されていません');
      setLoading(false);
      return;
    }

    const fetchVideoInfo = async () => {
      try {
        // まず動画情報を取得
        const videoResponse = await fetch(`/api/videos/${videoId}`, {
          credentials: 'include'
        });
        
        if (!videoResponse.ok) {
          const errorText = await videoResponse.text();
          throw new Error(`動画情報の取得に失敗しました (${videoResponse.status})`);
        }
        
        const videoResult = await videoResponse.json();
        
        if (!videoResult.success) {
          throw new Error(videoResult.error || '動画情報の取得に失敗しました');
        }
        
        setVideoInfo(videoResult.data);

        // GPU変換ジョブ情報を取得
        // 動画情報に含まれるtranscodeJobsから最新のジョブを取得
        let jobId = null;
        
        if (videoResult.data.transcodeJobs && videoResult.data.transcodeJobs.length > 0) {
          // 最新のGPU変換ジョブを取得
          const latestJob = videoResult.data.transcodeJobs[0];
          jobId = latestJob.jobId;
        }
        
        if (jobId) {
          const transcodeResponse = await fetch(`/api/transcode/job/${jobId}`, {
            credentials: 'include'
          });
          
          if (transcodeResponse.ok) {
            const transcodeResult = await transcodeResponse.json();
            if (transcodeResult.success) {
              setTranscodeJob(transcodeResult.data);
            }
          }
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : '動画情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoInfo();
  }, [videoId]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    // 空のオブジェクト、null、undefined、空文字列のチェック
    if (!dateString || 
        (typeof dateString === 'object' && Object.keys(dateString).length === 0) ||
        dateString === null ||
        dateString === undefined) {
      return '日時不明';
    }
    
    let date: Date;
    
    // 複数の日付形式に対応
    if (typeof dateString === 'string') {
      // ISO 8601形式（例: "2025-01-15T10:30:00.000Z"）
      if (dateString.includes('T') || dateString.includes('Z')) {
        date = new Date(dateString);
      }
      // タイムスタンプ形式（例: "2025-01-15 10:30:00"）
      else if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
        date = new Date(dateString);
      }
      // Unix タイムスタンプ（数値文字列）
      else if (/^\d+$/.test(dateString)) {
        date = new Date(parseInt(dateString));
      }
      // その他の形式
      else {
        date = new Date(dateString);
      }
    } else {
      date = new Date(dateString);
    }
    
    // 日付の妥当性をチェック
    if (isNaN(date.getTime())) {
      return '日時不明';
    }
    
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Tokyo'
    });
  };

  const formatTime = (seconds: number) => {
    if (seconds === Infinity || seconds === -Infinity || isNaN(seconds)) {
      return '不明';
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (h > 0) {
      parts.push(`${h}時間`);
    }
    if (m > 0) {
      parts.push(`${m}分`);
    }
    if (s > 0 || parts.length === 0) { // 時間や分がある場合は秒を表示
      parts.push(`${s}秒`);
    }
    return parts.join('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'PROCESSING':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'FAILED':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <FileImage className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '完了';
      case 'PROCESSING':
        return '変換中';
      case 'PENDING':
        return '待機中';
      case 'FAILED':
        return '失敗';
      default:
        return '不明';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <Clock className="w-8 h-8 animate-spin text-primary mr-3" />
                  <span>動画情報を読み込み中...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !videoInfo) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error || '動画情報が見つかりません'}</AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button onClick={() => router.push('/upload')}>
                アップロードページに戻る
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* ヘッダー */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              アップロード完了！
            </h1>
            <p className="text-lg text-gray-600">
              動画が正常にアップロードされました
            </p>
          </div>

          {/* 動画情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="w-5 h-5" />
                動画情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">タイトル</h4>
                  <p className="text-sm">{videoInfo.title}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">動画ID</h4>
                  <p className="text-sm font-mono">{videoInfo.videoId}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">アップロード日時</h4>
                  <p className="text-sm">{formatDate(videoInfo.createdAt)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-1">公開設定</h4>
                  <Badge variant="secondary">
                    {videoInfo.visibility === 'PUBLIC' ? '学外公開' : 
                     videoInfo.visibility === 'PRIVATE' ? '学内限定' : '非公開'}
                  </Badge>
                </div>
                {videoInfo.fileSize && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">ファイルサイズ</h4>
                    <p className="text-sm">{formatFileSize(videoInfo.fileSize)}</p>
                  </div>
                )}
                {videoInfo.duration > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-1">再生時間</h4>
                    <p className="text-sm">{formatDuration(videoInfo.duration)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* GPU変換ステータス（ファイルアップロードの場合のみ表示） */}
          {videoInfo?.uploadType === 'FILE' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  GPU変換ステータス
                </CardTitle>
                <CardDescription>
                  AV1形式への変換進捗を表示します
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
              {transcodeJob ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(transcodeJob.status)}
                      <span className="font-medium">変換状況</span>
                      {isPolling && (transcodeJob.status === 'PROCESSING' || transcodeJob.status === 'PENDING') && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-xs text-blue-600">更新中</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(transcodeJob.status)}>
                        {getStatusText(transcodeJob.status)}
                      </Badge>
                      {(transcodeJob.status === 'PROCESSING' || transcodeJob.status === 'PENDING') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/transcode/job/${transcodeJob.jobId}`, {
                                credentials: 'include'
                              });
                              if (response.ok) {
                                const result = await response.json();
                                if (result.success) {
                                  setTranscodeJob(result.data);
                                }
                              }
                            } catch (error) {
                              // エラーは無視
                            }
                          }}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          手動更新
                        </Button>
                      )}
                    </div>
                  </div>

                  {(transcodeJob.status === 'PROCESSING' || transcodeJob.status === 'PENDING') && (
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>変換進捗</span>
                        <span>{Math.floor(transcodeJob.progress)}%</span>
                      </div>
                      <Progress value={transcodeJob.progress} className="h-2" />
                      
                      {/* 推定残り時間の表示 */}
                      {transcodeJob.estimatedTimeRemaining && transcodeJob.estimatedTimeRemaining > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>推定残り時間: {formatTime(transcodeJob.estimatedTimeRemaining)}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-3">
                        <p className="text-xs text-gray-500">
                          自動更新中（10秒間隔）
                        </p>
                      </div>
                      
                      {/* 長時間変換中の場合の注意事項 */}
                      {transcodeJob.progress > 0 && transcodeJob.progress < 100 && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-800">変換が進行中です</span>
                          </div>
                          <p className="text-xs text-yellow-700">
                            変換には動画の長さや品質によって時間がかかります。
                            しばらくお待ちください。
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {transcodeJob.status === 'COMPLETED' && (
                    <>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-green-800">変換完了</span>
                        </div>
                        <p className="text-sm text-green-700">
                          AV1形式への変換が完了しました。高品質で圧縮された動画が利用可能です。
                        </p>
                      </div>

                      {/* 変換詳細情報 */}
                      {(transcodeJob.inputSizeMB || transcodeJob.outputSizeMB || transcodeJob.compressionRate || transcodeJob.processingTime) && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            変換詳細
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {transcodeJob.inputSizeMB && (
                              <div>
                                <span className="text-blue-700">入力サイズ:</span>
                                <span className="ml-2 font-medium">{transcodeJob.inputSizeMB.toFixed(1)} MB</span>
                              </div>
                            )}
                            {transcodeJob.outputSizeMB && (
                              <div>
                                <span className="text-blue-700">出力サイズ:</span>
                                <span className="ml-2 font-medium">{transcodeJob.outputSizeMB.toFixed(1)} MB</span>
                              </div>
                            )}
                            {transcodeJob.compressionRate && (
                              <div>
                                <span className="text-blue-700">圧縮率:</span>
                                <span className="ml-2 font-medium">{transcodeJob.compressionRate.toFixed(1)}%</span>
                              </div>
                            )}
                            {transcodeJob.processingTime && (
                              <div>
                                <span className="text-blue-700">処理時間:</span>
                                <span className="ml-2 font-medium">{transcodeJob.processingTime.toFixed(1)}秒</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* プリセット詳細 */}
                      {(transcodeJob.presetDetails || transcodeJob.preset) && (
                        <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                          <h4 className="font-medium text-purple-800 mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            変換設定
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-purple-700">プリセット:</span>
                              <span className="ml-2 font-medium">
                                {transcodeJob.presetDetails?.description || `${transcodeJob.preset} プリセット`}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-700">解像度:</span>
                              <span className="ml-2 font-medium">
                                {transcodeJob.presetDetails?.resolution || '1920x1080'}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-700">ビデオコーデック:</span>
                              <span className="ml-2 font-medium">
                                {transcodeJob.presetDetails?.videoCodec || 'av1_nvenc'}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-700">オーディオコーデック:</span>
                              <span className="ml-2 font-medium">
                                {transcodeJob.presetDetails?.audioCodec || 'aac'}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-700">ビットレート:</span>
                              <span className="ml-2 font-medium">
                                {transcodeJob.presetDetails?.bitrate || '5000 kbps'}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-700">フレームレート:</span>
                              <span className="ml-2 font-medium">
                                {transcodeJob.presetDetails?.fps || 30} fps
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* メタデータ詳細 */}
                      {transcodeJob.videoMetadata && (
                        <div className="mt-4 space-y-4">
                          {/* ビデオメタデータ */}
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              ビデオ情報
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600">解像度:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.video.resolution}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">ビットレート:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.video.bitrate}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">フレームレート:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.video.frameRate}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">コーデック:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.video.codec}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">ピクセルフォーマット:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.video.pixelFormat}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">アスペクト比:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.video.aspectRatio}</span>
                              </div>
                            </div>
                          </div>

                          {/* オーディオメタデータ */}
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                              <Volume2 className="w-4 h-4" />
                              オーディオ情報
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600">コーデック:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.audio.codec}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">ビットレート:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.audio.bitrate}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">サンプルレート:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.audio.sampleRate}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">チャンネル数:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.audio.channels}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">チャンネルレイアウト:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.audio.channelLayout}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">サンプルフォーマット:</span>
                                <span className="ml-2 font-medium">{transcodeJob.videoMetadata.audio.sampleFormat}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {transcodeJob.status === 'FAILED' && (
                    <>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span className="font-medium text-red-800">変換失敗</span>
                        </div>
                        <p className="text-sm text-red-700 mb-3">
                          変換処理中にエラーが発生しました。元の動画は正常にアップロードされています。
                        </p>
                        
                        {/* デバッグ情報を表示 */}
                        <div className="mt-3 p-3 bg-gray-50 rounded border">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">デバッグ情報</h5>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>ジョブID: {transcodeJob.jobId}</div>
                            <div>入力ファイル: {transcodeJob.inputFile}</div>
                            <div>出力ファイル: {transcodeJob.outputFile || '未設定'}</div>
                            <div>プリセット: {transcodeJob.preset}</div>
                            <div>エラーメッセージ: {transcodeJob.errorMessage || '不明'}</div>
                            {transcodeJob.errorDetails && (
                              <>
                                <div>詳細エラー: {transcodeJob.errorDetails.message}</div>
                                <div>HTTPステータス: {transcodeJob.errorDetails.status}</div>
                                <div>ジョブ未発見: {transcodeJob.errorDetails.isJobNotFound ? 'はい' : 'いいえ'}</div>
                              </>
                            )}
                            {transcodeJob.gpuJobStatus && (
                              <>
                                <div>GPU状態: {JSON.stringify(transcodeJob.gpuJobStatus.state)}</div>
                                {(transcodeJob.gpuJobStatus as any).returnvalue && (
                                  <div>GPU詳細: {JSON.stringify((transcodeJob.gpuJobStatus as any).returnvalue)}</div>
                                )}
                              </>
                            )}
                            {/* エラー詳細の解析結果を表示 */}
                            {transcodeJob.errorDetails && typeof transcodeJob.errorDetails === 'string' && (
                              <div className="mt-2 p-2 bg-red-50 rounded border">
                                <div className="font-medium text-red-700 mb-1">詳細エラー情報:</div>
                                <pre className="text-xs text-red-600 whitespace-pre-wrap">
                                  {transcodeJob.errorDetails}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 解決策の提案 */}
                        {transcodeJob.errorDetails?.isJobNotFound && (
                          <div className="mt-3 p-3 bg-blue-50 rounded border">
                            <h5 className="text-xs font-medium text-blue-700 mb-2">解決策</h5>
                            <p className="text-xs text-blue-600">
                              アップロード時にGPU変換が失敗したため、元の動画ファイルで配信されます。
                              動画は正常にアップロードされており、視聴可能です。
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">変換ジョブ情報が見つかりません</p>
                  <p className="text-sm text-gray-400 mt-2">
                    元の動画は正常にアップロードされています
                  </p>
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium text-yellow-800">変換状況</span>
                    </div>
                    <p className="text-sm text-yellow-700">
                      GPU変換サーバーとの接続に問題がある可能性があります。
                      元の動画は正常に視聴可能です。
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* アクションボタン */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => router.push(`/watch/${videoInfo.videoId}`)}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              再生ページへ
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => router.push('/upload')}
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              追加アップロード
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              投稿一覧へ
            </Button>
          </div>

          {/* 注意事項（ファイルアップロードの場合のみ表示） */}
          {videoInfo?.uploadType === 'FILE' && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <strong>注意事項:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• 変換処理はバックグラウンドで実行されます</li>
                  <li>• 変換完了までしばらくお待ちください</li>
                  <li>• 元の動画は既に視聴可能です</li>
                  <li>• サムネイル画像は自動生成されます</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </MainLayout>
  );
} 