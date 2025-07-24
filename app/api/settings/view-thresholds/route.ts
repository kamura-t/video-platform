import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 視聴回数関連の設定を取得
    const settings = await prisma.systemSetting.findMany({
      where: {
        settingKey: {
          in: ['view_count_threshold_percent', 'view_count_threshold_seconds']
        }
      }
    })

    // 設定値をマップに変換
    const settingsMap = settings.reduce((acc, setting) => {
      if (setting.settingValue) {
        acc[setting.settingKey] = setting.settingValue
      }
      return acc
    }, {} as Record<string, string>)

    // デフォルト値を設定
    const thresholds = {
      percent: settingsMap['view_count_threshold_percent'] ? parseInt(settingsMap['view_count_threshold_percent']) : 30,
      seconds: settingsMap['view_count_threshold_seconds'] ? parseInt(settingsMap['view_count_threshold_seconds']) : 180
    }

    return NextResponse.json({
      success: true,
      data: thresholds
    })
  } catch (error) {
    console.error('設定取得エラー:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch settings',
        data: {
          percent: 30,
          seconds: 180
        }
      },
      { status: 500 }
    )
  }
}