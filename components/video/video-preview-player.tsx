'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Camera, Clock, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';

// Dynamically import ReactPlayer to avoid SSR issues
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

interface VideoPreviewPlayerProps {
  video: {
    videoId: string;
    title: string;
    filePath?: string;
    convertedFilePath?: string;
    youtubeUrl?: string;
    duration?: number;
    uploadType: string;
  };
  onThumbnailGenerated?: (thumbnailUrl: string) => void;
  className?: string;
}

export interface VideoPreviewPlayerRef {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

export const VideoPreviewPlayer = forwardRef<VideoPreviewPlayerRef, VideoPreviewPlayerProps>(
  ({ video, onThumbnailGenerated, className }, ref) => {
    const playerRef = useRef<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [seekTime, setSeekTime] = useState(5);

    // 動画URLの決定
    const getVideoUrl = () => {
      if (video.youtubeUrl) {
        return video.youtubeUrl;
      } else if (video.convertedFilePath) {
        return video.convertedFilePath;
      } else if (video.filePath) {
        return video.filePath;
      }
      return '';
    };

    const videoUrl = getVideoUrl();

    // 外部からのメソッドを公開
    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (playerRef.current && playerRef.current.seekTo) {
          playerRef.current.seekTo(seconds);
          setCurrentTime(seconds);
        }
      },
      getCurrentTime: () => currentTime,
      getDuration: () => duration
    }));

    // 動画準備完了時の処理
    const handleReady = () => {
      if (playerRef.current) {
        const duration = playerRef.current.getDuration();
        setDuration(duration);
      }
    };

    // 動画進捗更新時の処理
    const handleProgress = (progress: { played: number, playedSeconds: number }) => {
      setCurrentTime(progress.playedSeconds);
    };

    // シークバーの値変更時の処理
    const handleSeekChange = (value: number[]) => {
      const newTime = value[0];
      setSeekTime(newTime);
      if (playerRef.current && playerRef.current.seekTo) {
        playerRef.current.seekTo(newTime);
        setCurrentTime(newTime);
      }
    };

    // サムネイル生成
    const generateThumbnail = async () => {
      if (!video.videoId || video.uploadType !== 'FILE') {
        toast.error('ファイルアップロード動画のみサムネイル生成が可能です');
        return;
      }

      setIsGenerating(true);
      try {
        const response = await fetch(`/api/admin/videos/${video.videoId}/generate-thumbnail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            timestamp: Math.round(seekTime)
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'サムネイル生成に失敗しました');
        }

        const result = await response.json();
        
        if (result.success && result.thumbnailUrl) {
          toast.success('サムネイルが生成されました');
          onThumbnailGenerated?.(result.thumbnailUrl);
        } else {
          throw new Error('サムネイル生成に失敗しました');
        }
      } catch (error) {
        console.error('サムネイル生成エラー:', error);
        toast.error(`サムネイル生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      } finally {
        setIsGenerating(false);
      }
    };

    // 時間フォーマット関数
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = Math.floor(seconds % 60);

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // 動画URLが空の場合はエラーメッセージを表示
    if (!videoUrl) {
      return (
        <Card className={className}>
          <CardHeader>
            <CardTitle className="text-lg">動画プレビュー</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-gray-900 flex items-center justify-center rounded">
              <div className="text-center text-white">
                <div className="text-2xl mb-2">❌</div>
                <div className="text-lg font-semibold mb-2">動画が見つかりません</div>
                <div className="text-sm text-gray-300">
                  動画ファイルが存在しないか、アクセスできません
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">動画プレビュー</CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>再生時間: {formatTime(duration)}</span>
            {video.uploadType === 'FILE' && (
              <Badge variant="secondary" className="ml-2">
                ファイルアップロード
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 動画プレイヤー */}
          <div className="aspect-video bg-black rounded overflow-hidden">
            <ReactPlayer
              ref={playerRef}
              url={videoUrl}
              width="100%"
              height="100%"
              controls
              playing={isPlaying}
              onReady={handleReady}
              onProgress={handleProgress}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={{ background: 'black' }}
              config={{
                file: {
                  attributes: {
                    controlsList: 'nodownload',
                    preload: 'metadata',
                    crossOrigin: 'anonymous'
                  },
                  forceVideo: true,
                  forceHLS: false,
                  forceDASH: false
                },
                youtube: {
                  playerVars: {
                    showinfo: 1,
                    controls: 1,
                    modestbranding: 1,
                    rel: 0,
                    iv_load_policy: 3,
                    fs: 1
                  }
                }
              }}
            />
          </div>

          {/* シークバーとサムネイル生成コントロール */}
          {video.uploadType === 'FILE' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>サムネイル生成位置</span>
                  <span className="font-mono">{formatTime(seekTime)}</span>
                </div>
                <Slider
                  value={[seekTime]}
                  onValueChange={handleSeekChange}
                  max={duration || 100}
                  min={0}
                  step={1}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>0:00</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={generateThumbnail}
                  disabled={isGenerating || !video.videoId}
                  className="flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  {isGenerating ? '生成中...' : 'サムネイル生成'}
                </Button>
                <div className="text-xs text-muted-foreground">
                  現在位置からサムネイルを生成します
                </div>
              </div>
            </div>
          )}

          {/* YouTube動画の場合の注意事項 */}
          {video.uploadType === 'YOUTUBE' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-4 h-4" />
                <span className="font-medium">YouTube動画について</span>
              </div>
              <p>
                YouTube動画のサムネイルは自動的に生成されます。
                カスタムサムネイルが必要な場合は、動画ファイルをアップロードしてください。
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
); 