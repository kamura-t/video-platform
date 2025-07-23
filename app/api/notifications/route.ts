import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/auth';
import { NotificationService } from '@/lib/notification-service';

/**
 * 通知一覧取得API
 * GET /api/notifications
 */
export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authResult = await authenticateApiRequest(request);
    if (authResult.error) {
      return authResult.error;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const userId = parseInt(user.userId);
    const notifications = await NotificationService.getUserNotifications(
      userId,
      limit,
      offset
    );

    const unreadCount = await NotificationService.getUnreadCount(userId);

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          limit,
          offset,
          total: notifications.length + offset,
        },
      },
    });

  } catch (error) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json(
      { success: false, error: '通知の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 通知既読API
 * POST /api/notifications
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const authResult = await authenticateApiRequest(request);
    if (authResult.error) {
      return authResult.error;
    }

    const { user } = authResult;
    const body = await request.json();
    const { notificationId, action } = body;

    if (action === 'mark_read' && notificationId) {
      const userId = parseInt(user.userId);
      await NotificationService.markAsRead(notificationId, userId);
      
      return NextResponse.json({
        success: true,
        message: '通知を既読にしました',
      });
    }

    return NextResponse.json(
      { success: false, error: '不正なリクエストです' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Notification update error:', error);
    return NextResponse.json(
      { success: false, error: '通知の更新に失敗しました' },
      { status: 500 }
    );
  }
}