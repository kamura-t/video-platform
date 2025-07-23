'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye, Clock } from 'lucide-react';
import { formatVideoDate } from '@/lib/utils';

interface RecommendedVideo {
  id: string
  postId?: string
  title: string
  thumbnailUrl: string
  duration: number
  viewCount: number
  uploadedAt: string | null
  createdAt?: string | null
  author: {
    id: string
    name: string
    avatar: string
  }
  posts?: {
    postId: string
    title: string
    visibility: string
  }[]
}

interface RecommendationSectionProps {
  currentVideoId?: string
  className?: string
}

export function RecommendationSection({ currentVideoId, className }: RecommendationSectionProps) {
  const [videos, setVideos] = useState<RecommendedVideo[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchRecommendedVideos = async () => {
      try {
        const response = await fetch('/api/videos?limit=10&random=true')
        const result = await response.json()
        
        if (result.success) {
          // 現在の動画を除外
          const filteredVideos = result.data.videos.filter((video: RecommendedVideo) => 
            video.id !== currentVideoId
          ).slice(0, 8) // 最大8本表示
          
          setVideos(filteredVideos)
        }
      } catch (error) {
        console.error('Failed to fetch recommended videos:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendedVideos()
  }, [currentVideoId])

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
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

  if (loading) {
    return (
      <div className={`w-full ${className}`} style={{ width: '424px', minWidth: '360px', maxWidth: '480px' }}>
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-40 h-24 bg-muted rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`} style={{ width: '424px', minWidth: '360px', maxWidth: '480px' }}>
      <div className="space-y-0">
        {videos.map((video) => (
          <div
            key={video.id}
            className="flex gap-3 p-1 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
            onClick={() => router.push(`/watch/${video.posts?.[0]?.postId || video.postId || video.id}`)}
          >
            {/* サムネイル */}
            <div className="relative w-40 h-24 flex-shrink-0 rounded overflow-hidden">
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src.includes('maxresdefault.jpg')) {
                    const videoId = video.thumbnailUrl.match(/\/vi\/([^\/]+)\//)?.[1];
                    if (videoId) {
                      target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                    }
                  } else if (target.src.includes('hqdefault.jpg')) {
                    const videoId = video.thumbnailUrl.match(/\/vi\/([^\/]+)\//)?.[1];
                    if (videoId) {
                      target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                    }
                  } else {
                    target.src = '/api/placeholder/160/90';
                  }
                }}
              />
              {/* 再生時間 */}
              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                <div className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{formatDuration(video.duration)}</span>
                </div>
              </div>
            </div>
            
            {/* 動画情報 */}
            <div className="flex-1 min-w-0 pr-4">
              <h4 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
                {video.title}
              </h4>
              <p className="text-xs text-muted-foreground mb-1">
                {video.author.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  <span>{formatViewCount(video.viewCount)}回視聴</span>
                </div>
                <span>•</span>
                <span>{formatVideoDate(video.uploadedAt || video.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}