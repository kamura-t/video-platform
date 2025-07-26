import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // 開発環境と本番環境で異なるCSP設定
  const isDev = process.env.NODE_ENV === 'development'
  
  const csp = isDev ? `
    default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:;
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https:;
    style-src 'self' 'unsafe-inline' https:;
    img-src 'self' data: blob: https:;
    font-src 'self' data: https:;
    frame-src 'self' https:;
    connect-src 'self' ws: wss: https:;
    media-src 'self' blob: data: https:;
  `.replace(/\s+/g, ' ').trim() : `
    default-src 'self';
    script-src 'self' 'unsafe-eval' https://www.youtube.com https://www.google.com https://www.gstatic.com https://translate.google.com https://translate.googleapis.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://translate.googleapis.com;
    img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://translate.google.com https://translate.googleapis.com https:;
    font-src 'self' data: https://fonts.gstatic.com https://translate.googleapis.com;
    frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com;
    connect-src 'self' ws: wss: https: https://translate.googleapis.com;
    media-src 'self' blob: data: https:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s+/g, ' ').trim()

  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}