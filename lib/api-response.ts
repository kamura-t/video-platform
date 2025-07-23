import { NextResponse } from 'next/server'

// 統一されたAPIレスポンス形式
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 成功レスポンスのヘルパー関数（オーバーロード）
export function createSuccessResponse<T>(
  data: T,
  status?: number
): NextResponse<ApiResponse<T>>
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  pagination?: ApiResponse['pagination']
): NextResponse<ApiResponse<T>>
export function createSuccessResponse<T>(
  data: T,
  messageOrStatus?: string | number,
  pagination?: ApiResponse['pagination']
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    ...(typeof messageOrStatus === 'string' && { message: messageOrStatus }),
    ...(pagination && { pagination })
  }
  
  const status = typeof messageOrStatus === 'number' ? messageOrStatus : 200
  return NextResponse.json(response, { status })
}

// エラーレスポンスのヘルパー関数
export function createErrorResponse(
  error: string,
  status: number = 500
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error
  }
  
  return NextResponse.json(response, { status })
}

// 認証エラーレスポンス
export function createAuthErrorResponse(): NextResponse<ApiResponse> {
  return createErrorResponse('認証が必要です', 401)
}

// 権限エラーレスポンス
export function createPermissionErrorResponse(): NextResponse<ApiResponse> {
  return createErrorResponse('権限がありません', 403)
}

// リソース未発見エラーレスポンス
export function createNotFoundErrorResponse(resource: string = 'リソース'): NextResponse<ApiResponse> {
  return createErrorResponse(`${resource}が見つかりません`, 404)
}

// バリデーションエラーレスポンス
export function createValidationErrorResponse(message: string): NextResponse<ApiResponse> {
  return createErrorResponse(message, 400)
} 