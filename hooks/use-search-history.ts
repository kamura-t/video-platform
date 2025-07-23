'use client';

import { useState, useEffect } from 'react';

const SEARCH_HISTORY_KEY = 'video-search-history';
const MAX_HISTORY_ITEMS = 10;

export const useSearchHistory = () => {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        try {
          setSearchHistory(JSON.parse(stored));
        } catch (error) {
          console.error('Failed to parse search history:', error);
        }
      }
    }
  }, []);

  const addToHistory = (query: string) => {
    if (!query.trim()) return;

    setSearchHistory(prev => {
      const filtered = prev.filter(item => item !== query);
      const newHistory = [query, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      }
      
      return newHistory;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    }
  };

  return {
    searchHistory,
    addToHistory,
    clearHistory,
  };
};