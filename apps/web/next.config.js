const createNextIntlPlugin = require('next-intl/plugin');
const { securityHeaders } = require('./lib/security-headers');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@newranews/types'],
  images: {
    /**
     * **Qualquer host HTTPS — aceito e registrado, com o número que mede o
     * custo.** A §10.6 dava duas saídas para o otimizador aberto: derivar a
     * lista de hosts das fontes configuradas, ou aceitar e registrar. A
     * revisão tentou a primeira, construiu a lista, e **mediu que ela não
     * funciona** — em dois níveis.
     *
     * O primeiro é o que já se via: o host do feed quase nunca é o host da
     * imagem. O feed é `g1.globo.com` e a imagem vem de `s2-g1.glbimg.com`.
     *
     * O segundo derruba a ideia de vez, e só aparece varrendo o acervo inteiro
     * em vez de 100 itens por fonte. **O pipeline não ingere só os 13 feeds
     * RSS: ele ingere também a NewsData.io**, que agrega centenas de veículos.
     * Medido em 24/08/2026, sobre 3.000 itens de um acervo de 6.441:
     *
     * - **87 fontes distintas**, das quais **12** estão em `rss-sources.ts` —
     *   as outras 75 chegam pela NewsData.io;
     * - **95 hosts de imagem distintos**, e a cauda é longa: depois dos cinco
     *   maiores vêm 81 hosts com menos de 50 itens cada;
     * - a lista fechada que a revisão chegou a escrever cobria **77,6%** das
     *   imagens. Os outros **22,4% — 491 de 2.191 — virariam o placeholder de
     *   marca**, em silêncio, porque o `SafeImage` degrada sem gritar.
     *
     * O conjunto é **ilimitado por construção**: enumerar hosts de um agregador
     * de terceiro é uma lista que nasce incompleta e envelhece todo dia.
     *
     * **O que sobra é reduzir o custo do abuso, e é o que as três opções
     * abaixo fazem** — teto de larguras, um formato só e cache longo limitam
     * quantas transformações distintas uma URL qualquer pode provocar.
     *
     * **Gatilho para revisitar:** o aviso de cota de otimização de imagem da
     * Vercel. É observável e tem ordem de grandeza conhecida — a retenção de
     * `News` é de 30 dias e ~73% do acervo tem imagem, o que dá **~4.700
     * imagens de origem distintas por mês** só do tráfego legítimo. Se a cota
     * apertar, a saída não é a lista de hosts: é servir a imagem por um proxy
     * próprio, com a URL assinada pelo servidor que já sabe quais são válidas.
     */
    remotePatterns: [{ protocol: 'https', hostname: '**' }],

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
     *
     * **Com o host aberto, este teto é a mitigação principal**, não um ajuste
     * fino: ele limita a **6** as transformações que uma URL qualquer pode
     * provocar, em vez de 8 larguras × 8 tamanhos internos.
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
