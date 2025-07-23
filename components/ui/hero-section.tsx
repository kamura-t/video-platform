'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoGrid } from '@/components/video/video-grid';
import { Video } from '@/types/video';
import { getLatestVideos, getPopularVideos } from '@/lib/videos';
import { useAuth } from '@/components/providers/auth-provider';
import { Play, TrendingUp, Clock, Users, Video as VideoIcon, Eye } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [latestVideos, setLatestVideos] = useState<Video[]>([]);
  const [popularVideos, setPopularVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadVideos = async () => {
      try {
        const [latest, popular] = await Promise.all([
          getLatestVideos(4),
          getPopularVideos(4),
        ]);
        setLatestVideos(latest);
        setPopularVideos(popular);
      } catch (error) {
        console.error('Failed to load videos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVideos();
  }, []);

  return (
    <div className="space-y-16">
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                VideoShare
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                組織内でビデオコンテンツを安全に共有・管理する
                <br />
                次世代プラットフォーム
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <>
                  <Button asChild size="lg" className="text-lg px-8">
                    <Link href="/videos">
                      <Play className="mr-2 h-5 w-5" />
                      ビデオを見る
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="text-lg px-8">
                    <Link href="/upload">
                      <VideoIcon className="mr-2 h-5 w-5" />
                      アップロード
                    </Link>
                  </Button>
                </>
              ) : (
                <Button size="lg" className="text-lg px-8">
                  <Play className="mr-2 h-5 w-5" />
                  今すぐ始める
                </Button>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto pt-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">1,000+</div>
                <div className="text-sm text-muted-foreground">ビデオコンテンツ</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">50+</div>
                <div className="text-sm text-muted-foreground">アクティブユーザー</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">99.9%</div>
                <div className="text-sm text-muted-foreground">アップタイム</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold">主な機能</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            組織のニーズに合わせて設計された包括的なビデオ管理機能
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <VideoIcon className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>高品質ストリーミング</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                アダプティブビットレートストリーミングで、どのデバイスでも最適な視聴体験を提供
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>ロールベースアクセス</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                管理者、キュレーター、視聴者の3つのロールで、適切なアクセス制御を実現
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>詳細な分析</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                視聴統計、エンゲージメント指標、ユーザー行動の詳細な分析データを提供
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Latest Videos */}
      {isAuthenticated && !isLoading && latestVideos.length > 0 && (
        <section className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">最新のビデオ</h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/videos">すべて見る</Link>
            </Button>
          </div>
          <VideoGrid videos={latestVideos} />
        </section>
      )}

      {/* Popular Videos */}
      {isAuthenticated && !isLoading && popularVideos.length > 0 && (
        <section className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">人気のビデオ</h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/videos">すべて見る</Link>
            </Button>
          </div>
          <VideoGrid videos={popularVideos} />
        </section>
      )}

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="container mx-auto px-4">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">今すぐ始めましょう</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                組織のビデオコンテンツを効率的に管理し、チーム全体で知識を共有しましょう
              </p>
              <Button size="lg">
                <Play className="mr-2 h-5 w-5" />
                無料で始める
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
};