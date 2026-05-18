import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@wijzer/core',
    '@wijzer/content',
    '@wijzer/ai',
    '@wijzer/db',
    'convex',
  ],
  serverExternalPackages: ['youtube-transcript'],
};

export default nextConfig;
