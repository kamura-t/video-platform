'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';

export default function UserRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  useEffect(() => {
    const redirectToUsername = async () => {
      try {
        // ユーザーIDからusernameを取得
        const response = await fetch(`/api/users/${userId}/redirect`);
        const data = await response.json();

        if (data.success && data.username) {
          // @username形式にリダイレクト
          router.replace(`/@${data.username}`);
        } else {
          // ユーザーが見つからない場合はホームにリダイレクト
          router.replace('/');
        }
      } catch (error) {
        console.error('Redirect error:', error);
        router.replace('/');
      }
    };

    if (userId) {
      redirectToUsername();
    }
  }, [userId, router]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">リダイレクト中...</p>
        </div>
      </div>
    </div>
  );
} 