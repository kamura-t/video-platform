import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGoogleTokens, getGoogleUserInfo, isValidOrganizationDomain, generateUsernameFromEmail } from '@/lib/google-auth';
import jwt from 'jsonwebtoken';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-response';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error || !code) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(new URL('/login?error=google_auth_cancelled', request.url));
    }

    // Exchange code for tokens
    const tokens = await getGoogleTokens(code);
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }

    // Get user information from Google
    const googleUser = await getGoogleUserInfo(tokens.access_token);
    
    // Validate email and domain
    if (!googleUser.verified_email) {
      return NextResponse.redirect(new URL('/login?error=email_not_verified', request.url));
    }

    if (!isValidOrganizationDomain(googleUser.email)) {
      console.log('Domain not allowed for user:', googleUser.email);
      return NextResponse.redirect(new URL('/login?error=domain_not_allowed', request.url));
    }

    // Check if user already exists with Google ID
    let user = await prisma.user.findUnique({
      where: { googleId: googleUser.id }
    });

    if (!user) {
      // Check if user exists with same email but different auth provider
      const existingUser = await prisma.user.findUnique({
        where: { email: googleUser.email }
      });

      if (existingUser && existingUser.authProvider === 'PASSWORD') {
        // Email already exists with password auth
        return NextResponse.redirect(new URL('/login?error=email_already_exists', request.url));
      }

      // Generate unique username
      let username = generateUsernameFromEmail(googleUser.email);
      let usernameExists = await prisma.user.findUnique({ where: { username } });
      let counter = 1;
      
      while (usernameExists) {
        const baseUsername = generateUsernameFromEmail(googleUser.email);
        username = `${baseUsername}_${counter}`;
        
        // Ensure the final username doesn't exceed 64 characters
        if (username.length > 64) {
          const maxBaseLength = 64 - `_${counter}`.length;
          username = `${baseUsername.substring(0, maxBaseLength)}_${counter}`;
        }
        
usernameExists = await prisma.user.findUnique({ where: { username } });
        counter++;
      }
      
// Prepare user data for creation
      const userData = {
        username,
        displayName: googleUser.name || googleUser.email.split('@')[0],
        email: googleUser.email,
        passwordHash: null, // No password for Google users
        role: 'VIEWER' as const, // Fixed role for Google users
        authProvider: 'GOOGLE' as const,
        googleId: googleUser.id,
        profileImageUrl: (googleUser.picture && googleUser.picture.length <= 1500) 
          ? googleUser.picture 
          : '/images/default-avatar.png',
        isActive: true,
        lastLoginAt: new Date()
      };

// Create new user with Google OAuth
      user = await prisma.user.create({
        data: userData
      });

    } else {
      // Update existing Google user's last login
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          // Update profile image if available
          ...(googleUser.picture && { profileImageUrl: googleUser.picture })
        }
      });

    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.redirect(new URL('/login?error=account_disabled', request.url));
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Create response with redirect
    const response = NextResponse.redirect(
      new URL(user.role === 'VIEWER' ? '/account' : '/admin', request.url)
    );

    // Set JWT token in cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 hours
    });

    return response;

  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=google_auth_failed', request.url));
  }
}