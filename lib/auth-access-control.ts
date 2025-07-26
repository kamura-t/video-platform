import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JWTPayload {
  userId: number;
  username: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * リクエストからユーザー認証状態をチェック
 */
export async function checkUserAuthentication(request: NextRequest): Promise<{
  isAuthenticated: boolean;
  user?: JWTPayload;
}> {
  try {
    // クッキーまたはAuthorizationヘッダーからトークンを取得
    const cookieToken = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    const token = cookieToken || headerToken;

    if (!token) {
      return { isAuthenticated: false };
    }

    // トークン検証
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return { 
        isAuthenticated: true, 
        user: payload 
      };
    } catch (error) {
      console.warn('Invalid JWT token:', error);
      return { isAuthenticated: false };
    }

  } catch (error) {
    console.error('Authentication check error:', error);
    return { isAuthenticated: false };
  }
}

/**
 * Server Component用：ユーザー認証状態をチェック
 */
export async function checkUserAuthenticationServer(): Promise<{
  isAuthenticated: boolean;
  user?: JWTPayload;
}> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return { isAuthenticated: false };
    }

    // トークン検証
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return { 
        isAuthenticated: true, 
        user: payload 
      };
    } catch (error) {
      console.warn('Invalid JWT token:', error);
      return { isAuthenticated: false };
    }

  } catch (error) {
    console.error('Authentication check error:', error);
    return { isAuthenticated: false };
  }
}

/**
 * 学内限定動画のアクセス権限をチェック（ログイン状態ベース）
 */
export async function checkInternalVideoAccess(request?: NextRequest): Promise<boolean> {
  if (request) {
    // NextRequest使用時（middleware等）
    const { isAuthenticated } = await checkUserAuthentication(request);
    return isAuthenticated;
  } else {
    // Server Component使用時
    const { isAuthenticated } = await checkUserAuthenticationServer();
    return isAuthenticated;
  }
}