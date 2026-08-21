'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Article, PaginatedResponse } from '@newranews/types';
import { useArticleList } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { ArticleGrid } from './article-grid';

interface ArticlePageClientProps {
  /** Opcional: prefetch que falha devolve `undefined`, não lista vazia. */
  initialData?: PaginatedResponse<Article>;
}

export function ArticlePageClient({ initialData }: ArticlePageClientProps) {
  const t = useTranslations('article');
  const tCommon = useTranslations('common');
  const [page, setPage] = useState(1);

  const { data, isFetching, isError } = useArticleList(
    { page, limit: 9 },
    page === 1 ? initialData : undefined,
  );

  const articles = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 9, totalPages: 0 };

  function handlePageChange(newPage: number) {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className='flex flex-col gap-6'>
      {isError && (
        <p className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {t('loadError')}
        </p>
      )}
      <ArticleGrid
        articles={articles}
        isLoading={isFetching && articles.length === 0}
      />
      {meta.totalPages > 1 && (
        <div className='flex items-center justify-center gap-4'>
          <Button
            variant='outline'
            size='lg'
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isFetching}
          >
            {tCommon('previous')}
          </Button>
          <span className='text-sm text-muted-foreground'>
            {tCommon('pageXOfY', { page, total: meta.totalPages })}
          </span>
          <Button
            variant='outline'
            size='lg'
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= meta.totalPages || isFetching}
          >
            {tCommon('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
