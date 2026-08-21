'use client';

import { useTranslations } from 'next-intl';
import { SearchX } from 'lucide-react';

interface NewsEmptyStateProps {
  /** O termo buscado, se houver. É ele que decide qual das três mensagens vale. */
  search: string;
  /** Quantos filtros estão ativos, busca inclusive. */
  activeFilters: number;
  onClear: () => void;
}

/**
 * O estado vazio da `/news` (§7: "estado vazio útil").
 *
 * "Nenhuma notícia encontrada" com um ícone triste não é útil: as três razões
 * de a lista estar vazia pedem saídas diferentes, e só uma delas é problema do
 * leitor.
 *
 * | Situação | O que a tela diz | A saída |
 * |---|---|---|
 * | busca sem resultado | o termo que falhou, entre aspas | limpar os filtros |
 * | filtro sem resultado | que a combinação é que não fecha | limpar os filtros |
 * | acervo vazio | que a coleta ainda não rodou | nenhuma — não há o que fazer |
 *
 * O terceiro caso é o que costuma faltar: sem filtro nenhum e sem matéria, o
 * botão "limpar filtros" mandaria o leitor limpar o que já está limpo.
 */
export function NewsEmptyState({
  search,
  activeFilters,
  onClear,
}: NewsEmptyStateProps) {
  const t = useTranslations('news');
  const term = search.trim();

  const title = term
    ? t('emptySearchTitle', { term })
    : activeFilters > 0
      ? t('emptyTitle')
      : t('emptyArchiveTitle');

  const description = term
    ? t('emptySearchDesc')
    : activeFilters > 0
      ? t('emptyFilterDesc')
      : t('emptyArchiveDesc');

  return (
    <div className='flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-16 text-center'>
      <SearchX className='size-8 text-ink-muted' aria-hidden='true' />
      <p className='mt-4 font-display text-h4 font-bold text-ink'>{title}</p>
      <p className='mt-2 max-w-prose text-body-sm text-ink-secondary'>
        {description}
      </p>

      {activeFilters > 0 ? (
        <button
          type='button'
          onClick={onClear}
          className='mt-6 inline-flex h-10 items-center rounded-md bg-brand-solid px-4 text-body-sm font-semibold text-on-brand transition-colors duration-fast hover:bg-brand-solid-hover'
        >
          {t('browseAll')}
        </button>
      ) : null}
    </div>
  );
}
