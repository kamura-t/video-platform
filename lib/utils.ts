import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 動画の投稿日時をフォーマットする関数
export function formatVideoDate(date: Date | string | null | undefined): string {
  // null, undefined, 空文字の場合はデフォルト値を返す
  if (!date) {
    return '日付不明'
  }
  
  const targetDate = typeof date === 'string' ? new Date(date) : date
  
  // 無効な日付の場合はデフォルト値を返す
  if (isNaN(targetDate.getTime())) {
    return '日付不明'
  }
  
  const now = new Date()
  const diffInDays = Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
  
  // 30日以内は相対表示
  if (diffInDays <= 30) {
    return formatDistanceToNow(targetDate, { 
      addSuffix: true, 
      locale: ja 
    })
  }
  
  // それ以前は絶対表示（YYYY/MM/DD形式）
  return targetDate.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 動画の長さをフォーマットする関数
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 視聴回数をフォーマットする関数
export function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// プレイリスト関連のデータ変換ヘルパー関数
export function transformPlaylistForResponse(playlist: any) {
  return {
    id: playlist.playlistId,
    title: playlist.title,
    description: playlist.description,
    thumbnail: playlist.thumbnailUrl || playlist.videos[0]?.video.thumbnailUrl || '/images/default-thumbnail.jpg',
    videoCount: playlist.videoCount,
    totalDuration: playlist.totalDuration,
    creator: {
      id: playlist.creator.id.toString(),
      name: playlist.creator.displayName,
      username: playlist.creator.username,
      avatar: playlist.creator.profileImageUrl,
      department: playlist.creator.department
    },
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt
  }
}

// 動画データの変換ヘルパー関数
export function transformVideoForResponse(video: any) {
  return {
    id: video.videoId,
    title: video.title,
    description: video.description,
    thumbnail: video.thumbnailUrl || '/images/default-thumbnail.jpg',
    duration: video.duration,
    viewCount: video.viewCount,
    uploadType: video.uploadType,
    youtubeUrl: video.youtubeUrl,
    author: {
      id: video.uploader.id.toString(),
      name: video.uploader.displayName,
      username: video.uploader.username,
      avatar: video.uploader.profileImageUrl
    },
    categories: video.categories?.map((vc: any) => ({
      id: vc.category.id.toString(),
      name: vc.category.name,
      slug: vc.category.slug,
      color: vc.category.color
    })) || [],
    tags: video.tags?.map((vt: any) => ({
      id: vt.tag.id.toString(),
      name: vt.tag.name
    })) || [],
    uploadedAt: video.createdAt
  }
}
