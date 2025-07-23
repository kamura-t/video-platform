'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SiteSettings {
  siteTitle: string;
  siteLogoIcon: string;
  siteLogoImage: string;
  siteDescription?: string;
  maxFileSizeMb?: number;
  allowedFileTypes?: string;
  videosPerPage?: number;
  newBadgeDisplayDays?: number;
}

interface SettingsContextType {
  settings: SiteSettings;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: React.ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>({
    siteTitle: 'VideoShare',
    siteLogoIcon: 'Video',
    siteLogoImage: '',
    siteDescription: '組織内でビデオコンテンツを安全に共有・管理するプラットフォーム',
    maxFileSizeMb: 5120,
    allowedFileTypes: 'mp4,mov,avi,mkv,wmv,flv,webm',
    videosPerPage: 20,
    newBadgeDisplayDays: 7,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/settings/public');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setSettings({
            siteTitle: data.data.site_title || 'VideoShare',
            siteLogoIcon: data.data.site_logo_icon || 'Video',
            siteLogoImage: data.data.site_logo_image || '',
            siteDescription: data.data.site_description || '組織内でビデオコンテンツを安全に共有・管理するプラットフォーム',
            maxFileSizeMb: parseInt(data.data.max_file_size_mb) || 5120,
            allowedFileTypes: data.data.allowed_file_types || 'mp4,mov,avi,mkv,wmv,flv,webm',
            videosPerPage: parseInt(data.data.videos_per_page) || 20,
            newBadgeDisplayDays: parseInt(data.data.new_badge_display_days) || 7,
          });
        }
      } else {
        setError('サイト設定の取得に失敗しました');
      }
    } catch (error) {
      console.error('Failed to fetch site settings:', error);
      setError('サイト設定の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const value: SettingsContextType = {
    settings,
    isLoading,
    error,
    refetch: fetchSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}; 