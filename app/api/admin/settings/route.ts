import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { configService } from '@/lib/config-service'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createAuthErrorResponse, 
  createPermissionErrorResponse 
} from '@/lib/api-response'
import { withRateLimit } from '@/lib/rate-limiter'

// システム設定取得
export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return createAuthErrorResponse()
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return createAuthErrorResponse()
    }

    // 管理者権限チェック（一時的に緩和）
    if (decoded.role !== 'ADMIN' && decoded.role !== 'admin' && decoded.role !== 'curator') {
      return createPermissionErrorResponse()
    }

    // 全設定を取得
    if (!configService) {
      return createErrorResponse('設定サービスが利用できません', 500)
    }
    
    const settings = await configService.getAll()
    
    console.log('Settings API Response:', {
      success: true,
      data: settings,
      count: settings.length
    })
    
    return createSuccessResponse(settings)
  } catch (error) {
    console.error('Settings GET Error:', error)
    return createErrorResponse('設定の取得に失敗しました', 500)
  }
}

// システム設定更新
export async function PUT(request: NextRequest) {
  try {
    // 認証チェック
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return createAuthErrorResponse()
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return createAuthErrorResponse()
    }

    // 管理者権限チェック（一時的に緩和）
    if (decoded.role !== 'ADMIN' && decoded.role !== 'admin' && decoded.role !== 'curator') {
      return createPermissionErrorResponse()
    }

    const { settings } = await request.json()

    // 設定を一括更新
    if (!configService) {
      return createErrorResponse('設定サービスが利用できません', 500)
    }
    
    await configService.setMultiple(settings)
    
    return createSuccessResponse(null, '設定を更新しました')
  } catch (error) {
    console.error('Settings PUT Error:', error)
    return createErrorResponse('設定の更新に失敗しました', 500)
  }
} 