import type { MetadataRoute } from 'next';
import { getNews, getArticles } from '@/lib/api';
import { toDateSlug } from '@/lib/format';
import { SITE_URL } from '@/lib/seo';
import { LOCALES } from '@/lib/i18n';

export const revalidate = 3600;

/** Duplica uma entrada do sitemap para cada idioma (prefixo sempre na URL). */
function localized(
  path: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: `${SITE_URL}/${locale}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    ...localized('', now, 'daily', 1.0),
    ...localized('/news', now, 'hourly', 0.9),
    ...localized('/article', now, 'daily', 0.8),
    ...localized('/newsletter', now, 'monthly', 0.6),
    ...localized('/about', now, 'monthly', 0.5),
  ];

  const newsRoutes = await getNews(1, 100)
    .then((res) =>
      res.data.flatMap(
        (item): MetadataRoute.Sitemap =>
          localized(
            `/news/${item.id}`,
            new Date(item.updatedAt),
            'weekly',
            0.7,
          ),
      ),
    )
    .catch(() => [] as MetadataRoute.Sitemap);

  // API articles limit is capped at 50 — paginate to include the full history
  // and use toDateSlug() so URLs match the /article/[date] route (YYYY-MM-DD)
  const articleRoutes = await getArticles(1, 50)
    .then(async (firstPage) => {
      const { data: firstData, meta } = firstPage;
      const remainingPages =
        meta.totalPages > 1
          ? await Promise.all(
              Array.from({ length: meta.totalPages - 1 }, (_, i) =>
                getArticles(i + 2, 50),
              ),
            )
          : [];

      return [...firstData, ...remainingPages.flatMap((res) => res.data)].flatMap(
        (item): MetadataRoute.Sitemap =>
          localized(
            `/article/${toDateSlug(item.date)}`,
            new Date(item.updatedAt),
            'never',
            0.8,
          ),
      );
    })
    .catch(() => [] as MetadataRoute.Sitemap);

  return [...staticRoutes, ...newsRoutes, ...articleRoutes];
}
