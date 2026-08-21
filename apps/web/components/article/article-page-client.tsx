'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Article, PaginatedResponse } from '@newranews/types';
import { useArticleList } from '@/lib/queries';
import { Pagination } from '@/components/editorial/pagination';
import { ArticleGrid } from './article-grid';

interface ArticlePageClientProps {
  /** Opcional: prefetch que falha devolve `undefined`, não lista vazia. */
  initialData?: PaginatedResponse<Article>;
}

export function ArticlePageClient({ initialData }: ArticlePageClientProps) {
  const t = useTranslations('article');
  const tPagination = useTranslations('pagination');
  // Página em estado local, não na URL: a ficha da tela escopa `/article` a
  // ritmo visual, e ler a query string aqui exigiria uma fronteira de Suspense
  // numa página que não precisa de nenhuma. Diverge de `/news`, que **é**
  // compartilhável por contrato — anotado como dívida consciente.
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
      {isError ? (
        <p className='rounded-md border border-danger/30 px-4 py-3 text-body-sm text-danger'>
          {t('loadError')}
        </p>
      ) : null}
      <ArticleGrid
        articles={articles}
        isLoading={isFetching && articles.length === 0}
      />
      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        disabled={isFetching}
        label={tPagination('historyLabel')}
        onChange={handlePageChange}
      />
    </div>
  );
}
