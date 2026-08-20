'use client';

import { useTranslations } from 'next-intl';
import { Loader2, Play, Trash2 } from 'lucide-react';
import { useDeleteNews, useNewsList, useRunPipeline } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminPanel() {
  const t = useTranslations('admin');

  const runPipeline = useRunPipeline();
  const deleteNews = useDeleteNews();
  const newsQuery = useNewsList({ page: 1, limit: 20 });

  return (
    <div className='space-y-10'>
      <section className='rounded-lg border border-border bg-card p-6'>
        <h2 className='font-display mb-1 text-lg font-semibold text-foreground'>
          {t('runPipeline')}
        </h2>
        <p className='mb-4 text-sm text-muted-foreground'>{t('runPipelineHint')}</p>

        <Button
          onClick={() => runPipeline.mutate()}
          disabled={runPipeline.isPending}
        >
          {runPipeline.isPending ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Play className='mr-2 h-4 w-4' />
          )}
          {runPipeline.isPending ? t('running') : t('runPipelineButton')}
        </Button>

        {runPipeline.isSuccess && (
          <p role='status' className='mt-4 text-sm text-success'>
            {t('runSuccess')}
          </p>
        )}
        {runPipeline.isError && (
          <p role='alert' className='mt-4 text-sm text-destructive'>
            {runPipeline.error?.message ?? t('runError')}
          </p>
        )}
      </section>

      <section>
        <h2 className='font-display mb-4 text-lg font-semibold text-foreground'>
          {t('newsListTitle')}
        </h2>

        {newsQuery.isLoading && !newsQuery.data ? (
          <div className='space-y-3'>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className='h-12 w-full' />
            ))}
          </div>
        ) : newsQuery.isError ? (
          <p role='alert' className='text-sm text-destructive'>
            {t('loadError')}
          </p>
        ) : (newsQuery.data?.data.length ?? 0) === 0 ? (
          <p className='text-sm text-muted-foreground'>{t('empty')}</p>
        ) : (
          <ul className='divide-y divide-border overflow-hidden rounded-lg border border-border bg-card'>
            {newsQuery.data?.data.map((news) => (
              <li
                key={news.id}
                className='flex items-center gap-4 px-4 py-3'
              >
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium text-foreground'>
                    {news.title}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {news.source} · {new Date(news.publishedAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => deleteNews.mutate(news.id)}
                  disabled={deleteNews.isPending}
                  aria-label={`${t('delete')}: ${news.title}`}
                >
                  {deleteNews.isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Trash2 className='h-4 w-4' />
                  )}
                  <span className='sr-only'>{t('delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        {deleteNews.isError && (
          <p role='alert' className='mt-2 text-sm text-destructive'>
            {t('deleteError')}
          </p>
        )}
        <p className='mt-2 text-xs text-muted-foreground'>
          {t('totalNews', { count: newsQuery.data?.meta.total ?? 0 })}
        </p>
      </section>
    </div>
  );
}
