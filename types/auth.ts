export type UserRole = 'admin' | 'curator' | 'viewer' | 'ADMIN' | 'CURATOR' | 'VIEWER';
export type AuthProvider = 'PASSWORD' | 'GOOGLE';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  authProvider?: AuthProvider;
  googleId?: string;
  department?: string;
  profileImageUrl?: string;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  userData?: User;
}