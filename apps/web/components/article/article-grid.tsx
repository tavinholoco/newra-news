'use client';

import { useTranslations } from 'next-intl';
import type { Article } from '@newranews/types';
import { Skeleton } from '@/components/ui/skeleton';
import { ArticleHistoryCard } from './article-history-card';

interface ArticleGridProps {
  articles: Article[];
  isLoading?: boolean;
}

export function ArticleGrid({ articles, isLoading = false }: ArticleGridProps) {
  const t = useTranslations('article');

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className='flex flex-col gap-3 rounded-xl border p-4'>
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-2/3' />
            <Skeleton className='mt-auto h-3 w-1/2' />
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center'>
        <p className='font-display text-lg font-semibold text-foreground'>
          {t('emptyTitle')}
        </p>
        <p className='mt-1 text-sm text-muted-foreground'>
          {t('emptyDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
      {articles.map((article) => (
        <ArticleHistoryCard key={article.id} article={article} />
      ))}
    </div>
  );
}
