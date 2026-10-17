import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/seo';

/**
 * **O otimizador de imagem fica fora do rastreio** — 16/10/2026. O plano
 * Hobby da Vercel dá 5.000 transformações em 30 dias, e o robô que lê o `src`
 * pede a variante que nenhum leitor pede (a do hero sai a 1920 px). As fotos
 * são dos veículos, não nossas: a imagem que o Google Discover e o Notícias
 * usam é a do `og:image` e do JSON-LD, que apontam direto para a fonte e
 * continuam rastreáveis. A regra mais longa vence a `allow: '/'` (RFC 9309,
 * §2.2.2).
 */
const IMAGE_OPTIMIZER = '/_next/image';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: IMAGE_OPTIMIZER,
      },
      {
        // **O ClaudeBot fica fora das matérias** — 16/10/2026, decisão do
        // dono. No log de CDN daquele dia ele fez 578 das 597 regenerações
        // de página da ISR: 318 `/news/[id]`, cada uma nos dois idiomas, numa
        // rajada às 14 UTC — e todas as 167 transformações de imagem. Com o
        // cache da ISR vazio para elas, cada visita era uma escrita, e a cota
        // do Hobby (200 mil em 30 dias, que pausa a conta inteira) cruzaria
        // os 200 mil ~26/10 mesmo com as páginas mais leves. As matérias são
        // texto dos veículos agregado por feed; a Home, os briefings, as
        // listagens e o `/about` continuam abertos a ele.
        //
        // **O grupo repete o otimizador de imagem de propósito:** o robô que
        // tem um grupo próprio obedece só a ele e ignora o `*` (RFC 9309,
        // §2.2.1). A barra final de `/news/` é o que deixa a listagem
        // `/pt-BR/news` aberta.
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: [IMAGE_OPTIMIZER, ...routing.locales.map((locale) => `/${locale}/news/`)],
      },
    ],
    // Dois, e não um: o geral descreve o acervo inteiro e o de notícias
    // descreve a janela de 48h que o Google Notícias lê. O segundo não
    // substitui o primeiro — as mesmas URLs estão nos dois, com propósitos
    // diferentes.
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
