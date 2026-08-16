'use client';

import { useTranslations } from 'next-intl';
import type { News } from '@newranews/types';
import { Skeleton } from '@/components/ui/skeleton';
import { NewsCard } from './news-card';

interface NewsGridProps {
  news: News[];
  isLoading?: boolean;
}

export function NewsGrid({ news, isLoading = false }: NewsGridProps) {
  const t = useTranslations('news');

  if (isLoading) {
    return (
      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className='flex flex-col gap-3'>
            <Skeleton className='aspect-video w-full rounded-xl' />
            <Skeleton className='h-4 w-1/4' />
            <Skeleton className='h-5 w-full' />
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-4 w-1/2' />
          </div>
        ))}
      </div>
    );
  }

  if (news.length === 0) {
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
      {news.map((item) => (
        <NewsCard key={item.id} news={item} />
      ))}
    </div>
  );
}
