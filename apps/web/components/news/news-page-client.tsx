'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Category, type News, type PaginatedResponse } from '@newranews/types';
import { useNewsList } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { NewsFilters } from './news-filters';
import { NewsGrid } from './news-grid';
import { NewsSearch } from './news-search';

interface NewsPageClientProps {
  initialData: PaginatedResponse<News>;
}

export function NewsPageClient({ initialData }: NewsPageClientProps) {
  const t = useTranslations('news');
  const tCommon = useTranslations('common');
  // A faixa de categorias do masthead e a busca do header chegam por query
  // string, e é o que torna `/news?category=…` compartilhável. Ainda é só a
  // **entrada**: escrever a URL a cada clique de filtro e de página é trabalho
  // da Fase 4 ("filter state" na §28).
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const urlCategory =
    categoryParam && categoryParam in Category
      ? (categoryParam as Category)
      : null;
  const urlSearch = searchParams.get('search') ?? '';

  const [category, setCategory] = useState<Category | null>(urlCategory);
  const [search, setSearch] = useState(urlSearch);
  const [page, setPage] = useState(1);

  // Navegar de `/news?category=A` para `?category=B` não remonta o componente,
  // então o inicializador do `useState` não roda de novo — sem isto a URL
  // mudava e a lista ficava na categoria anterior.
  useEffect(() => {
    setCategory(urlCategory);
    setSearch(urlSearch);
    setPage(1);
  }, [urlCategory, urlSearch]);

  const { data, isFetching, isError } = useNewsList(
    {
      page,
      limit: 20,
      category: category ?? undefined,
      search: search || undefined,
    },
    // O `initialData` do servidor é a primeira página sem filtro; com
    // categoria ou busca na URL ele não corresponde ao que se pede.
    page === 1 && !category && !search ? initialData : undefined,
  );

  const news = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 0 };

  function handleCategoryChange(newCategory: Category | null) {
    setCategory(newCategory);
    setPage(1);
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch);
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className='flex flex-col gap-6'>
      <NewsSearch value={search} onChange={handleSearchChange} />
      <NewsFilters selected={category} onChange={handleCategoryChange} />
      {isError && (
        <p className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          {t('loadError')}
        </p>
      )}
      <NewsGrid news={news} isLoading={isFetching && news.length === 0} />
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
