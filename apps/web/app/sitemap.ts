import type { MetadataRoute } from 'next';
import { getNews, getArticles } from '@/lib/api';
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

  const articleRoutes = await getArticles(1, 90)
    .then((res) =>
      res.data.map(
        (item): MetadataRoute.Sitemap[number] => ({
          url: `${SITE_URL}/article/${item.date}`,
          lastModified: new Date(item.updatedAt),
          changeFrequency: 'never',
          priority: 0.8,
        }),
      ),
    )
    .catch(() => [] as MetadataRoute.Sitemap);

  return [...staticRoutes, ...newsRoutes, ...articleRoutes];
}
