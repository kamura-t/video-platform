import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google-auth';

export async function GET(request: NextRequest) {
  try {
    // Generate Google OAuth URL
    const authUrl = getGoogleAuthUrl();
    
    // Redirect user to Google OAuth
    return NextResponse.redirect(authUrl);
    
  } catch (error) {
    console.error('Google OAuth login error:', error);
    return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url));
  }
}