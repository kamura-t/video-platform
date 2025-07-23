'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface FavoriteStatus {
  [videoId: string]: boolean;
}

export const useFavorites = () => {
  const [favoriteStatuses, setFavoriteStatuses] = useState<FavoriteStatus>({});
  const [isLoading, setIsLoading] = useState(false);

  const checkFavoriteStatus = useCallback(async (videoIds: (number | string)[]) => {
    console.log('useFavorites checkFavoriteStatus - videoIds:', videoIds);
    try {
      const requestBody = { videoIds };
      console.log('useFavorites checkFavoriteStatus - request body:', requestBody);
      
      const response = await fetch('/api/user/favorites/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFavoriteStatuses(prev => ({ ...prev, ...data.data }));
        }
      }
    } catch (error) {
      console.error('お気に入り状態の確認に失敗しました:', error);
    }
  }, []);

  const addToFavorites = useCallback(async (videoId: number | string) => {
    console.log('useFavorites addToFavorites - videoId:', videoId, 'type:', typeof videoId);
    setIsLoading(true);
    try {
      const requestBody = { videoId };
      console.log('useFavorites addToFavorites - request body:', requestBody);
      
      const response = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setFavoriteStatuses(prev => ({ ...prev, [videoId]: true }));
        toast.success(data.data.message);
        return true;
      } else {
        if (response.status === 409) {
          // 既にお気に入りに追加されている場合
          setFavoriteStatuses(prev => ({ ...prev, [videoId]: true }));
        }
        toast.error(data.message || 'お気に入りの追加に失敗しました');
        return false;
      }
    } catch (error) {
      console.error('お気に入り追加エラー:', error);
      toast.error('お気に入りの追加に失敗しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeFromFavorites = useCallback(async (videoId: number | string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/user/favorites/${videoId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setFavoriteStatuses(prev => ({ ...prev, [videoId]: false }));
        toast.success(data.data.message);
        return true;
      } else {
        toast.error(data.message || 'お気に入りの削除に失敗しました');
        return false;
      }
    } catch (error) {
      console.error('お気に入り削除エラー:', error);
      toast.error('お気に入りの削除に失敗しました');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback(async (videoId: number | string) => {
    const isFavorited = favoriteStatuses[videoId];
    
    if (isFavorited) {
      return await removeFromFavorites(videoId);
    } else {
      return await addToFavorites(videoId);
    }
  }, [favoriteStatuses, addToFavorites, removeFromFavorites]);

  const isFavorited = useCallback((videoId: number | string) => {
    return Boolean(favoriteStatuses[videoId]);
  }, [favoriteStatuses]);

  return {
    favoriteStatuses,
    isLoading,
    checkFavoriteStatus,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorited,
  };
};