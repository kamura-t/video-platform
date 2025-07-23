import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'ログアウトしました'
    })

    // 認証クッキーを削除
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Logout API Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'サーバーエラーが発生しました' 
      },
      { status: 500 }
    )
  }
} 