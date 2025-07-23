'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
}

interface CategoriesContextType {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

export const useCategories = () => {
  const context = useContext(CategoriesContext);
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoriesProvider');
  }
  return context;
};

interface CategoriesProviderProps {
  children: React.ReactNode;
}

export const CategoriesProvider: React.FC<CategoriesProviderProps> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Filter out any categories named 'すべて' or 'all' to avoid duplicates
          const filteredCategories = data.data.filter((cat: any) => 
            cat.name !== 'すべて' && cat.name !== 'all' && cat.slug !== 'all'
          );
          
          const allCategories: Category[] = [
            { id: 0, name: 'すべて', slug: 'all', color: '#6B7280' },
            ...filteredCategories.map((cat: any) => ({
              id: cat.id,
              name: cat.name,
              slug: cat.slug,
              color: cat.color
            }))
          ];
          setCategories(allCategories);
        } else {
          setError('カテゴリの取得に失敗しました');
          // Set default categories to prevent loading issues
          setCategories([{ id: 0, name: 'すべて', slug: 'all', color: '#6B7280' }]);
        }
      } else {
        setError('カテゴリの取得に失敗しました');
        // Set default categories to prevent loading issues
        setCategories([{ id: 0, name: 'すべて', slug: 'all', color: '#6B7280' }]);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setError('カテゴリの取得に失敗しました');
      // Set default categories to prevent loading issues
      setCategories([{ id: 0, name: 'すべて', slug: 'all', color: '#6B7280' }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const value: CategoriesContextType = {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
  };

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}; 