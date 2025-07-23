import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validationService } from '@/lib/validation-service';
import { storageService } from '@/lib/storage-service';
import { configService } from '@/lib/config-service';

export async function POST(request: NextRequest) {
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

    // 管理者権限チェック
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return NextResponse.json({ error: 'ロゴファイルが選択されていません' }, { status: 400 });
    }

    // ファイルバリデーション
    const validation = await validationService.validateImageFile(file);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // ストレージサービスを使用してファイルを保存
    const savedFile = await storageService.saveLogo(file, file.name);

    // システム設定を更新
    if (!configService) {
      throw new Error('ConfigService is not available');
    }
    await configService.set('site_logo_image', savedFile.filePath, 'STRING', 'サイトロゴ画像のURL');

    return NextResponse.json({
      success: true,
      message: 'ロゴ画像がアップロードされました',
      data: {
        logoUrl: savedFile.filePath
      }
    });

  } catch (error) {
    console.error('ロゴアップロードエラー:', error);
    return NextResponse.json(
      { error: 'ロゴ画像のアップロードに失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    // 管理者権限チェック
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    // 現在のロゴ画像パスを取得
    if (!configService) {
      throw new Error('ConfigService is not available');
    }
    const currentLogoPath = await configService.getString('site_logo_image');
    
    if (currentLogoPath) {
      // ストレージからファイルを削除
      try {
        await storageService.deleteFile(currentLogoPath);
      } catch (deleteError) {
        console.warn('Failed to delete logo file:', deleteError);
        // ファイル削除に失敗してもDBの設定は削除する
      }
    }

    // システム設定から削除
    if (!configService) {
      throw new Error('ConfigService is not available');
    }
    await configService.delete('site_logo_image');

    return NextResponse.json({
      success: true,
      message: 'ロゴ画像が削除されました'
    });

  } catch (error) {
    console.error('ロゴ削除エラー:', error);
    return NextResponse.json(
      { error: 'ロゴ画像の削除に失敗しました' },
      { status: 500 }
    );
  }
} 