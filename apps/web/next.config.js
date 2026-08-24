const createNextIntlPlugin = require('next-intl/plugin');
const { securityHeaders } = require('./lib/security-headers');
const { remotePatterns } = require('./lib/image-hosts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@newranews/types'],
  images: {
    // Era `hostname: '**'` — qualquer host HTTPS, ou seja, um otimizador de
    // imagem aberto no domínio do site. A lista agora é medida fonte a fonte
    // em `lib/image-hosts.js`, e uma guarda exige entrada para cada feed
    // registrado na API.
    remotePatterns: remotePatterns(),

    /**
     * **Só WebP, e isso é decisão medida — não omissão.**
     *
     * O reflexo seria acrescentar AVIF: o `image-delivery-insight` do
     * Lighthouse aponta 62 kB de economia na imagem que abre a `/news`. Mas o
     * que domina o LCP aqui não é byte, é **MISS de cache no otimizador**: a
     * origem daquela imagem pesa **2,8 MB**, e todo MISS paga esse download
     * inteiro antes de transformar. Cada formato a mais **dobra** o número de
     * variantes distintas por imagem e, com o tráfego deste produto, joga a
     * taxa de acerto para baixo — trocaria ~60 kB de rede por mais um
     * fetch de 2,8 MB na origem. É o inverso do que se quer.
     */
    formats: ['image/webp'],

    /**
     * As larguras que o layout de fato pede, e nada além.
     *
     * Com os `sizes` limitados em pixel acima da largura do contêiner (nenhuma
     * caixa passa de ~800 px), `2048` e `3840` deixaram de ser alcançáveis —
     * mantê-las só deixaria aberto o pedido de uma variante que nenhuma tela
     * mostra, e cada variante distinta é mais um MISS possível.
     */
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // 64 = avatar do perfil · 96 = miniatura do `story-card-horizontal`; o
    // resto são os múltiplos de DPR dessas duas.
    imageSizes: [64, 96, 128, 192, 256, 384],

    // O default do Next é **60 segundos**. Fonte que não mande `Cache-Control`
    // cairia nele, e o otimizador voltaria à origem a cada minuto. Os feeds
    // medidos mandam 30 dias; este piso é o que cobre os que não mandarem.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  eslint: {
    // ESLint runs as a separate Turbo task in CI — skip during next build
    ignoreDuringBuilds: true,
  },
  async headers() {
    // Os cabeçalhos de defesa do site (Fase 10.S). A lista e o porquê de cada
    // decisão estão em `lib/security-headers.js`, que é a mesma fonte que a
    // guarda lê — cópia no teste provaria a cópia, não o cabeçalho.
    return [
      {
        source: '/:path*',
        headers: securityHeaders(),
      },
    ];
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
