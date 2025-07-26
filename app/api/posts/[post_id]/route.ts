import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkInternalVideoAccess } from '@/lib/auth-access-control'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ post_id: string }> }
) {
  try {
    const resolvedParams = await params;
    const postId = resolvedParams.post_id;

    // Fetch post with relations
    const post = await prisma.post.findUnique({
      where: {
        postId: postId,
        visibility: 'PUBLIC',
      },
      include: {
        video: {
          include: {
            uploader: {
              select: {
                id: true,
                username: true,
                displayName: true,
                profileImageUrl: true,
                department: true
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
                department: true
              }
            },
            videos: {
              include: {
                video: {
                  include: {
                    uploader: {
                      select: {
                        id: true,
                        username: true,
                        displayName: true,
                        profileImageUrl: true,
                        department: true
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
        },
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            department: true
          }
        }
      },
    })

    if (!post) {
      return createErrorResponse('Post not found', 404);
    }

    // Check draft post access
    if (post.visibility.toString() === 'draft') {
      return createErrorResponse('この投稿は非公開に設定されています', 403);
    }

    // Check internal video access
    if (post.visibility === 'PRIVATE') {
      const hasAccess = await checkInternalVideoAccess(request)
      if (!hasAccess) {
        console.log(`Internal video access denied for post: ${postId}`)
        return createErrorResponse('この動画はログインユーザーのみアクセス可能です', 403);
      }
    }

    // Format response based on post type
    let formattedPost: any = {
      postId: post.postId,
      postType: post.postType,
      title: post.title,
      description: post.description,
      visibility: post.visibility,
      creator: {
        id: post.creator.id.toString(),
        name: post.creator.displayName,
        username: post.creator.username,
        avatar: post.creator.profileImageUrl,
        department: post.creator.department
      },
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      publishedAt: post.publishedAt,
    }

    if (post.postType === 'VIDEO' && post.video) {
      formattedPost.video = {
        id: post.video.videoId,
        title: post.video.title,
        description: post.video.description,
        thumbnail: post.video.thumbnailUrl || '/images/default-thumbnail.jpg',
        duration: post.video.duration,
        viewCount: post.video.viewCount,
        uploadType: post.video.uploadType,
        youtubeUrl: post.video.youtubeUrl,
        fileSize: post.video.fileSize ? post.video.fileSize.toString() : null,
        author: {
          id: post.video.uploader.id.toString(),
          name: post.video.uploader.displayName,
          username: post.video.uploader.username,
          avatar: post.video.uploader.profileImageUrl,
          department: post.video.uploader.department
        },
        categories: post.video.categories.map((vc: any) => ({
          id: vc.category.id.toString(),
          name: vc.category.name,
          slug: vc.category.slug,
          color: vc.category.color,
        })),
        tags: post.video.tags.map((vt: any) => ({
          id: vt.tag.id.toString(),
          name: vt.tag.name,
        })),
        uploadedAt: post.video.createdAt,
        publishedAt: post.video.publishedAt,
      }
    }

    if (post.postType === 'PLAYLIST' && post.playlist) {
      formattedPost.playlist = {
        id: post.playlist.playlistId,
        title: post.playlist.title,
        description: post.playlist.description,
        thumbnail: post.playlist.thumbnailUrl || '/images/default-thumbnail.jpg',
        videoCount: post.playlist.videoCount,
        totalDuration: post.playlist.totalDuration,
        creator: {
          id: post.playlist.creator.id.toString(),
          name: post.playlist.creator.displayName,
          username: post.playlist.creator.username,
          avatar: post.playlist.creator.profileImageUrl,
          department: post.playlist.creator.department
        },
        videos: post.playlist.videos.map((pv: any) => ({
          video: {
            id: pv.video.videoId,
            title: pv.video.title,
            description: pv.video.description,
            thumbnail: pv.video.thumbnailUrl || '/images/default-thumbnail.jpg',
            duration: pv.video.duration,
            viewCount: pv.video.viewCount,
            uploadType: pv.video.uploadType,
            youtubeUrl: pv.video.youtubeUrl,
            fileSize: pv.video.fileSize ? pv.video.fileSize.toString() : null,
            author: {
              id: pv.video.uploader.id.toString(),
              name: pv.video.uploader.displayName,
              username: pv.video.uploader.username,
              avatar: pv.video.uploader.profileImageUrl,
              department: pv.video.uploader.department
            },
            categories: pv.video.categories.map((vc: any) => ({
              id: vc.category.id.toString(),
              name: vc.category.name,
              slug: vc.category.slug,
              color: vc.category.color,
            })),
            tags: pv.video.tags.map((vt: any) => ({
              id: vt.tag.id.toString(),
              name: vt.tag.name,
            })),
            uploadedAt: pv.video.createdAt,
            publishedAt: pv.video.publishedAt,
          }
        })),
        createdAt: post.playlist.createdAt,
      }
    }

    return createSuccessResponse(formattedPost);

  } catch (error) {
    console.error('Post API Error:', error)
    return createErrorResponse('Failed to fetch post', 500);
  }
} 