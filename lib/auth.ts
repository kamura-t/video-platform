import { User, LoginCredentials } from '@/types/auth';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const login = async (credentials: LoginCredentials): Promise<User> => {
  // 実際のデータベース認証は /api/auth/login で処理されるため、
  // このファイルでは認証処理を行わない
  throw new Error('この関数は使用されていません。/api/auth/login を使用してください。');
};

export const logout = async (): Promise<void> => {
  // 実際のログアウト処理は /api/auth/logout で処理される
  throw new Error('この関数は使用されていません。/api/auth/logout を使用してください。');
};

export const getCurrentUser = (): User | null => {
  // 実際のユーザー情報は /api/auth/me で取得される
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  }
  return null;
};

export const saveCurrentUser = (user: User): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('currentUser', JSON.stringify(user));
  }
};

export const clearCurrentUser = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('currentUser');
  }
};

export const getRoleDisplayName = (role: User['role']): string => {
  const roleNames = {
    admin: '管理者',
    curator: 'キュレーター', 
    viewer: '視聴者',
    ADMIN: '管理者',
    CURATOR: 'キュレーター',
    VIEWER: '視聴者',
  };
  return roleNames[role as keyof typeof roleNames] || '不明';
};

// 権限チェック関数
export const canManageUsers = (role: User['role']): boolean => {
  const normalizedRole = role.toLowerCase();
  return normalizedRole === 'admin';
};

export const canUploadVideos = (role: User['role']): boolean => {
  const normalizedRole = role.toLowerCase();
  return ['admin', 'curator'].includes(normalizedRole);
};

export const canAccessAdminPanel = (role: User['role']): boolean => {
  const normalizedRole = role.toLowerCase();
  return ['admin', 'curator'].includes(normalizedRole);
};

export const canWatchVideos = (role: User['role']): boolean => {
  const normalizedRole = role.toLowerCase();
  return ['admin', 'curator', 'viewer'].includes(normalizedRole);
};

export const canInteractWithVideos = (role: User['role']): boolean => {
  const normalizedRole = role.toLowerCase();
  return ['admin', 'curator', 'viewer'].includes(normalizedRole);
};

export const canManagePlaylists = (role: User['role']): boolean => {
  const normalizedRole = role.toLowerCase();
  return ['admin', 'curator'].includes(normalizedRole);
};

export const canDeleteVideos = (role: User['role']): boolean => {
  const normalizedRole = role.toLowerCase();
  return normalizedRole === 'admin';
};

// JWT関連の関数
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): { userId: string; username: string; role: string; email: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string; email: string };
    return decoded;
  } catch (error) {
    return null;
  }
};

// API認証処理を共通化
export async function authenticateApiRequest(request: NextRequest, requiredRoles: string[] = ['ADMIN', 'CURATOR']) {
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      ),
      user: null
    }
  }

  try {
    const currentUser = verifyToken(token)
    
    if (!currentUser) {
      return {
        error: NextResponse.json(
          { success: false, error: '無効な認証トークンです' },
          { status: 401 }
        ),
        user: null
      }
    }

    if (!requiredRoles.includes(currentUser.role)) {
      const roleNames = requiredRoles.includes('ADMIN') && requiredRoles.includes('CURATOR') 
        ? '管理者またはキュレーター権限'
        : requiredRoles.includes('ADMIN') 
          ? '管理者権限'
          : 'キュレーター権限'
      
      return {
        error: NextResponse.json(
          { success: false, error: `${roleNames}が必要です` },
          { status: 403 }
        ),
        user: null
      }
    }

    return {
      error: null,
      user: currentUser
    }
  } catch (error) {
    return {
      error: NextResponse.json(
        { success: false, error: '認証エラーが発生しました' },
        { status: 401 }
      ),
      user: null
    }
  }
}

// プレイリスト権限チェック
export function checkPlaylistPermission(currentUser: any, playlist: any) {
  // ADMINは全てのプレイリストを編集可能
  if (currentUser.role === 'ADMIN') {
    return { hasPermission: true, error: null }
  }
  
  // CURATORは自分のプレイリストのみ編集可能
  if (currentUser.role === 'CURATOR' && playlist.creatorId !== parseInt(currentUser.userId)) {
    return {
      hasPermission: false,
      error: NextResponse.json(
        { success: false, error: '自分が作成したプレイリストのみ編集できます' },
        { status: 403 }
      )
    }
  }
  
  return { hasPermission: true, error: null }
}