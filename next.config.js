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
  // CSPヘッダーはmiddleware.tsで管理するため、ここでは設定しない
};

module.exports = nextConfig;
