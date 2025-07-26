import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { VideoWatchPage } from '@/components/video/video-watch-page'
import { checkInternalVideoAccess } from '@/lib/auth-access-control'
import { headers } from 'next/headers'
import React, { useState, useEffect } from 'react';

interface PageProps {
  params: Promise<{
    post_id: string
  }>
}

async function getPost(postId: string) {
  try {
    // まず投稿を取得（公開設定に関係なく）
    const post = await prisma.post.findUnique({
      where: {
        postId: postId,
      },
      include: {
        video: {
          select: {
            id: true,
            videoId: true,
            title: true,
            description: true,
            uploadType: true,
            originalFilename: true,
            filePath: true,
            convertedFilePath: true,
            fileSize: true,
            mimeType: true,
            youtubeUrl: true,
            youtubeVideoId: true,
            youtubeViewCount: true,
            thumbnailUrl: true,
            duration: true,
            viewCount: true,
            visibility: true,
            status: true,
            uploaderId: true,
            createdAt: true,
            updatedAt: true,
            publishedAt: true,
            videoResolution: true,
            videoCodec: true,
            videoBitrate: true,
            videoFrameRate: true,
            audioCodec: true,
            audioBitrate: true,
            audioSampleRate: true,
            audioChannels: true,
            convertedFileSize: true,
            compressionRatio: true,
            uploader: {
              select: {
                id: true,
                username: true,
                displayName: true,
                profileImageUrl: true,
              }
            },
            categories: {
              include: {
                category: true
              }
            },
            tags: {
              include: {
                tag: true
              }
            },
          }
        },
        playlist: {
          include: {
            creator: {
              select: {
                id: true,
                username: true,
                displayName: true,
                profileImageUrl: true,
              }
            },
            videos: {
              include: {
                video: {
                  select: {
                    id: true,
                    videoId: true,
                    title: true,
                    description: true,
                    uploadType: true,
                    originalFilename: true,
                    filePath: true,
                    convertedFilePath: true,
                    fileSize: true,
                    mimeType: true,
                    youtubeUrl: true,
                    youtubeVideoId: true,
                    youtubeViewCount: true,
                    thumbnailUrl: true,
                    duration: true,
                    viewCount: true,
                    visibility: true,
                    status: true,
                    uploaderId: true,
                    createdAt: true,
                    updatedAt: true,
                    publishedAt: true,
                    videoResolution: true,
                    videoCodec: true,
                    videoBitrate: true,
                    videoFrameRate: true,
                    audioCodec: true,
                    audioBitrate: true,
                    audioSampleRate: true,
                    audioChannels: true,
                    convertedFileSize: true,
                    compressionRatio: true,
                    uploader: {
                      select: {
                        id: true,
                        username: true,
                        displayName: true,
                        profileImageUrl: true,
                      }
                    },
                    categories: {
                      include: {
                        category: true
                      }
                    },
                    tags: {
                      include: {
                        tag: true
                      }
                    },
                  }
                }
              },
              orderBy: {
                sortOrder: 'asc'
              }
            }
          }
        }
      }
    })

    if (!post) {
      return null
    }

    // Decimal型フィールドを数値に変換
    if (post.video) {
      if (post.video.videoFrameRate !== null && post.video.videoFrameRate !== undefined) {
        (post.video as any).videoFrameRate = Number(post.video.videoFrameRate)
      }
      if (post.video.compressionRatio !== null && post.video.compressionRatio !== undefined) {
        (post.video as any).compressionRatio = Number(post.video.compressionRatio)
      }
    }

    if (post.playlist?.videos) {
      post.playlist.videos.forEach(playlistVideo => {
        if (playlistVideo.video) {
          if (playlistVideo.video.videoFrameRate !== null && playlistVideo.video.videoFrameRate !== undefined) {
            (playlistVideo.video as any).videoFrameRate = Number(playlistVideo.video.videoFrameRate)
          }
          if (playlistVideo.video.compressionRatio !== null && playlistVideo.video.compressionRatio !== undefined) {
            (playlistVideo.video as any).compressionRatio = Number(playlistVideo.video.compressionRatio)
          }
        }
      })
    }

    if (!post) {
      return null
    }

    // 学内限定動画のアクセス権限チェック情報を返す
    // リダイレクトはコンポーネントレベルで処理する

    // 視聴ログの作成（動画またはプレイリストの場合）
    if (post.postType === 'VIDEO' && post.video) {
      try {
        // セッションIDを生成
        const headersList = await headers()
        const userAgent = headersList.get('user-agent') || ''
        const forwardedFor = headersList.get('x-forwarded-for') || ''
        const realIp = headersList.get('x-real-ip') || ''
        
        const sessionData = `${forwardedFor || realIp || 'unknown'}-${userAgent}`
        const sessionId = Buffer.from(sessionData).toString('base64').substring(0, 64)
        
        // 24時間以内の既存視聴ログをチェック
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const existingViewLog = await prisma.viewLog.findFirst({
          where: {
            videoId: post.video.id,
            sessionId: sessionId,
            viewedAt: {
              gte: twentyFourHoursAgo
            }
          }
        })
        
        // 新規セッションの場合のみ視聴ログを作成
        if (!existingViewLog) {
          await prisma.viewLog.create({
            data: {
              videoId: post.video.id,
              sessionId: sessionId,
              userAgent: userAgent || null,
              watchDuration: null, // 後で更新
              completionRate: null, // 後で更新
              referrer: headersList.get('referer') || null,
              viewedAt: new Date()
            }
          })
          
        }
      } catch (viewLogError) {
        console.error('視聴ログ作成エラー:', viewLogError)
        // 視聴ログ作成に失敗しても動画表示は継続
      }
    } else if (post.postType === 'PLAYLIST' && post.playlist && post.playlist.videos.length > 0) {
      // プレイリストの場合、最初の動画の視聴ログを作成
      try {
        const firstVideo = post.playlist.videos[0].video
        
        // セッションIDを生成
        const headersList = await headers()
        const userAgent = headersList.get('user-agent') || ''
        const forwardedFor = headersList.get('x-forwarded-for') || ''
        const realIp = headersList.get('x-real-ip') || ''
        
        const sessionData = `${forwardedFor || realIp || 'unknown'}-${userAgent}`
        const sessionId = Buffer.from(sessionData).toString('base64').substring(0, 64)
        
        // 24時間以内の既存視聴ログをチェック
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const existingViewLog = await prisma.viewLog.findFirst({
          where: {
            videoId: firstVideo.id,
            sessionId: sessionId,
            viewedAt: {
              gte: twentyFourHoursAgo
            }
          }
        })
        
        // 新規セッションの場合のみ視聴ログを作成
        if (!existingViewLog) {
          await prisma.viewLog.create({
            data: {
              videoId: firstVideo.id,
              sessionId: sessionId,
              userAgent: userAgent || null,
              watchDuration: null, // 後で更新
              completionRate: null, // 後で更新
              referrer: headersList.get('referer') || null,
              viewedAt: new Date()
            }
          })
          
        }
      } catch (viewLogError) {
        console.error('プレイリスト視聴ログ作成エラー:', viewLogError)
        // 視聴ログ作成に失敗しても動画表示は継続
      }
    }
    
    return post
  } catch (error) {
    console.error('Error fetching post:', error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params
  const post = await getPost(resolvedParams.post_id)
  
  if (!post) {
    return {
      title: 'ビデオが見つかりません',
    }
  }

  const title = post.postType === 'VIDEO' ? post.video?.title : post.playlist?.title
  const description = post.postType === 'VIDEO' ? post.video?.description : post.playlist?.description

  return {
    title: `${title} | 動画プラットフォーム`,
    description: description || '',
    openGraph: {
      title: title || '',
      description: description || '',
      type: 'video.other',
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/watch/${resolvedParams.post_id}`,
      images: [
        {
          url: post.postType === 'VIDEO' 
            ? post.video?.thumbnailUrl || '/images/default-thumbnail.jpg'
            : post.playlist?.thumbnailUrl || '/images/default-thumbnail.jpg',
          width: 1200,
          height: 630,
          alt: title || '',
        },
      ],
    },
  }
}

export default async function WatchPage({ params }: PageProps) {
  const resolvedParams = await params
  const post = await getPost(resolvedParams.post_id)

  if (!post) {
    notFound()
  }

  // 学内限定動画の場合、ログイン状態をチェック
  if (post.visibility === 'PRIVATE') {
    const hasAccess = await checkInternalVideoAccess()
    if (!hasAccess) {
      redirect('/login?reason=private_video')
    }
  }

  return <VideoWatchPage post={post} />
} 