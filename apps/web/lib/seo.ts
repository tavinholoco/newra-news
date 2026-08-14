// Resolve a URL pública do site:
// 1. NEXT_PUBLIC_SITE_URL (explicita — usada quando houver domínio customizado)
// 2. VERCEL_PROJECT_PRODUCTION_URL (injetada automaticamente pela Vercel)
// 3. localhost:3000 (apenas desenvolvimento local)
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const SITE_NAME = 'Newra News';

export const SITE_DESCRIPTION =
  'Portal de notícias inteligente com artigos diários gerados por IA, reunindo as principais notícias do dia em um único lugar.';
