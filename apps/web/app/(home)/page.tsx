import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getNews, getLatestArticle } from '@/lib/api';
import { ArticleCard } from '@/components/article/article-card';
import { NewsGrid } from '@/components/news/news-grid';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default async function HomePage() {
  const [newsResponse, latestArticle] = await Promise.all([
    getNews(1, 12).catch(() => null),
    getLatestArticle(),
  ]);

  const news = newsResponse?.data ?? [];

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      {/* Hero — Artigo do dia */}
      {latestArticle && (
        <div className='mb-10'>
          <ArticleCard article={latestArticle} />
        </div>
      )}

      {/* Feed de notícias */}
      <section>
        <div className='mb-6 flex items-end justify-between'>
          <h2 className='font-display text-2xl font-bold text-foreground'>
            Últimas Notícias
          </h2>
          {news.length > 0 && (
            <Link
              href='/news'
              className='flex items-center gap-1 text-sm font-medium text-brand-600 transition-colors hover:text-brand-400'
            >
              Ver todas
              <ArrowRight className='h-4 w-4' />
            </Link>
          )}
        </div>

        <NewsGrid news={news} />
      </section>
    </div>
  );
}
