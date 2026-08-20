import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getNews, getLatestArticle } from '@/lib/api';
import { ArticleCard } from '@/components/article/article-card';
import { NewsGrid } from '@/components/news/news-grid';
import { SITE_NAME } from '@/lib/seo';

export const revalidate = 3600;

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'site' });

  return {
    title: { absolute: SITE_NAME },
    description: t('description'),
    alternates: {
      languages: {
        'pt-BR': '/pt-BR',
        en: '/en',
      },
    },
    openGraph: {
      title: SITE_NAME,
      description: t('description'),
    },
    twitter: {
      title: SITE_NAME,
      description: t('description'),
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
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
            {t('latestNews')}
          </h2>
          {news.length > 0 && (
            <Link
              href='/news'
              className='flex items-center gap-1 text-sm font-medium text-link transition-colors hover:text-link-hover'
            >
              {t('viewAll')}
              <ArrowRight className='h-4 w-4' />
            </Link>
          )}
        </div>

        <NewsGrid news={news} />
      </section>
    </div>
  );
}
