export interface Video {
  id: number;
  videoId: string;
  title: string;
  description?: string;
  uploadType: 'FILE' | 'YOUTUBE';
  originalFilename?: string;
  filePath?: string;
  convertedFilePath?: string;
  fileSize?: string;
  mimeType?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeViewCount?: number;
  thumbnailUrl?: string;
  thumbnail?: string;
  duration?: number;
  viewCount: number;
  visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT';
  status: 'PROCESSING' | 'READY' | 'ERROR';
  // 予約投稿・非公開
  isScheduled: boolean;
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
  // 動画メタデータ
  videoResolution?: string; // "1920x1080"
  videoCodec?: string;
  videoBitrate?: number;
  videoFrameRate?: number;
  audioCodec?: string;
  audioBitrate?: number;
  audioSampleRate?: number;
  audioChannels?: number;
  convertedFileSize?: string;
  compressionRatio?: number;
  uploader: VideoUser;
  author?: VideoUser; // backward compatibility
  categories: {
    id: number;
    name: string;
    slug: string;
    color: string;
  }[];
  tags: {
    id: number;
    name: string;
  }[];
  posts?: {
    postId: string;
    title: string;
    visibility: string;
    isScheduled: boolean;
    scheduledPublishAt?: string;
    scheduledUnpublishAt?: string;
    createdAt: string;
    updatedAt?: string;
    publishedAt?: string;
  }[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  viewLogs?: number;
}

export interface VideoUser {
  id: number;
  username: string;
  displayName: string;
  name?: string; // backward compatibility
  profileImageUrl?: string;
  avatar?: string; // backward compatibility
  department?: string;
}

export interface VideoCategory {
  id: number;
  name: string;
  slug: string;
  color: string;
  description?: string;
}

export interface VideoTag {
  id: number;
  name: string;
}

export interface VideoStats {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
}

export interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  bio?: string;
  profileImageUrl?: string;
  memberSince: string;
  totalVideos: number;
  totalPlaylists?: number;
  publicPlaylists?: number;
  internalPlaylists?: number;
}

// 予約投稿関連の型定義
export interface ScheduledVideo {
  id: number;
  videoId: string;
  title: string;
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT';
  isScheduled: boolean;
  createdAt: string;
  uploader: VideoUser;
}

export interface ScheduledPost {
  id: number;
  postId: string;
  title: string;
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
  visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT';
  isScheduled: boolean;
  createdAt: string;
  creator: VideoUser;
  video?: {
    id: number;
    title: string;
    videoId: string;
  };
}

export interface UploadFormData {
  title: string;
  description: string;
  categories: string[];
  tags?: string[];
  visibility: 'PUBLIC' | 'PRIVATE' | 'DRAFT';
  youtubeUrl?: string;
  file?: File;
  preset: string;
  scheduleType: 'immediate' | 'scheduled';
  scheduledPublishAt?: string;
  scheduledUnpublishAt?: string;
}