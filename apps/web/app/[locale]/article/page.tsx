import type { Metadata } from 'next';
import type { Article } from '@newranews/types';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getArticles } from '@/lib/api';
import { ArticlePageClient } from '@/components/article/article-page-client';

export const revalidate = 3600;

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.articles' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/article',
        en: '/en/article',
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

export default async function ArticleHistoryPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('article');
  const initialData = await getArticles(1, 9).catch(() => ({
    data: [] as Article[],
    meta: { total: 0, page: 1, limit: 9, totalPages: 0 },
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
      <ArticlePageClient initialData={initialData} />
    </div>
  );
}
