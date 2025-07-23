import { NextRequest } from 'next/server'

interface RateLimitConfig {
  windowMs: number // 時間窓（ミリ秒）
  maxRequests: number // 最大リクエスト数
  keyGenerator?: (request: NextRequest) => string // キー生成関数
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// メモリベースのレート制限ストア（本番環境ではRedis等を使用）
const rateLimitStore = new Map<string, RateLimitEntry>()

// デフォルトのレート制限設定
const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15分
  maxRequests: 100, // 100リクエスト
  keyGenerator: (request: NextRequest) => {
    // IPアドレスベースのキー生成
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    return `rate_limit:${ip}`
  }
}

// レート制限チェック関数
export function checkRateLimit(
  request: NextRequest,
  config: Partial<RateLimitConfig> = {}
): { allowed: boolean; remaining: number; resetTime: number } {
  const finalConfig = { ...defaultConfig, ...config }
  const key = finalConfig.keyGenerator!(request)
  const now = Date.now()
  
  // 既存のエントリを取得
  const entry = rateLimitStore.get(key)
  
  if (!entry || now > entry.resetTime) {
    // 新しい時間窓を開始
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + finalConfig.windowMs
    }
    rateLimitStore.set(key, newEntry)
    
    return {
      allowed: true,
      remaining: finalConfig.maxRequests - 1,
      resetTime: newEntry.resetTime
    }
  }
  
  if (entry.count >= finalConfig.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    }
  }
  
  // カウントを増加
  entry.count++
  rateLimitStore.set(key, entry)
  
  return {
    allowed: true,
    remaining: finalConfig.maxRequests - entry.count,
    resetTime: entry.resetTime
  }
}

// レート制限ミドルウェア
export function withRateLimit(
  handler: (request: NextRequest) => Promise<Response>,
  config?: Partial<RateLimitConfig>
) {
  return async (request: NextRequest): Promise<Response> => {
    const rateLimitResult = checkRateLimit(request, config)
    
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'レート制限に達しました。しばらく待ってから再試行してください。'
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config?.maxRequests?.toString() || '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      )
    }
    
    // レート制限ヘッダーを追加
    const response = await handler(request)
    response.headers.set('X-RateLimit-Limit', config?.maxRequests?.toString() || '100')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())
    
    return response
  }
}

// 定期的に古いエントリをクリーンアップ
setInterval(() => {
  const now = Date.now()
  const entries = Array.from(rateLimitStore.entries())
  for (const [key, entry] of entries) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000) // 1分ごとにクリーンアップ 