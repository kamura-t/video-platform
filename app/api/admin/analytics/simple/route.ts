import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response'

export async function GET(request: NextRequest) {
  console.log('=== Simple Analytics API Called ===')
  
  try {
    const token = request.cookies.get('auth-token')?.value
    console.log('=== Authentication Debug ===')
    console.log('Token exists:', !!token)
    console.log('Token (first 20 chars):', token?.substring(0, 20) + '...')
    
    if (!token) {
      console.log('No token found, returning 401')
      return createErrorResponse('認証トークンがありません', 401)
    }

    const user = verifyToken(token)
    console.log('Decoded user:', user)
    console.log('User role:', user?.role)
    console.log('Role type:', typeof user?.role)
    console.log('Role comparison (admin):', user?.role === 'admin')
    console.log('Role comparison (ADMIN):', user?.role === 'ADMIN')
    console.log('Role toLowerCase():', user?.role?.toLowerCase())
    
    if (!user) {
      console.log('Token verification failed')
      return createErrorResponse('無効な認証トークンです', 401)
    }
    
    // ロールチェックを大文字小文字を考慮して行う
    const userRole = user.role?.toLowerCase()
    if (userRole !== 'admin') {
      console.log('Role check failed. Expected: admin, Got:', userRole)
      return createErrorResponse('管理者権限が必要です', 403)
    }
    
    console.log('Authentication successful')

    // 完全にダミーデータを返す
    const dummyData = {
      summary: {
        totalViews: 1250,
        uniqueViewers: 875,
        totalWatchTime: 42,
        avgSessionDuration: 320
      },
      topVideos: [
        {
          id: 'dummy1',
          title: 'サンプル動画 1',
          recentViews: 450,
          avgWatchDuration: 240,
          uploaderName: 'テストユーザー1'
        },
        {
          id: 'dummy2',
          title: 'サンプル動画 2',
          recentViews: 320,
          avgWatchDuration: 180,
          uploaderName: 'テストユーザー2'
        }
      ],
      topCategories: [
        {
          id: 1,
          name: 'テクノロジー',
          color: '#8884d8',
          recentViews: 420
        },
        {
          id: 2,
          name: 'エンターテイメント',
          color: '#82ca9d',
          recentViews: 380
        }
      ],
      viewTrends: [
        { date: '2024-01-15', views: 120, unique_viewers: 85, total_watch_time: 1200 },
        { date: '2024-01-16', views: 140, unique_viewers: 95, total_watch_time: 1400 },
        { date: '2024-01-17', views: 110, unique_viewers: 75, total_watch_time: 1100 },
        { date: '2024-01-18', views: 160, unique_viewers: 110, total_watch_time: 1600 },
        { date: '2024-01-19', views: 180, unique_viewers: 125, total_watch_time: 1800 }
      ],
      deviceStats: {
        deviceTypes: { mobile: 60, desktop: 35, tablet: 5 },
        browsers: { chrome: 70, safari: 15, firefox: 10, edge: 5 }
      }
    }

    console.log('Returning dummy data successfully')
    return createSuccessResponse(dummyData)
  } catch (error) {
    console.error('Simple analytics error:', error)
    return createErrorResponse(`Simple analytics error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}