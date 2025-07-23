import { OAuth2Client } from 'google-auth-library';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/google/callback`;

// Google OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Create OAuth2 client
export const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Generate authorization URL
export function getGoogleAuthUrl(): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    include_granted_scopes: true,
  });
}

// Exchange authorization code for tokens
export async function getGoogleTokens(code: string) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error exchanging Google auth code for tokens:', error);
    throw new Error('Failed to exchange authorization code');
  }
}

// Get user info from Google API
export async function getGoogleUserInfo(accessToken: string) {
  try {
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const userInfo = await response.json();
    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      verified_email: userInfo.verified_email,
    };
  } catch (error) {
    console.error('Error fetching Google user info:', error);
    throw new Error('Failed to fetch user information from Google');
  }
}

// Validate domain for organization access
export function isValidOrganizationDomain(email: string): boolean {
  const allowedDomains = process.env.ALLOWED_GOOGLE_DOMAINS?.split(',') || [];
  
  if (allowedDomains.length === 0) {
    console.warn('No allowed Google domains configured');
    return true; // Allow all domains if none configured
  }

  const emailDomain = email.split('@')[1];
  
  // Check for exact domain match or wildcard subdomain match
  const isValid = allowedDomains.some(domain => {
    // Exact match
    if (emailDomain === domain.trim()) {
      return true;
    }
    
    // Wildcard subdomain match (e.g., "*.geidai.ac.jp" matches "noc.geidai.ac.jp")
    if (domain.trim().startsWith('*.')) {
      const baseDomain = domain.trim().substring(2); // Remove "*."
      return emailDomain.endsWith('.' + baseDomain) || emailDomain === baseDomain;
    }
    
    return false;
  });
  
  return isValid;
}

// Generate username from Google email
export function generateUsernameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  // Replace non-alphanumeric characters with underscores and limit length
  const cleanUsername = localPart
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .substring(0, 50); // Allow up to 50 characters to leave room for counter suffix
  
  return cleanUsername;
}