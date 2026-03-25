import type { Metadata } from 'next';
import type { News } from '@newranews/types';
import { getNews } from '@/lib/api';
import { NewsPageClient } from '@/components/news/news-page-client';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Notícias',
  description: 'Todas as notícias do mundo em um só lugar.',
  openGraph: {
    title: 'Notícias',
    description: 'Todas as notícias do mundo em um só lugar.',
  },
  twitter: {
    title: 'Notícias',
    description: 'Todas as notícias do mundo em um só lugar.',
  },
};

export default async function NewsPage() {
  const initialData = await getNews(1, 20).catch(() => ({
    data: [] as News[],
    meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
  }));

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <h1 className='font-display text-2xl font-bold text-foreground sm:text-3xl'>
          Notícias
        </h1>
        <p className='mt-2 text-muted-foreground'>
          Fique por dentro das últimas notícias do mundo.
        </p>
      </div>
      <NewsPageClient initialData={initialData} />
    </div>
  );
}
