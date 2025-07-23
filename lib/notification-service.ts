import { prisma } from './prisma';

export interface NotificationData {
  type: 'scheduled_publish' | 'scheduled_unpublish' | 'system_alert';
  title: string;
  message: string;
  userId?: number;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * 通知を作成
   */
  static async createNotification(data: NotificationData): Promise<void> {
    try {
      if (!data.userId) {
        console.error('Cannot create notification without userId');
        return;
      }
      
      await prisma.notification.create({
        data: {
          type: data.type,
          title: data.title,
          message: data.message,
          userId: data.userId,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          isRead: false,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  /**
   * 予約投稿完了通知
   */
  static async notifyScheduledPublish(
    userId: number,
    itemType: 'video' | 'post',
    itemTitle: string,
    itemId: string
  ): Promise<void> {
    await this.createNotification({
      type: 'scheduled_publish',
      title: '予約投稿が完了しました',
      message: `${itemType === 'video' ? '動画' : '投稿'}「${itemTitle}」が予定通り公開されました。`,
      userId,
      metadata: {
        itemType,
        itemId,
        itemTitle,
        publishedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * 予約非公開完了通知
   */
  static async notifyScheduledUnpublish(
    userId: number,
    itemType: 'video' | 'post',
    itemTitle: string,
    itemId: string
  ): Promise<void> {
    await this.createNotification({
      type: 'scheduled_unpublish',
      title: '予約非公開が完了しました',
      message: `${itemType === 'video' ? '動画' : '投稿'}「${itemTitle}」が予定通り非公開になりました。`,
      userId,
      metadata: {
        itemType,
        itemId,
        itemTitle,
        unpublishedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * システムアラート通知
   */
  static async notifySystemAlert(
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // 管理者全員に通知
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.createNotification({
        type: 'system_alert',
        title,
        message,
        userId: admin.id,
        metadata,
      });
    }
  }

  /**
   * ユーザーの通知一覧取得
   */
  static async getUserNotifications(userId: number, limit = 20, offset = 0) {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 通知を既読にする
   */
  static async markAsRead(notificationId: number, userId: number): Promise<void> {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * ユーザーの未読通知数取得
   */
  static async getUnreadCount(userId: number): Promise<number> {
    return await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * 古い通知を削除（30日より古い）
   */
  static async cleanupOldNotifications(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
  }
}

export default NotificationService;