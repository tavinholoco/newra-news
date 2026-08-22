'use client';

import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import type { NewsFavorite } from '@newranews/types';
import { useFavorites } from '@/lib/queries';
import { NewsCard } from '@/components/news/news-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function FavoritesList() {
  const t = useTranslations('favorites');
  const tCommon = useTranslations('common');
  // Pede **só** o que esta tela sabe desenhar. O briefing salvo já existe no
  // banco e na API; o card editorial dele entra junto com o redesenho da tela,
  // e até lá pedir tudo para descartar metade seria a lista mentindo sobre o
  // que o leitor salvou.
  const { data, isLoading, isError, refetch } = useFavorites({ type: 'NEWS' });

  if (isLoading && !data) {
    return (
      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className='space-y-3'>
            <Skeleton className='aspect-[16/9] w-full rounded-lg' />
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-4 w-1/2' />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role='alert'
        className='rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center'
      >
        <p className='mb-4 text-muted-foreground'>
          {t('loadError')}
        </p>
        <Button variant='outline' onClick={() => void refetch()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const favorites = (data?.data ?? []).filter(
    (favorite): favorite is NewsFavorite => favorite.itemType === 'NEWS',
  );

  if (favorites.length === 0) {
    return (
      <div className='rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center'>
        <Heart className='mx-auto mb-3 h-8 w-8 text-line-strong' />
        <p className='text-ink-secondary'>
          {t('emptyTitle')}
        </p>
        <p className='mt-1 text-body-sm text-ink-muted'>
          {t('emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
      {favorites.map((favorite) => (
        <NewsCard key={favorite.itemId} news={favorite.news} />
      ))}
    </div>
  );
}
