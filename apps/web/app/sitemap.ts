import type { MetadataRoute } from 'next';
import { getNews, getArticles, nullUnlessPublishing } from '@/lib/api';
import { toDateSlug } from '@/lib/format';
import { SITE_URL } from '@/lib/seo';
import { LOCALES } from '@/lib/i18n';

export const revalidate = 3600;

/** Duplica uma entrada do sitemap para cada idioma (prefixo sempre na URL). */
function localized(
  path: string,
  lastModified: Date | undefined,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: `${SITE_URL}/${locale}${path}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
  }));
}

/** A data mais recente de um conjunto, ou nada — nunca "agora". */
function latest(dates: Date[]): Date | undefined {
  if (dates.length === 0) return undefined;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

/**
 * **Duas regras, e as duas são sobre o que a ISR grava.**
 *
 * 1. **Nada de `new Date()` na saída.** O `lastModified` das rotas fixas era o
 *    relógio do render, então cada regeneração de hora em hora produzia um
 *    documento diferente — e a Vercel cobra ISR Write justamente pela mudança
 *    (medido em 19/09/2026; ver `STATIC_NOW` em `lib/i18n.ts` para o mesmo
 *    defeito no payload das páginas). Hoje a data das listagens é a do item
 *    mais novo que elas mostram, e as páginas que não mudam não declaram data:
 *    um `lastmod` que mente toda hora não ajuda buscador nenhum.
 *
 * 2. **A falha da API não vira sitemap de dez URLs.** Era `.catch(() => [])`,
 *    e com a API suspensa (19/09/2026) este documento regenerou de 386 para 10
 *    URLs, com 200 — a ISR gravou e serviu isso por uma hora, e por todas as
 *    horas seguintes enquanto a API não voltasse. Pela regra da própria Vercel
 *    a revalidação que responde 5xx é *falha*, e falha **mantém o documento
 *    anterior**; a que responde 200 vazio o substitui. `nullUnlessPublishing`
 *    é a mesma decisão da Home: relança onde o resultado é publicado (build da
 *    Vercel e revalidação em runtime), e cede no build do CI, que roda sem API
 *    e não publica nada.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const news = await nullUnlessPublishing(getNews(1, 100));
  const newsItems = news?.data ?? [];

  // API articles limit is capped at 50 — paginate to include the full history
  // and use toDateSlug() so URLs match the /article/[date] route (YYYY-MM-DD)
  const articles = await nullUnlessPublishing(
    getArticles(1, 50).then(async (firstPage) => {
      const { data: firstData, meta } = firstPage;
      const remainingPages =
        meta.totalPages > 1
          ? await Promise.all(
              Array.from({ length: meta.totalPages - 1 }, (_, i) =>
                getArticles(i + 2, 50),
              ),
            )
          : [];

      return [...firstData, ...remainingPages.flatMap((res) => res.data)];
    }),
  );
  const articleItems = articles ?? [];

  const newestNews = latest(newsItems.map((item) => new Date(item.updatedAt)));
  const newestArticle = latest(
    articleItems.map((item) => new Date(item.updatedAt)),
  );

  const staticRoutes: MetadataRoute.Sitemap = [
    ...localized('', newestNews, 'daily', 1.0),
    ...localized('/news', newestNews, 'hourly', 0.9),
    ...localized('/article', newestArticle, 'daily', 0.8),
    ...localized('/newsletter', undefined, 'monthly', 0.6),
    ...localized('/about', undefined, 'monthly', 0.5),
  ];

  const newsRoutes = newsItems.flatMap(
    (item): MetadataRoute.Sitemap =>
      localized(`/news/${item.id}`, new Date(item.updatedAt), 'weekly', 0.7),
  );

  const articleRoutes = articleItems.flatMap(
    (item): MetadataRoute.Sitemap =>
      localized(
        `/article/${toDateSlug(item.date)}`,
        new Date(item.updatedAt),
        'never',
        0.8,
      ),
  );

  return [...staticRoutes, ...newsRoutes, ...articleRoutes];
}
