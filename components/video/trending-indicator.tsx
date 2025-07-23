'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Flame, Zap, Star } from 'lucide-react';

interface TrendingIndicatorProps {
  score: number;
  type?: 'trending' | 'hot' | 'rising' | 'popular';
  className?: string;
}

export const TrendingIndicator: React.FC<TrendingIndicatorProps> = ({
  score,
  type = 'trending',
  className = '',
}) => {
  const getIndicatorConfig = () => {
    if (score >= 80) {
      return {
        icon: Flame,
        label: '大人気',
        color: 'bg-red-500/90 text-white',
        animation: 'animate-pulse',
      };
    } else if (score >= 60) {
      return {
        icon: TrendingUp,
        label: '急上昇',
        color: 'bg-orange-500/90 text-white',
        animation: '',
      };
    } else if (score >= 40) {
      return {
        icon: Zap,
        label: '注目',
        color: 'bg-yellow-500/90 text-white',
        animation: '',
      };
    } else if (score >= 20) {
      return {
        icon: Star,
        label: '話題',
        color: 'bg-blue-500/90 text-white',
        animation: '',
      };
    }
    return null;
  };

  const config = getIndicatorConfig();
  
  if (!config) return null;

  const { icon: Icon, label, color, animation } = config;

  return (
    <Badge 
      variant="secondary" 
      className={`${color} border-0 ${animation} ${className}`}
    >
      <Icon className="w-3 h-3 mr-1" />
      <span className="text-xs font-medium">{label}</span>
    </Badge>
  );
};