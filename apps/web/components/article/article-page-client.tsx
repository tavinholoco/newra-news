'use client';

import { useState } from 'react';
import type { Article, PaginatedResponse } from '@newranews/types';
import { getArticles } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArticleGrid } from './article-grid';

interface ArticlePageClientProps {
  initialData: PaginatedResponse<Article>;
}

export function ArticlePageClient({ initialData }: ArticlePageClientProps) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(initialData.data);
  const [meta, setMeta] = useState(initialData.meta);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchArticles(newPage: number) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getArticles(newPage, 9);
      setData(result.data);
      setMeta(result.meta);
    } catch {
      setError('Não foi possível carregar os artigos. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    void fetchArticles(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className='flex flex-col gap-6'>
      {error && (
        <p className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {error}
        </p>
      )}
      <ArticleGrid articles={data} isLoading={isLoading} />
      {meta.totalPages > 1 && (
        <div className='flex items-center justify-center gap-4'>
          <Button
            variant='outline'
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            Anterior
          </Button>
          <span className='text-sm text-muted-foreground'>
            Página {page} de {meta.totalPages}
          </span>
          <Button
            variant='outline'
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= meta.totalPages || isLoading}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
