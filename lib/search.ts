import { Video } from '@/types/video';

export interface SearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  duration?: 'short' | 'medium' | 'long' | 'all';
  sortBy?: 'latest' | 'popular' | 'liked' | 'title' | 'duration' | 'trending' | 'personalized';
}

export const searchVideos = (videos: Video[], options: SearchOptions): Video[] => {
  let filteredVideos = videos;

  // Text search
  if (options.query) {
    const query = options.query.toLowerCase();
    filteredVideos = filteredVideos.filter(video => 
      video.title.toLowerCase().includes(query) ||
      (video.description && video.description.toLowerCase().includes(query)) ||
      video.uploader.displayName.toLowerCase().includes(query) ||
      video.tags.some(tag => tag.name.toLowerCase().includes(query))
    );
  }

  // Category filter
  if (options.category && options.category !== 'all') {
    filteredVideos = filteredVideos.filter(video => 
      video.categories.some(cat => cat.slug === options.category)
    );
  }

  // Tags filter
  if (options.tags && options.tags.length > 0) {
    filteredVideos = filteredVideos.filter(video => 
      options.tags!.some(tag => video.tags.some(videoTag => videoTag.name === tag))
    );
  }

  // Date range filter
  if (options.dateFrom) {
    filteredVideos = filteredVideos.filter(video => 
      new Date(video.createdAt) >= options.dateFrom!
    );
  }

  if (options.dateTo) {
    filteredVideos = filteredVideos.filter(video => 
      new Date(video.createdAt) <= options.dateTo!
    );
  }

  // Duration filter
  if (options.duration && options.duration !== 'all') {
    filteredVideos = filteredVideos.filter(video => {
      const duration = video.duration || 0;
      if (options.duration === 'short') {
        return duration <= 240; // 4 minutes
      } else if (options.duration === 'medium') {
        return duration > 240 && duration <= 1200; // 4-20 minutes
      } else if (options.duration === 'long') {
        return duration > 1200; // 20+ minutes
      }
      return true;
    });
  }

  // Sort results
  if (options.sortBy) {
    filteredVideos = sortVideos(filteredVideos, options.sortBy);
  }

  return filteredVideos;
};

export const sortVideos = (videos: Video[], sortBy: string): Video[] => {
  const sortedVideos = [...videos];

  switch (sortBy) {
    case 'latest':
      return sortedVideos.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'popular':
      return sortedVideos.sort((a, b) => b.viewCount - a.viewCount);
    case 'liked':
      // Sort by view count as proxy for likes
      return sortedVideos.sort((a, b) => b.viewCount - a.viewCount);
    case 'title':
      return sortedVideos.sort((a, b) => a.title.localeCompare(b.title));
    case 'duration':
      return sortedVideos.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    case 'trending':
      // Calculate trending score based on recent views and recency
      return sortedVideos.sort((a, b) => {
        const now = Date.now();
        const aRecency = now - new Date(a.createdAt).getTime();
        const bRecency = now - new Date(b.createdAt).getTime();
        const aTrendingScore = a.viewCount / Math.max(1, aRecency / (1000 * 60 * 60 * 24));
        const bTrendingScore = b.viewCount / Math.max(1, bRecency / (1000 * 60 * 60 * 24));
        return bTrendingScore - aTrendingScore;
      });
    case 'personalized':
      // For now, just return popular videos
      return sortedVideos.sort((a, b) => b.viewCount - a.viewCount);
    default:
      return sortedVideos;
  }
};

export const getAllTags = (videos: Video[]): string[] => {
  const tagSet = new Set<string>();
  videos.forEach(video => {
    video.tags.forEach(tag => tagSet.add(tag.name));
  });
  return Array.from(tagSet).sort();
};

export const getTagsWithCount = (videos: Video[]): Array<{ tag: string; count: number }> => {
  const tagCount = new Map<string, number>();
  
  videos.forEach(video => {
    video.tags.forEach(tag => {
      tagCount.set(tag.name, (tagCount.get(tag.name) || 0) + 1);
    });
  });

  return Array.from(tagCount.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
};

export const getSearchSuggestions = (videos: Video[], query: string): string[] => {
  if (!query.trim()) return [];

  const suggestions = new Set<string>();
  const queryLower = query.toLowerCase();

  videos.forEach(video => {
    // Title suggestions
    if (video.title.toLowerCase().includes(queryLower)) {
      suggestions.add(video.title);
    }

    // Tag suggestions
    video.tags.forEach(tag => {
      if (tag.name.toLowerCase().includes(queryLower)) {
        suggestions.add(tag.name);
      }
    });

    // Author suggestions
    if (video.uploader.displayName.toLowerCase().includes(queryLower)) {
      suggestions.add(video.uploader.displayName);
    }
  });

  return Array.from(suggestions).slice(0, 5);
};

export const highlightSearchTerm = (text: string, searchTerm: string): string => {
  if (!searchTerm.trim()) return text;

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
};