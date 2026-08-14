import type { MetadataRoute } from 'next';
import { getNews, getArticles } from '@/lib/api';
import { toDateSlug } from '@/lib/format';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/news`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/article`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const newsRoutes = await getNews(1, 100)
    .then((res) =>
      res.data.map(
        (item): MetadataRoute.Sitemap[number] => ({
          url: `${SITE_URL}/news/${item.id}`,
          lastModified: new Date(item.updatedAt),
          changeFrequency: 'weekly',
          priority: 0.7,
        }),
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

      return [...firstData, ...remainingPages.flatMap((res) => res.data)].map(
        (item): MetadataRoute.Sitemap[number] => ({
          url: `${SITE_URL}/article/${toDateSlug(item.date)}`,
          lastModified: new Date(item.updatedAt),
          changeFrequency: 'never',
          priority: 0.8,
        }),
      );
    })
    .catch(() => [] as MetadataRoute.Sitemap);

  return [...staticRoutes, ...newsRoutes, ...articleRoutes];
}
