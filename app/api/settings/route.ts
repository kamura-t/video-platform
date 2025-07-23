import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // 公開設定のみを取得（認証不要）
    const settings = await prisma.systemSetting.findMany({
      where: {
        settingKey: {
          in: [
            'new_badge_display_days',
            'videos_per_page',
            'recent_videos_days'
          ]
        }
      },
      select: {
        settingKey: true,
        settingValue: true
      }
    });

    // 設定をオブジェクト形式に変換
    const settingsObj = settings.reduce((acc: Record<string, string>, setting: { settingKey: string; settingValue: string | null }) => {
      if (setting.settingValue !== null) {
        acc[setting.settingKey] = setting.settingValue;
      }
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({
      success: true,
      data: settingsObj
    });
  } catch (error) {
    console.error('Failed to fetch public settings:', error);
    return NextResponse.json(
      { success: false, error: 'システム設定の取得に失敗しました' },
      { status: 500 }
    );
  }
} 