'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { VideoPlayer, VideoPlayerRef } from './video-player'
import { RecommendationSection } from './recommendation-section'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { ArrowLeft, Calendar, Eye, Clock, Play, List, AlertCircle, ThumbsUp, SkipForward, SkipBack, Shuffle, X, Heart } from 'lucide-react'
import { formatVideoDate } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useAuth } from '@/components/providers/auth-provider'
import { useFavorites } from '@/hooks/use-favorites'

interface VideoWatchPageProps {
  post: any // TODO: 適切な型定義を追加
  categories?: any[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  sortBy?: string;
  onSortChange?: (sort: string) => void;
  showMobileFilters?: boolean;
}

// タイムスタンプの形式を解析する関数
const parseTimestamp = (timestamp: string): number | null => {
  // [00:14:38] または [14:38] または [1:23:45] の形式をサポート
  const match = timestamp.match(/\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/)
  if (!match) return null
  
  const hours = match[3] ? parseInt(match[1]) : 0
  const minutes = match[3] ? parseInt(match[2]) : parseInt(match[1])
  const seconds = match[3] ? parseInt(match[3]) : parseInt(match[2])
  
  return hours * 3600 + minutes * 60 + seconds
}

// タイムスタンプを表示用の形式に変換する関数
const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// URL文字列とタイムスタンプをリンクに変換するヘルパー関数
const renderTextWithLinksAndTimestamps = (text: string, onTimestampClick: (seconds: number) => void) => {
  // URLとタイムスタンプの両方を検出する正規表現
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const timestampRegex = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g
  
  // まずURLを一時的な文字列に置換
  const urlPlaceholders: string[] = []
  let textWithPlaceholders = text.replace(urlRegex, (match) => {
    const placeholder = `__URL_${urlPlaceholders.length}__`
    urlPlaceholders.push(match)
    return placeholder
  })
  
  // タイムスタンプを処理
  const timestampPlaceholders: { placeholder: string; seconds: number; original: string }[] = []
  textWithPlaceholders = textWithPlaceholders.replace(timestampRegex, (match) => {
    const seconds = parseTimestamp(match)
    if (seconds !== null) {
      const placeholder = `__TIMESTAMP_${timestampPlaceholders.length}__`
      timestampPlaceholders.push({ placeholder, seconds, original: match })
      return placeholder
    }
    return match
  })
  
  // 全体を分割して処理
  const parts = textWithPlaceholders.split(/(__URL_\d+__|__TIMESTAMP_\d+__)/g)
  
  return parts.map((part, index) => {
    // URLプレースホルダーの処理
    const urlMatch = part.match(/^__URL_(\d+)__$/)
    if (urlMatch) {
      const urlIndex = parseInt(urlMatch[1])
      const url = urlPlaceholders[urlIndex]
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
        >
          {url}
        </a>
      )
    }
    
    // タイムスタンププレースホルダーの処理
    const timestampMatch = part.match(/^__TIMESTAMP_(\d+)__$/)
    if (timestampMatch) {
      const timestampIndex = parseInt(timestampMatch[1])
      const timestampData = timestampPlaceholders[timestampIndex]
      return (
        <button
          key={index}
          onClick={() => onTimestampClick(timestampData.seconds)}
          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-1 py-0.5 rounded transition-colors cursor-pointer font-mono text-sm"
          title={`${formatTimestamp(timestampData.seconds)}にジャンプ`}
        >
          {timestampData.original}
        </button>
      )
    }
    
    return part
  })
}

export function VideoWatchPage({ post }: VideoWatchPageProps) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { isFavorited, toggleFavorite, isLoading: favoritesLoading, checkFavoriteStatus } = useFavorites()
  const [currentVideo, setCurrentVideo] = useState<any>(null)
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [autoPlay, setAutoPlay] = useState(true)
  const videoPlayerRef = useRef<VideoPlayerRef>(null)
  const [videoPlayerHeight, setVideoPlayerHeight] = useState<number>(0)
  const [showPlaylistModal, setShowPlaylistModal] = useState(false)

  // カテゴリ・ソート管理
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('latest');

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setCategories([
            { id: 'all', name: 'すべて', slug: 'all', color: '#6B7280' },
            ...data.data.filter((cat: any) => cat.name !== 'すべて' && cat.name !== 'all' && cat.slug !== 'all')
          ]);
        }
      });
  }, []);

  const handleCategoryChange = (category: string) => setSelectedCategory(category);
  const handleSortChange = (sort: string) => setSortBy(sort);

  useEffect(() => {
    // アクセスエラーがある場合は、エラーを設定
    if (post.accessError) {
      setError(post.accessError)
      return
    }

    if (post.postType === 'VIDEO' && post.video) {
      setCurrentVideo(post.video)
      setCurrentVideoIndex(0)
    } else if (post.postType === 'PLAYLIST' && post.playlist) {
      // プレイリストの最初の動画を設定
      if (post.playlist.videos.length > 0) {
        setCurrentVideo(post.playlist.videos[0].video)
        setCurrentVideoIndex(0)
      }
    }
  }, [post])

  // 動画プレーヤーの高さを監視
  useEffect(() => {
    const updateVideoPlayerHeight = () => {
      const videoPlayer = document.querySelector('.aspect-video')
      if (videoPlayer) {
        const rect = videoPlayer.getBoundingClientRect()
        setVideoPlayerHeight(rect.height)
      }
    }

    // 初期化時とリサイズ時に高さを更新
    updateVideoPlayerHeight()
    window.addEventListener('resize', updateVideoPlayerHeight)
    
    // 動画が変更された時にも高さを更新
    const timer = setTimeout(updateVideoPlayerHeight, 100)

    return () => {
      window.removeEventListener('resize', updateVideoPlayerHeight)
      clearTimeout(timer)
    }
  }, [currentVideo])

  // プレイリストの動画を切り替える関数
  const playVideoAtIndex = (index: number) => {
    if (post.postType === 'PLAYLIST' && post.playlist && post.playlist.videos[index]) {
      setCurrentVideo(post.playlist.videos[index].video)
      setCurrentVideoIndex(index)
    }
  }

  // 次の動画に移動
  const playNextVideo = () => {
    if (post.postType === 'PLAYLIST' && post.playlist) {
      const nextIndex = currentVideoIndex + 1
      if (nextIndex < post.playlist.videos.length) {
        playVideoAtIndex(nextIndex)
      }
    }
  }

  // 前の動画に移動
  const playPreviousVideo = () => {
    if (post.postType === 'PLAYLIST' && post.playlist) {
      const prevIndex = currentVideoIndex - 1
      if (prevIndex >= 0) {
        playVideoAtIndex(prevIndex)
      }
    }
  }

  // 動画終了時の処理
  const handleVideoEnd = () => {
    if (autoPlay && post.postType === 'PLAYLIST') {
      playNextVideo()
    }
  }

  const handleLike = () => {
    setIsLiked(!isLiked)
  }

  const handleFavoriteClick = async () => {
    if (!user) {
      router.push('/login')
      return
    }

    if (currentVideo?.id) {
      await toggleFavorite(currentVideo.id)
    }
  }

  // ユーザーがログインしている場合、お気に入り状態を確認
  useEffect(() => {
    if (user && currentVideo?.id) {
      checkFavoriteStatus([currentVideo.id])
    }
  }, [user, currentVideo?.id, checkFavoriteStatus])

  // タイムスタンプクリック時の処理
  const handleTimestampClick = (seconds: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.seekTo(seconds)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  // 動画のアスペクト比を計算
  const calculateAspectRatio = () => {
    if (!currentVideo || !currentVideo.videoResolution) {
      return 16 / 9; // デフォルトは16:9
    }
    const [width, height] = currentVideo.videoResolution.split('x').map(Number);
    if (width && height) {
      return width / height;
    }
    return 16 / 9; // デフォルトは16:9
  };

  const aspectRatio = calculateAspectRatio();
  const isPortrait = aspectRatio < 1.0; // 縦型動画の判定

  // currentVideoがnullの場合はローディング表示
  if (!currentVideo) {
    return (
      <div className="min-h-screen bg-background">
        <Header 
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          showMobileFilters={true}
        />
        <div className="w-full px-2 py-6">
          <div className="w-full flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-[2_1_0%] min-w-0 w-full">
              <div className="aspect-video w-full rounded-lg bg-gray-900 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-2xl mb-2">⏳</div>
                  <div className="text-lg font-semibold mb-2">動画を読み込み中...</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>
              {error === 'この動画は組織内ネットワークからのみアクセス可能です' 
                ? 'この動画はプライベート設定のため、組織内LAN（ローカルネットワーク）からのみアクセス可能です。' 
                : error}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!currentVideo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">動画が見つかりませんでした。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        showMobileFilters={true}
      />

      {/* PC: 2カラム、モバイル: 1カラム */}
      <div className="w-full px-2 py-6">
        <div className="w-full flex flex-col lg:flex-row gap-4 items-start">
          {/* メインカラム */}
          <div className="flex-[2_1_0%] min-w-0 w-full">
            {/* 動画プレイヤー：縦型動画対応 */}
            {isPortrait ? (
              // 縦型動画の場合：ブラウザ画面に収まるように調整
              <div className="w-full max-h-[80vh] h-[80vh] bg-black rounded-lg overflow-hidden">
                <VideoPlayer 
                  video={currentVideo} 
                  ref={videoPlayerRef} 
                  onVideoEnd={handleVideoEnd} 
                  className="w-full h-full border-none bg-transparent"
                  style={{ border: 'none', background: 'transparent' }}
                />
              </div>
            ) : (
              // 横型動画の場合：従来通りの16:9表示
              <div className="aspect-video w-full rounded-lg bg-black overflow-hidden">
                <VideoPlayer 
                  video={currentVideo} 
                  ref={videoPlayerRef} 
                  onVideoEnd={handleVideoEnd} 
                  className="w-full h-full border-none bg-transparent"
                  style={{ border: 'none', background: 'transparent' }}
                />
              </div>
            )}

            {/* Video Info */}
            <div className="mt-4 space-y-4">
              {/* タイトル */}
              <div>
                <h1 className="text-xl font-bold">{currentVideo.title}</h1>
              </div>

              {/* 投稿者表示、いいね・視聴回数など（モバイルは横並び、PCは従来通り） */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* 投稿者情報 */}
                <div className="flex items-center gap-3 flex-1">
                  <Avatar 
                    className="w-10 h-10 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => router.push(`/@${currentVideo.uploader.username}`)}
                  >
                    <AvatarImage src={currentVideo.uploader.profileImageUrl} />
                    <AvatarFallback>
                      {currentVideo.uploader.displayName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p 
                      className="font-medium cursor-pointer hover:text-primary transition-colors"
                      onClick={() => router.push(`/@${currentVideo.uploader.username}`)}
                    >
                      {currentVideo.uploader.displayName}
                    </p>
                    <p className="text-sm text-muted-foreground">@{currentVideo.uploader.username}</p>
                  </div>
                  {/* モバイル時のみ: いいね・視聴回数・再生時間・投稿日を横並びで表示 */}
                  <div className="flex flex-row flex-wrap items-center gap-2 sm:hidden ml-2">
                    <Button
                      variant={isLiked ? "default" : "outline"}
                      size="sm"
                      onClick={handleLike}
                      className="flex items-center gap-2 w-fit"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      {(currentVideo.likeCount || 0) + (isLiked ? 1 : 0)}
                    </Button>
                    {user && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleFavoriteClick}
                        disabled={favoritesLoading}
                        className="flex items-center gap-2 w-fit hover:bg-red-50 hover:text-red-500"
                      >
                        <Heart 
                          className={`w-4 h-4 ${
                            isFavorited(currentVideo?.id) 
                              ? 'fill-red-500 text-red-500' 
                              : 'text-muted-foreground'
                          } transition-colors`}
                        />
                      </Button>
                    )}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Eye className="w-4 h-4" />
                      <span>{formatViewCount(currentVideo.viewCount)}回視聴</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {formatDuration(currentVideo.duration)}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {formatVideoDate(currentVideo.publishedAt || currentVideo.createdAt)}
                    </div>
                  </div>
                </div>

                {/* PC時のみ: いいね・視聴回数・再生時間・投稿日を従来通り右側に */}
                <div className="hidden sm:flex items-center gap-4">
                  <Button
                    variant={isLiked ? "default" : "outline"}
                    size="sm"
                    onClick={handleLike}
                    className="flex items-center gap-2 w-fit"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    {(currentVideo.likeCount || 0) + (isLiked ? 1 : 0)}
                  </Button>
                  {user && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFavoriteClick}
                      disabled={favoritesLoading}
                      className="flex items-center gap-2 w-fit hover:bg-red-50 hover:text-red-500"
                    >
                      <Heart 
                        className={`w-4 h-4 ${
                          isFavorited(currentVideo?.id) 
                            ? 'fill-red-500 text-red-500' 
                            : 'text-muted-foreground'
                        } transition-colors`}
                      />
                    </Button>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{formatViewCount(currentVideo.viewCount)}回視聴</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(currentVideo.duration)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatVideoDate(currentVideo.publishedAt || currentVideo.createdAt)}
                    </div>
                  </div>
                </div>
              </div>

              {/* カテゴリとタグ */}
              <div className="flex flex-wrap gap-2">
                {currentVideo.categories && currentVideo.categories.length > 0 && (
                  <>
                    {currentVideo.categories.map((categoryItem: any) => (
                      <Badge 
                        key={categoryItem.category.id} 
                        variant="secondary"
                        style={{ backgroundColor: categoryItem.category.color + '20', color: categoryItem.category.color }}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => router.push(`/?category=${categoryItem.category.slug}`)}
                      >
                        <span>{categoryItem.category.name}</span>
                      </Badge>
                    ))}
                  </>
                )}
                {currentVideo.tags && currentVideo.tags.length > 0 && (
                  <>
                    {currentVideo.tags.map((tagItem: any) => (
                      <Badge 
                        key={tagItem.tag.id} 
                        variant="outline"
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => router.push(`/?tag=${tagItem.tag.name}`)}
                      >
                        <span>#{tagItem.tag.name}</span>
                      </Badge>
                    ))}
                  </>
                )}
              </div>

              {/* プレイリスト表示（カテゴリ・タグの下） */}
              {post.postType === 'PLAYLIST' && post.playlist && (
                <div className="block lg:hidden">
                  {/* プレイリスト情報ヘッダー */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <List className="w-4 h-4 text-primary" />
                      <div>
                        <h3 className="text-sm font-medium">{post.playlist.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {currentVideoIndex + 1} / {post.playlist.videos.length} • {post.playlist.creator.displayName}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPlaylistModal(true)}
                      className="text-xs"
                    >
                      全表示
                    </Button>
                  </div>

                  {/* スワイプ可能な動画カード */}
                  <div className="relative">
                    <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      <style jsx>{`
                        div::-webkit-scrollbar {
                          display: none;
                        }
                      `}</style>
                      {post.playlist.videos.map((playlistVideo: any, index: number) => (
                        <div
                          key={playlistVideo.video.id}
                          className={`flex-shrink-0 w-48 rounded-lg border-2 transition-all duration-200 ${
                            index === currentVideoIndex 
                              ? 'border-primary bg-primary/5' 
                              : 'border-transparent hover:border-muted-foreground/20'
                          }`}
                          onClick={() => playVideoAtIndex(index)}
                        >
                          <div className="relative">
                            <img
                              src={playlistVideo.video.thumbnailUrl}
                              alt={playlistVideo.video.title}
                              className="w-full h-24 object-cover rounded-t-lg"
                            />
                            {index === currentVideoIndex && (
                              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center rounded-t-lg">
                                <Play className="w-6 h-6 text-white" />
                              </div>
                            )}
                            <div className="absolute top-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
                              {index + 1}
                            </div>
                          </div>
                          <div className="p-2">
                            <h4 className={`text-xs font-medium line-clamp-2 ${
                              index === currentVideoIndex ? 'text-primary' : ''
                            }`}>
                              {playlistVideo.video.title}
                            </h4>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <span>{formatDuration(playlistVideo.video.duration)}</span>
                              <span>•</span>
                              <span>{playlistVideo.video.uploader.displayName}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* ナビゲーションボタン */}
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={playPreviousVideo}
                        disabled={currentVideoIndex === 0}
                        className="h-8 w-8 p-0"
                      >
                        <SkipBack className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={autoPlay ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoPlay(!autoPlay)}
                        className="text-xs"
                      >
                        {autoPlay ? '自動再生ON' : '自動再生OFF'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={playNextVideo}
                        disabled={currentVideoIndex === post.playlist.videos.length - 1}
                        className="h-8 w-8 p-0"
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 説明文 */}
              {currentVideo.description && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {renderTextWithLinksAndTimestamps(currentVideo.description, handleTimestampClick)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* サイドバー（PCのみ） */}
          <aside className="hidden lg:block flex-[1_1_0%] min-w-[200px] max-w-[400px] w-full sticky top-6 space-y-4">
            {/* プレイリスト情報とコントロール */}
            {post.postType === 'PLAYLIST' && post.playlist && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <List className="w-5 h-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{post.playlist.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {currentVideoIndex + 1} / {post.playlist.videos.length} • {post.playlist.creator.displayName}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={playPreviousVideo}
                        disabled={currentVideoIndex === 0}
                      >
                        <SkipBack className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={playNextVideo}
                        disabled={currentVideoIndex === post.playlist.videos.length - 1}
                      >
                        <SkipForward className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={autoPlay ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAutoPlay(!autoPlay)}
                      >
                        自動再生
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {post.playlist.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {post.playlist.description}
                    </p>
                  )}
                  <div className="space-y-2 overflow-y-auto" style={{ 
                    maxHeight: videoPlayerHeight > 0 
                      ? `calc(100vh - ${videoPlayerHeight + 100}px)` // 動画プレーヤーの高さに合わせて可変
                      : 'calc(100vh - 300px)', // フォールバック
                    minHeight: '200px' // 最小高さを設定
                  }}>
                    {post.playlist.videos.map((playlistVideo: any, index: number) => (
                      <div
                        key={playlistVideo.video.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          index === currentVideoIndex 
                            ? 'bg-primary/10 border border-primary' 
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => playVideoAtIndex(index)}
                      >
                        <div className="relative">
                          <img
                            src={playlistVideo.video.thumbnailUrl}
                            alt={playlistVideo.video.title}
                            className="w-20 h-11 object-cover rounded"
                          />
                          {index === currentVideoIndex && (
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded">
                              <Play className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-muted-foreground">
                              {index + 1}
                            </span>
                            <h4 className={`font-medium truncate ${
                              index === currentVideoIndex ? 'text-primary' : ''
                            }`}>
                              {playlistVideo.video.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{playlistVideo.video.uploader.displayName}</span>
                            <span>•</span>
                            <span>{formatDuration(playlistVideo.video.duration)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* おすすめ動画 */}
            <RecommendationSection currentVideoId={currentVideo?.id} />
          </aside>
        </div>


        {/* モバイルのみ動画下にレコメンド動画 */}
        <div className="block lg:hidden mt-6">
          <RecommendationSection currentVideoId={currentVideo?.id} />
        </div>
      </div>

      {/* プレイリストモーダル（モバイル用） */}
      {showPlaylistModal && post.postType === 'PLAYLIST' && post.playlist && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:hidden">
          <div className="bg-background w-full max-h-[80vh] rounded-t-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold">{post.playlist.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {post.playlist.creator.displayName} • {post.playlist.videos.length}本
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPlaylistModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {post.playlist.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {post.playlist.description}
                </p>
              )}
              
              {post.playlist.videos.map((playlistVideo: any, index: number) => (
                <div
                  key={playlistVideo.video.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    index === currentVideoIndex 
                      ? 'bg-primary/10 border border-primary' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => {
                    playVideoAtIndex(index)
                    setShowPlaylistModal(false)
                  }}
                >
                  <div className="relative">
                    <img
                      src={playlistVideo.video.thumbnailUrl}
                      alt={playlistVideo.video.title}
                      className="w-20 h-11 object-cover rounded"
                    />
                    {index === currentVideoIndex && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center rounded">
                        <Play className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <h4 className={`font-medium truncate ${
                        index === currentVideoIndex ? 'text-primary' : ''
                      }`}>
                        {playlistVideo.video.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{playlistVideo.video.uploader.displayName}</span>
                      <span>•</span>
                      <span>{formatDuration(playlistVideo.video.duration)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 