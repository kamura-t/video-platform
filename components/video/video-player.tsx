'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import dynamic from 'next/dynamic';
import { Video } from '@/types/video';
import { Card } from '@/components/ui/card';

// Dynamically import ReactPlayer to avoid SSR issues
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false });

interface VideoPlayerProps {
  video: Video;
  onVideoEnd?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(function VideoPlayer({ video, onVideoEnd, className, style }, ref) {
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true); // 自動再生のためtrueに変更
  const [volume, setVolume] = useState(0.5); // デフォルトボリューム50%
  
  // ボリューム値の検証関数
  const validateVolume = (value: any): number => {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return Math.max(0, Math.min(1, value)); // 0-1の範囲に制限
    }
    return 0.5; // デフォルト値
  };
  
  // 視聴進捗トラッキング用の状態
  const [hasReported30Percent, setHasReported30Percent] = useState(false);
  const [hasReportedMinutes, setHasReportedMinutes] = useState(false);
  const [watchStartTime, setWatchStartTime] = useState<number | null>(null);
  const [totalWatchTime, setTotalWatchTime] = useState(0);
  const [viewThresholds, setViewThresholds] = useState({ percent: 30, seconds: 180 });

  // 動画のアスペクト比を計算
  const calculateAspectRatio = () => {
    if (video.videoResolution) {
      const [width, height] = video.videoResolution.split('x').map(Number);
      if (width && height) {
        return width / height;
      }
    }
    return 16 / 9; // デフォルトは16:9
  };

  const aspectRatio = calculateAspectRatio();
  const isPortrait = aspectRatio < 1.0; // 縦型動画の判定

  // 視聴回数の閾値設定を取得
  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const response = await fetch('/api/settings/view-thresholds')
        const result = await response.json()
        if (result.success) {
          setViewThresholds(result.data)
        }
      } catch (error) {
        console.warn('視聴回数閾値の取得に失敗:', error)
        // デフォルト値を使用
      }
    }
    
    fetchThresholds()
  }, [])

  // 縦型動画用のスタイルを生成
  const getVideoContainerStyle = () => {
    if (isPortrait) {
      // YouTubeショート風の縦型動画表示
      return {
        maxHeight: '100vh',
        height: '100vh',
        width: 'auto',
        maxWidth: '100%',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      };
    }
    // 横型動画の場合は従来通り
    return {};
  };

  // 外部からのseekToメソッドを公開
  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (playerRef.current && playerRef.current.seekTo) {
        playerRef.current.seekTo(seconds);
        // シークした後に再生を開始
        setIsPlaying(true);
      }
    }
  }));

  // ボリューム設定をlocalStorageから復元
  useEffect(() => {
    try {
      const savedVolume = localStorage.getItem('video-player-volume');
      if (savedVolume) {
        const parsedVolume = parseFloat(savedVolume);
        const validatedVolume = validateVolume(parsedVolume);
        setVolume(validatedVolume);
      } else {
      }
    } catch (error) {
      console.warn('ボリューム設定の読み込みに失敗:', error);
      setVolume(0.5); // デフォルト値にフォールバック
    }
  }, []);

  // ボリューム変更時の処理
  const handleVolumeChange = (newVolume: number) => {
    const validatedVolume = validateVolume(newVolume);
    setVolume(validatedVolume);
    try {
      localStorage.setItem('video-player-volume', validatedVolume.toString());
    } catch (error) {
      console.warn('ボリューム設定の保存に失敗:', error);
    }
  };

  // 自動再生の初期化
  useEffect(() => {
    // コンポーネントがマウントされたときに自動再生を開始
    setIsPlaying(true);
    if (watchStartTime === null) {
      setWatchStartTime(Date.now());
    }
  }, [video.id]); // 動画が変更されたときも再実行

  // 動画URLの決定（ローカルファイルまたはYouTube）
  const getVideoUrl = () => {
    if (video.youtubeUrl) {
      // YouTube URLの場合
      return video.youtubeUrl;
    } else if (video.convertedFilePath) {
      // GPU変換済みファイルが存在する場合は優先的に使用
      return video.convertedFilePath;
    } else if (video.filePath) {
      // 元ファイルを使用（変換中または変換失敗時）
      return video.filePath;
    } else {
      // デフォルトの場合
      return '';
    }
  };

  const videoUrl = getVideoUrl();
  
  // 視聴進捗をAPIに送信
  const reportViewProgress = async (watchDuration: number, completionRate: number) => {
    try {
      // video.videoId を使用（データベースのvideoIdフィールド）
      const videoId = video.videoId || video.id
      if (!videoId) {
        console.error('videoId が見つかりません:', video)
        return
      }
      
      
      const response = await fetch(`/api/videos/${videoId}/view-progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          watchDuration: Math.round(watchDuration),
          completionRate: Math.round(completionRate * 100) / 100
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.data.viewCountUpdated) {
        }
      } else {
        console.error('視聴進捗の報告に失敗:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('視聴進捗の報告に失敗:', error);
    }
  };

  // 動画再生開始時の処理
  const handlePlay = () => {
    setIsPlaying(true);
    if (watchStartTime === null) {
      setWatchStartTime(Date.now());
    }
  };

  // 動画一時停止時の処理
  const handlePause = () => {
    setIsPlaying(false);
    if (watchStartTime !== null) {
      const sessionWatchTime = (Date.now() - watchStartTime) / 1000;
      setTotalWatchTime(prev => prev + sessionWatchTime);
      setWatchStartTime(null);
    }
  };

  // 動画進捗更新時の処理
  const handleProgress = (progress: { played: number, playedSeconds: number }) => {
    const completionRate = progress.played * 100;
    
    // 現在の視聴時間を計算
    let currentWatchTime = totalWatchTime;
    if (watchStartTime !== null) {
      currentWatchTime += (Date.now() - watchStartTime) / 1000;
    }
    
    // システム設定に基づく閾値判定
    const shouldReportPercent = completionRate >= viewThresholds.percent && !hasReported30Percent;
    const shouldReportMinutes = currentWatchTime >= viewThresholds.seconds && !hasReportedMinutes;
    
    if (shouldReportPercent || shouldReportMinutes) {
      if (shouldReportPercent) {
        setHasReported30Percent(true);
      }
      if (shouldReportMinutes) {
        setHasReportedMinutes(true);
      }
      
      // 視聴進捗を報告
      reportViewProgress(currentWatchTime, completionRate);
    }
  };

  // 動画エラー時の処理
  const handleError = (error: any) => {
    // 空のエラーオブジェクトの場合は完全に無視
    if (!error || (typeof error === 'object' && Object.keys(error).length === 0)) {
      // 空のエラーオブジェクトは無視（ログも出力しない）
      return;
    }
    
    // エラーの詳細をログに出力
    const errorInfo = {
      error: error ? {
        type: error.type,
        code: error.code,
        message: error.message,
        details: error.details,
        fatal: error.fatal,
        // 追加のプロパティを確認
        ...error
      } : 'Unknown error',
      videoUrl,
      videoId: video.videoId,
      // エラーオブジェクトの全体を確認
      rawError: error,
      errorKeys: error ? Object.keys(error) : [],
      errorString: error ? error.toString() : 'No error object'
    };
    
    console.error('動画再生エラー:', errorInfo);
    
    // 特定のエラーは無視する（一時的なネットワークエラーなど）
    if (error?.type === 'network' || error?.code === 'NETWORK_ERROR') {
      console.warn('ネットワークエラーが発生しましたが、再生は継続されます');
      return; // エラーを無視
    }
    
    // その他のエラーは警告として扱う
    console.warn('動画再生でエラーが発生しましたが、再生を継続します');
  };

  // 動画準備完了時の処理
  const handleReady = () => {
    
    // HTML5 videoエレメントに直接volumechangeイベントを追加
    if (playerRef.current && playerRef.current.getInternalPlayer) {
      const internalPlayer = playerRef.current.getInternalPlayer();
      if (internalPlayer && internalPlayer.addEventListener) {
        internalPlayer.addEventListener('volumechange', () => {
          const currentVolume = internalPlayer.volume;
          handleVolumeChange(currentVolume);
        });
      }
    }
  };

  // コンポーネントアンマウント時の処理
  useEffect(() => {
    return () => {
      // 最終的な視聴時間を報告
      if (watchStartTime !== null) {
        const sessionWatchTime = (Date.now() - watchStartTime) / 1000;
        const finalWatchTime = totalWatchTime + sessionWatchTime;
        
        if (finalWatchTime >= 10) { // 10秒以上視聴した場合のみ報告
          // playerRef.currentの安全なアクセス
          let finalCompletionRate = 0;
          try {
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && typeof playerRef.current.getDuration === 'function') {
              const currentTime = playerRef.current.getCurrentTime();
              const duration = playerRef.current.getDuration();
              if (duration > 0) {
                finalCompletionRate = (currentTime / duration) * 100;
              }
            }
          } catch (error) {
            console.warn('プレイヤーの時間取得に失敗:', error);
          }
          
          reportViewProgress(finalWatchTime, finalCompletionRate);
        }
      }
    };
  }, [watchStartTime, totalWatchTime]);

  // 動画URLが空の場合はエラーメッセージを表示
  if (!videoUrl) {
    return (
      <div className={className} style={style}>
        <div className="aspect-video w-full h-full bg-gray-900 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-2xl mb-2">❌</div>
            <div className="text-lg font-semibold mb-2">動画が見つかりません</div>
            <div className="text-sm text-gray-300">
              動画ファイルが存在しないか、アクセスできません
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Video ID: {video.videoId}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      {isPortrait ? (
        // 縦型動画の場合：アスペクト比を維持して画面に収める
        <div className="w-full h-full bg-black flex justify-center items-center">
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            width="auto"
            height="100%"
            controls
            playing={isPlaying}
            volume={volume}
            onPlay={handlePlay}
            onPause={handlePause}
            onProgress={handleProgress}
            onEnded={onVideoEnd}
            onError={handleError}
            onReady={handleReady}
            progressInterval={1000}
            style={{ 
              background: 'black',
              aspectRatio: aspectRatio,
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
            config={{
              file: {
                attributes: {
                  controlsList: 'nodownload',
                  preload: 'metadata',
                  crossOrigin: 'anonymous',
                  style: {
                    width: 'auto',
                    height: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain'
                  }
                },
                forceVideo: true,
                forceHLS: false,
                forceDASH: false,
                hlsOptions: {
                  enableWorker: true,
                  debug: false,
                  lowLatencyMode: false
                }
              },
              youtube: {
                playerVars: {
                  showinfo: 1,
                  controls: 1,
                  modestbranding: 1,
                  rel: 0,
                  iv_load_policy: 3,
                  fs: 1,
                  autoplay: 1
                }
              }
            }}
            onBuffer={() => {}}
            onBufferEnd={() => {}}
            onSeek={() => {}}
          />
        </div>
      ) : (
        // 横型動画の場合：従来通りの表示
        <div className="aspect-video w-full h-full">
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            width="100%"
            height="100%"
            controls
            playing={isPlaying}
            volume={volume}
            onPlay={handlePlay}
            onPause={handlePause}
            onProgress={handleProgress}
            onEnded={onVideoEnd}
            onError={handleError}
            onReady={handleReady}
            progressInterval={1000}
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
                forceDASH: false,
                hlsOptions: {
                  enableWorker: true,
                  debug: false,
                  lowLatencyMode: false
                }
              },
              youtube: {
                playerVars: {
                  showinfo: 1,
                  controls: 1,
                  modestbranding: 1,
                  rel: 0,
                  iv_load_policy: 3,
                  fs: 1,
                  autoplay: 1
                }
              }
            }}
            onBuffer={() => {}}
            onBufferEnd={() => {}}
            onSeek={() => {}}
          />
        </div>
      )}
    </div>
  );
});