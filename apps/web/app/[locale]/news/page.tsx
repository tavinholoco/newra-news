import { Suspense } from 'react';
import type { Metadata } from 'next';
import type { News } from '@newranews/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getNews } from '@/lib/api';
import { NewsPageClient } from '@/components/news/news-page-client';
import { NewsGrid } from '@/components/news/news-grid';

export const revalidate = 3600;

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.news' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/news',
        en: '/en/news',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
    },
    twitter: {
      title: t('title'),
      description: t('description'),
    },
  };
}

export default async function NewsPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('news');
  const initialData = await getNews(1, 20).catch(() => ({
    data: [] as News[],
    meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  }));

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <h1 className='font-display text-2xl font-bold text-foreground sm:text-3xl'>
          {t('title')}
        </h1>
        <p className='mt-2 text-muted-foreground'>
          {t('pageDescription')}
        </p>
      </div>
      {/* `NewsPageClient` lê `?category=` e `?search=` da URL; numa página
          estática isso exige fronteira de Suspense. */}
      <Suspense fallback={<NewsGrid news={[]} isLoading />}>
        <NewsPageClient initialData={initialData} />
      </Suspense>
    </div>
  );
}
