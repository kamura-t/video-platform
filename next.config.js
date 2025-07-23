/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { 
    unoptimized: true,
    domains: ['localhost', 'i.ytimg.com', 'img.youtube.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        port: '',
        pathname: '/vi/**',
      },
    ],
  },
  // Server Actions are enabled by default in Next.js 14
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
      // NASの動画ファイルへのアクセス
      {
        source: '/videos/:path*',
        destination: '/api/videos/:path*',
      },
    ];
  },
  // Content Security Policy headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'development' 
              ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://www.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https:;"
              : "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https:;"
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
