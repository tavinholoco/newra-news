const createNextIntlPlugin = require('next-intl/plugin');

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
  async redirects() {
    return [
      {
        // As métricas eram públicas em /[locale]/dashboard e estavam no
        // sitemap. Passaram para dentro de /admin (só ADMIN) na V2; o
        // redirect mantém link antigo funcionando e deixa o buscador
        // reconciliar a URL que saiu do índice.
        source: '/:locale(pt-BR|en)/dashboard',
        destination: '/:locale/admin/metrics',
        permanent: true,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

module.exports = withNextIntl(nextConfig);
