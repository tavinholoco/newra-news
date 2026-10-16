import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // **O otimizador de imagem fica fora do rastreio** — 16/10/2026. O
        // plano Hobby da Vercel dá 5.000 transformações em 30 dias, e o robô
        // que lê o `src` pede a variante que nenhum leitor pede (a do hero sai
        // a 1920 px). As fotos são dos veículos, não nossas: a imagem que o
        // Google Discover e o Notícias usam é a do `og:image` e do JSON-LD,
        // que apontam direto para a fonte e continuam rastreáveis. A regra
        // mais longa vence a `allow: '/'` (RFC 9309, §2.2.2).
        disallow: '/_next/image',
      },
    ],
    // Dois, e não um: o geral descreve o acervo inteiro e o de notícias
    // descreve a janela de 48h que o Google Notícias lê. O segundo não
    // substitui o primeiro — as mesmas URLs estão nos dois, com propósitos
    // diferentes.
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
