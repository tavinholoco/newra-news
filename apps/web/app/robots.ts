import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    // Dois, e não um: o geral descreve o acervo inteiro e o de notícias
    // descreve a janela de 48h que o Google Notícias lê. O segundo não
    // substitui o primeiro — as mesmas URLs estão nos dois, com propósitos
    // diferentes.
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
