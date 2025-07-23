import { Video } from '@/types/video';

export interface RecommendationSection {
  id: string;
  title: string;
  description: string;
  videos: Video[];
  icon: string;
  viewMoreLink?: string;
}

export interface TrendingVideo extends Video {
  trendingScore: number;
  weeklyViews: number;
  growthRate: number;
}

export interface HighlyRatedVideo extends Video {
  completionRate: number;
  averageWatchTime: number;
  engagementScore: number;
}

// Calculate trending score based on recent activity
export const calculateTrendingScore = (video: Video): number => {
  const now = new Date();
  
  if (!video.createdAt) {
    return 0; // createdAtが未定義の場合は0を返す
  }
  
  const createdAtDate = typeof video.createdAt === 'string' ? new Date(video.createdAt) : video.createdAt;
  const daysSinceCreated = (now.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Simulate weekly views (in production, this would come from analytics)
  const weeklyViews = Math.floor(video.viewCount * 0.3 * Math.random());
  const growthRate = weeklyViews / Math.max(video.viewCount - weeklyViews, 1);
  
  // Trending score considers recency, growth rate, and absolute views
  const recencyBoost = Math.max(0, 30 - daysSinceCreated) / 30;
  const popularityScore = Math.log(video.viewCount + 1) / 10;
  const growthScore = Math.min(growthRate * 10, 5);
  
  return (recencyBoost * 0.4 + popularityScore * 0.3 + growthScore * 0.3) * 100;
};

// Calculate completion rate and engagement metrics
export const calculateEngagementMetrics = (video: Video): HighlyRatedVideo => {
  // Simulate engagement metrics (in production, this would come from analytics)
  const likeCount = Math.floor(video.viewCount * 0.1 * Math.random()); // Simulate like count based on view count
  const completionRate = Math.min(0.95, 0.3 + (likeCount / video.viewCount) * 2 + Math.random() * 0.4);
  const averageWatchTime = (video.duration || 0) * completionRate;
  
  // Engagement score considers likes, completion rate, and watch time
  const likeRatio = likeCount / Math.max(video.viewCount, 1);
  const durationScore = Math.min((video.duration || 0) / 1800, 1); // Normalize to 30 minutes
  const engagementScore = (likeRatio * 0.4 + completionRate * 0.4 + durationScore * 0.2) * 100;
  
  return {
    ...video,
    completionRate,
    averageWatchTime,
    engagementScore,
  };
};

// Get popular videos sorted by view count
export const getPopularVideos = async (videos: Video[], limit: number = 8): Promise<Video[]> => {
  return videos
    .filter(video => video.publishedAt)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, limit);
};

// Get latest videos sorted by publish date
export const getLatestVideos = async (videos: Video[], limit: number = 8): Promise<Video[]> => {
  return videos
    .filter(video => video.publishedAt)
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);
};

// Get trending videos based on recent activity
export const getTrendingVideos = async (videos: Video[], limit: number = 8): Promise<TrendingVideo[]> => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const trendingVideos = videos
    .filter(video => video.status === 'READY' && new Date(video.createdAt) >= sevenDaysAgo)
    .map(video => {
      const trendingScore = calculateTrendingScore(video);
      const weeklyViews = Math.floor(video.viewCount * 0.3 * Math.random());
      const growthRate = weeklyViews / Math.max(video.viewCount - weeklyViews, 1);
      
      return {
        ...video,
        trendingScore,
        weeklyViews,
        growthRate,
      };
    })
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
  
  return trendingVideos;
};

// Get highly rated videos based on engagement metrics
export const getHighlyRatedVideos = async (videos: Video[], limit: number = 8): Promise<HighlyRatedVideo[]> => {
  const ratedVideos = videos
    .filter(video => video.status === 'READY')
    .map(video => calculateEngagementMetrics(video))
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, limit);
  
  return ratedVideos;
};

// Get personalized recommendations based on user preferences
export const getPersonalizedRecommendations = async (
  videos: Video[], 
  userPreferences?: {
    favoriteCategories?: string[];
    favoriteTags?: string[];
    viewHistory?: string[];
  },
  limit: number = 8
): Promise<Video[]> => {
  if (!userPreferences) {
    // Fallback to popular videos if no preferences
    return getPopularVideos(videos, limit);
  }
  
  const { favoriteCategories = [], favoriteTags = [], viewHistory = [] } = userPreferences;
  
  const scoredVideos = videos
    .filter(video => video.status === 'READY' && !viewHistory.includes(video.id.toString()))
    .map(video => {
      let score = 0;
      
      // Category preference boost
      const matchingCategories = video.categories.filter(cat => favoriteCategories.includes(cat.name));
      score += matchingCategories.length * 30;
      
      // Tag preference boost
      const matchingTags = video.tags.filter(tag => favoriteTags.includes(tag.name));
      score += matchingTags.length * 10;
      
      // Popularity boost
      score += Math.log(video.viewCount + 1) * 2;
      
      // Recency boost
      const daysSinceCreated = (Date.now() - new Date(video.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 30 - daysSinceCreated) * 0.5;
      
      // View count boost (using viewCount as proxy for engagement)
      const engagementRatio = video.viewCount / Math.max(video.viewCount, 1);
      score += engagementRatio * 20;
      
      return { ...video, recommendationScore: score };
    })
    .sort((a, b) => (b as any).recommendationScore - (a as any).recommendationScore)
    .slice(0, limit);
  
  return scoredVideos;
};

// Get all recommendation sections for homepage
export const getAllRecommendationSections = async (
  videos: Video[],
  userPreferences?: any
): Promise<RecommendationSection[]> => {
  const [popular, latest, trending, highlyRated, personalized] = await Promise.all([
    getPopularVideos(videos, 8),
    getLatestVideos(videos, 8),
    getTrendingVideos(videos, 8),
    getHighlyRatedVideos(videos, 8),
    getPersonalizedRecommendations(videos, userPreferences, 8),
  ]);
  
  const sections: RecommendationSection[] = [
    {
      id: 'personalized',
      title: 'あなたにおすすめ',
      description: '視聴履歴と好みに基づいた推薦動画',
      videos: personalized,
      icon: 'Sparkles',
      viewMoreLink: '/?sortBy=personalized',
    },
    {
      id: 'trending',
      title: 'トレンド',
      description: '今週注目を集めている動画',
      videos: trending,
      icon: 'TrendingUp',
      viewMoreLink: '/?sortBy=trending',
    },
    {
      id: 'popular',
      title: '人気の動画',
      description: '最も視聴されている動画',
      videos: popular,
      icon: 'Eye',
      viewMoreLink: '/?sortBy=popular',
    },
    {
      id: 'latest',
      title: '最新動画',
      description: '最近アップロードされた動画',
      videos: latest,
      icon: 'Clock',
      viewMoreLink: '/?sortBy=latest',
    },
    {
      id: 'highly-rated',
      title: '高評価動画',
      description: '視聴完了率と評価が高い動画',
      videos: highlyRated,
      icon: 'Star',
      viewMoreLink: '/?sortBy=liked',
    },
  ];
  
  // Filter out empty sections
  return sections.filter(section => section.videos.length > 0);
};

// Get videos by category
export const getVideosByCategory = async (
  videos: Video[], 
  category: string, 
  limit?: number
): Promise<Video[]> => {
  const categoryVideos = videos.filter(video => 
    video.status === 'READY' && 
    video.categories.some(cat => cat.slug === category)
  );
  
  return limit ? categoryVideos.slice(0, limit) : categoryVideos;
};

// Get related videos based on categories and tags
export const getRelatedVideos = async (
  videos: Video[], 
  currentVideo: Video, 
  limit: number = 6
): Promise<Video[]> => {
  const relatedVideos = videos
    .filter(video => 
      video.id !== currentVideo.id &&
      video.status === 'READY' &&
      video.uploader.id !== currentVideo.uploader.id
    )
    .map(video => {
      let score = 0;
      
      // Category similarity
      const sharedCategories = video.categories.filter(cat => 
        currentVideo.categories.some(currentCat => currentCat.id === cat.id)
      );
      score += sharedCategories.length * 30;
      
      // Tag similarity
      const sharedTags = video.tags.filter(tag => 
        currentVideo.tags.some(currentTag => currentTag.id === tag.id)
      );
      score += sharedTags.length * 20;
      
      // Popularity boost
      score += Math.log(video.viewCount + 1) * 2;
      
      return { ...video, similarityScore: score };
    })
    .sort((a, b) => (b as any).similarityScore - (a as any).similarityScore)
    .slice(0, limit);
  
  return relatedVideos;
};