import { Video, VideoCategory } from '@/types/video';

export const getVideos = async (): Promise<Video[]> => {
  // 実際のAPIエンドポイント /api/videos を使用
  const response = await fetch('/api/videos');
  const data = await response.json();
  return data.success ? data.data.videos : [];
};

export const getVideoById = async (id: string): Promise<Video | null> => {
  // 実際のAPIエンドポイント /api/videos/[id] を使用
  const response = await fetch(`/api/videos/${id}`);
  const data = await response.json();
  return data.success ? data.data : null;
};

export const getLatestVideos = async (limit: number = 6): Promise<Video[]> => {
  // 実際のAPIエンドポイント /api/videos を使用
  const response = await fetch(`/api/videos?sort=latest&limit=${limit}`);
  const data = await response.json();
  return data.success ? data.data.videos : [];
};

export const getPopularVideos = async (limit: number = 6): Promise<Video[]> => {
  // 実際のAPIエンドポイント /api/videos を使用
  const response = await fetch(`/api/videos?sort=popular&limit=${limit}`);
  const data = await response.json();
  return data.success ? data.data.videos : [];
};

export const getVideosByCategory = async (category: string): Promise<Video[]> => {
  // 実際のAPIエンドポイント /api/videos を使用
  const response = await fetch(`/api/videos?category=${category}`);
  const data = await response.json();
  return data.success ? data.data.videos : [];
};

export const getCategories = async (): Promise<VideoCategory[]> => {
  // 実際のAPIエンドポイント /api/categories を使用
  const response = await fetch('/api/categories');
  const data = await response.json();
  return data.success ? data.data.categories : [];
};


export const getAllTags = (videos: Video[]): string[] => {
  const tagSet = new Set<string>();
  videos.forEach(video => {
    video.tags?.forEach(tag => tagSet.add(tag.name));
  });
  return Array.from(tagSet);
};