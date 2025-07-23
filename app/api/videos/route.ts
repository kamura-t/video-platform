import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { checkPrivateVideoAccess } from '@/lib/ip-access-control'
import { createSuccessResponse, createErrorResponse, createAuthErrorResponse, createPermissionErrorResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sort = searchParams.get('sort') || 'latest'
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const category = searchParams.get('category')
    const tag = searchParams.get('tag') || searchParams.get('tags')
    const search = searchParams.get('search') || searchParams.get('q')
    const uploader = searchParams.get('uploader')
    const includePrivate = searchParams.get('includePrivate') === 'true'
    const random = searchParams.get('random') === 'true'
    


    let currentUser = null;

    // 管理者用機能（非公開動画を含める）の場合は権限チェック
    if (includePrivate) {
      const token = request.cookies.get('auth-token')?.value;
      if (!token) {
        return createAuthErrorResponse();
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return createAuthErrorResponse();
      }

      const user = await prisma.user.findUnique({
        where: { id: parseInt(decoded.userId) },
        select: { id: true, role: true }
      });

      if (!user || !['ADMIN', 'CURATOR'].includes(user.role)) {
        return createPermissionErrorResponse();
      }

      currentUser = user;
    }

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    // 投稿者権限による制限：CURATORは自分の動画のみ表示
    if (currentUser && currentUser.role === 'CURATOR') {
      where.uploaderId = currentUser.id;
    }

    // 管理者用の場合は非公開動画も含める、一般用の場合はパブリック動画のみ
    if (!includePrivate) {
      // 一般ユーザー向け：IPアドレス制御を事前チェック
      const hasPrivateAccess = await checkPrivateVideoAccess(request);
      
      if (hasPrivateAccess) {
        // プライベート動画アクセス権限がある場合：パブリック・プライベート動画を取得（非公開は除外）
        where.posts = {
          some: {
            visibility: {
              in: ['PUBLIC', 'PRIVATE']
            }
          }
        }
      } else {
        // プライベート動画アクセス権限がない場合：パブリック動画のみ
        where.posts = {
          some: {
            visibility: 'PUBLIC'
          }
        }
      }
    }

    // Add search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Add uploader filter (管理者が特定の投稿者を指定した場合のみ適用)
    if (uploader && currentUser && currentUser.role === 'ADMIN') {
      const uploaderId = parseInt(uploader, 10)
      if (!isNaN(uploaderId)) {
        where.uploaderId = uploaderId
      }
    }

    // Add category filter
    if (category) {
      const categoryId = parseInt(category, 10)
      if (!isNaN(categoryId)) {
        // 数値の場合はIDで検索
        where.categories = {
          some: {
            category: {
              id: categoryId
            }
          }
        }
      } else {
        // 文字列の場合はスラッグで検索
        where.categories = {
          some: {
            category: {
              slug: category
            }
          }
        }
      }
    }

    // Add tag filter
    if (tag) {
      const tagNames = tag.split(',').map(t => t.trim()).filter(t => t.length > 0)
      
      if (tagNames.length > 0) {
        where.tags = {
          some: {
            tag: {
              name: {
                in: tagNames
              }
            }
          }
        }
      }
    }



    // Build order by clause
    let orderBy: any = { createdAt: 'desc' } // default: latest

    // ランダム取得の場合
    if (random) {
      // ランダムソートのためのシード値を使用
      orderBy = undefined // ランダムソートは後で処理
    } else if (sortBy && sortOrder && sortBy !== 'createdAt') {
      // 管理者用の新しいソート方式（sortByがcreatedAt以外の場合のみ）
      const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc'
      switch (sortBy) {
        case 'title':
          orderBy = { title: orderDirection }
          break
        case 'views':
          orderBy = { viewCount: orderDirection }
          break
        case 'duration':
          orderBy = { duration: orderDirection }
          break
        case 'createdAt':
        default:
          orderBy = { createdAt: orderDirection }
          break
      }
    } else {
      // 従来のソート方式
      switch (sort) {
        case 'popular':
          orderBy = { viewCount: 'desc' }
          break
        case 'oldest':
          orderBy = { createdAt: 'asc' }
          break
        case 'duration':
          orderBy = { duration: 'desc' }
          break
        case 'title':
          orderBy = { title: 'asc' }
          break
        case 'latest':
        default:
          orderBy = { createdAt: 'desc' }
          break
      }
    }

    // Fetch videos with optimized relations and database-level pagination
    const [videos, totalCount] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          // 基本フィールド（必要なもののみ）
          id: true,
          videoId: true,
          title: true,
          description: true,
          uploadType: true,
          thumbnailUrl: true,
          duration: true,
          viewCount: true,
          visibility: true,
          status: true,
          isScheduled: true,
          createdAt: true,
          updatedAt: true,
          publishedAt: true,
          youtubeUrl: true,
          
          // 投稿者情報（必要なフィールドのみ）
          uploader: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
            }
          },
          
          // カテゴリ（必要なフィールドのみ）
          categories: {
            select: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  color: true
                }
              }
            }
          },
          
          // タグ（必要なフィールドのみ）
          tags: {
            select: {
              tag: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          
          // 投稿情報（必要なフィールドのみ）
          posts: {
            select: {
              postId: true,
              title: true,
              visibility: true
            }
          }
        },
      }),
      prisma.video.count({ where }),
    ])

    // ランダムソートの場合は特別処理
    let paginatedVideos = videos;
    if (random) {
      // ランダムソート：Fisher-Yates shuffle アルゴリズムを使用
      const shuffledVideos = [...videos];
      for (let i = shuffledVideos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledVideos[i], shuffledVideos[j]] = [shuffledVideos[j], shuffledVideos[i]];
      }
      paginatedVideos = shuffledVideos;
    }

    // Transform data for response (最適化版)
    const transformedVideos = paginatedVideos.map(video => ({
      // 基本情報（重複削除）
      id: video.id, // データベースのprimary key（number）
      videoId: video.videoId, // 表示用ID（string）
      title: video.title,
      description: video.description,
      uploadType: video.uploadType,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      viewCount: video.viewCount,
      visibility: video.visibility,
      status: video.status,
      isScheduled: video.isScheduled,
      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString(),
      publishedAt: video.publishedAt?.toISOString(),
      youtubeUrl: video.youtubeUrl,
      
      // 投稿者情報（統合版）
      uploader: {
        id: video.uploader.id,
        username: video.uploader.username,
        displayName: video.uploader.displayName,
        profileImageUrl: video.uploader.profileImageUrl,
      },
      author: {
        id: video.uploader.id,
        name: video.uploader.displayName || video.uploader.username,
        username: video.uploader.username,
        profileImageUrl: video.uploader.profileImageUrl,
      },
      
      // カテゴリ（最適化）
      categories: video.categories.map(vc => ({
        id: vc.category.id,
        name: vc.category.name,
        slug: vc.category.slug,
        color: vc.category.color
      })),
      
      // タグ（最適化）
      tags: video.tags.map(vt => ({
        id: vt.tag.id,
        name: vt.tag.name
      })),
      
      // 投稿情報（必要最小限）
      posts: video.posts.map(post => ({
        postId: post.postId,
        title: post.title,
        visibility: post.visibility
      }))
    }))

    const totalPages = Math.ceil(totalCount / limit)

    return createSuccessResponse(
      { 
        videos: transformedVideos,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      undefined,
      {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    )

  } catch (error) {
    console.error('Videos API Error:', error)
    return createErrorResponse('動画の取得に失敗しました', 500)
  }
} 