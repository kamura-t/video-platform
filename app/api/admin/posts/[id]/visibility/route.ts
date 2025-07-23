import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Visibility } from '@prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 });
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.userId) },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // 管理者・キュレーター権限チェック
    if (!['ADMIN', 'CURATOR'].includes(user.role)) {
      return NextResponse.json({ error: '管理者またはキュレーター権限が必要です' }, { status: 403 });
    }

    const resolvedParams = await params;
    const postId = resolvedParams.id;
    const body = await request.json();
    const { visibility, scheduledPublishAt, scheduledUnpublishAt } = body;

    // バリデーション
    if (!visibility || !['PUBLIC', 'PRIVATE', 'DRAFT'].includes(visibility)) {
      return NextResponse.json({ error: '有効な公開設定を指定してください' }, { status: 400 });
    }

    // 予約投稿・非公開時刻のバリデーション
    if (scheduledPublishAt) {
      const publishTime = new Date(scheduledPublishAt);
      if (publishTime <= new Date()) {
        return NextResponse.json({ error: '予約投稿時刻は現在時刻より後である必要があります' }, { status: 400 });
      }
    }

    if (scheduledUnpublishAt) {
      const unpublishTime = new Date(scheduledUnpublishAt);
      if (unpublishTime <= new Date()) {
        return NextResponse.json({ error: '予約非公開時刻は現在時刻より後である必要があります' }, { status: 400 });
      }
      
      if (scheduledPublishAt) {
        const publishTime = new Date(scheduledPublishAt);
        if (unpublishTime <= publishTime) {
          return NextResponse.json({ error: '予約非公開時刻は予約投稿時刻より後である必要があります' }, { status: 400 });
        }
      }
    }

    // 投稿の存在確認
    const post = await prisma.post.findUnique({
      where: { postId },
      select: { postId: true, title: true, visibility: true, scheduledPublishAt: true, scheduledUnpublishAt: true }
    });

    if (!post) {
      return NextResponse.json({ error: '投稿が見つかりません' }, { status: 404 });
    }

    // 更新データを準備
    const updateData: any = {
      visibility: visibility as any,
      updatedAt: new Date()
    };

    // 予約投稿時刻を設定（nullの場合は削除）
    if (scheduledPublishAt !== undefined) {
      updateData.scheduledPublishAt = scheduledPublishAt ? new Date(scheduledPublishAt) : null;
    }

    // 予約非公開時刻を設定（nullの場合は削除）
    if (scheduledUnpublishAt !== undefined) {
      updateData.scheduledUnpublishAt = scheduledUnpublishAt ? new Date(scheduledUnpublishAt) : null;
    }

    // 公開設定を更新
    const updatedPost = await prisma.post.update({
      where: { postId },
      data: updateData,
      select: {
        postId: true,
        title: true,
        visibility: true,
        scheduledPublishAt: true,
        scheduledUnpublishAt: true,
        updatedAt: true
      }
    });

    const visibilityText = visibility === 'PUBLIC' ? 'パブリック' : 
                          visibility === 'PRIVATE' ? 'プライベート' : '非公開';
    
    // レスポンスメッセージを構築
    let message = `投稿を${visibilityText}に設定しました`;
    if (scheduledPublishAt) {
      message += `。予約投稿: ${new Date(scheduledPublishAt).toLocaleString('ja-JP')}`;
    }
    if (scheduledUnpublishAt) {
      message += `。予約非公開: ${new Date(scheduledUnpublishAt).toLocaleString('ja-JP')}`;
    }
    
    return NextResponse.json({ 
      message,
      post: updatedPost
    });

  } catch (error) {
    console.error('公開設定変更エラー:', error);
    return NextResponse.json(
      { error: '公開設定の変更に失敗しました' },
      { status: 500 }
    );
  }
} 