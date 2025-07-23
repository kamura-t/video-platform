'use client';

import React from 'react';
import { ScheduledVideosList } from '@/components/admin/scheduled-videos-list';

export default function ScheduledVideosPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <ScheduledVideosList />
    </div>
  );
}