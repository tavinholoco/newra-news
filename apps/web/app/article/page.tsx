import type { Metadata } from 'next';
import type { Article } from '@newranews/types';
import { getArticles } from '@/lib/api';
import { ArticlePageClient } from '@/components/article/article-page-client';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Histórico de Artigos',
  description: 'Todos os artigos diários gerados por IA sobre as principais notícias.',
  openGraph: {
    title: 'Histórico de Artigos',
    description: 'Todos os artigos diários gerados por IA sobre as principais notícias.',
  },
  twitter: {
    title: 'Histórico de Artigos',
    description: 'Todos os artigos diários gerados por IA sobre as principais notícias.',
  },
};

export default async function ArticleHistoryPage() {
  const initialData = await getArticles(1, 9).catch(() => ({
    data: [] as Article[],
    meta: { total: 0, page: 1, limit: 9, totalPages: 0 },
  }));

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <h1 className='font-display text-2xl font-bold text-foreground sm:text-3xl'>
          Histórico de Artigos
        </h1>
        <p className='mt-2 text-muted-foreground'>
          Todos os artigos diários gerados por IA sobre as principais notícias.
        </p>
      </div>
      <ArticlePageClient initialData={initialData} />
    </div>
  );
}
