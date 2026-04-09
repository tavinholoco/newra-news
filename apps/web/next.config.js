/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@newranews/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  eslint: {
    // ESLint runs as a separate Turbo task in CI — skip during next build
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
