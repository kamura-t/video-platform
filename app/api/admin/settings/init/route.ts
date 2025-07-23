import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { configService } from '@/lib/config-service'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: '無効なトークンです' }, { status: 401 })
    }

    // 管理者権限チェック
    if (decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 })
    }

    // デフォルト設定を初期化
    if (!configService) {
      return NextResponse.json({ error: '設定サービスが利用できません' }, { status: 500 })
    }
    
    await configService.setupDefaultSettings()
    
    return NextResponse.json({ 
      success: true,
      message: 'デフォルト設定を初期化しました'
    })
  } catch (error) {
    console.error('Settings init Error:', error)
    return NextResponse.json(
      { error: '設定の初期化に失敗しました' },
      { status: 500 }
    )
  }
} 