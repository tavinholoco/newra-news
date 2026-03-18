'use client';

import { useState } from 'react';
import type { Category, News, PaginatedResponse } from '@newranews/types';
import { getNews } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { NewsFilters } from './news-filters';
import { NewsGrid } from './news-grid';
import { NewsSearch } from './news-search';

interface NewsPageClientProps {
  initialData: PaginatedResponse<News>;
}

export function NewsPageClient({ initialData }: NewsPageClientProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(initialData.data);
  const [meta, setMeta] = useState(initialData.meta);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchNews(params: {
    category: Category | null;
    search: string;
    page: number;
  }) {
    setIsLoading(true);
    try {
      const result = await getNews(
        params.page,
        20,
        params.category ?? undefined,
        params.search || undefined,
      );
      setData(result.data);
      setMeta(result.meta);
    } finally {
      setIsLoading(false);
    }
  }

  function handleCategoryChange(newCategory: Category | null) {
    setCategory(newCategory);
    setPage(1);
    void fetchNews({ category: newCategory, search, page: 1 });
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch);
    setPage(1);
    void fetchNews({ category, search: newSearch, page: 1 });
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    void fetchNews({ category, search, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className='flex flex-col gap-6'>
      <NewsSearch value={search} onChange={handleSearchChange} />
      <NewsFilters selected={category} onChange={handleCategoryChange} />
      <NewsGrid news={data} isLoading={isLoading} />
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
