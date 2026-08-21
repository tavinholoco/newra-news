'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import type { NewsFacets, NewsSort } from '@newranews/types';
import { NEWS_PERIODS, type NewsPeriod } from '@/lib/news-filters';
import { cn } from '@/lib/utils';

interface NewsFilterBarProps {
  source: string | null;
  period: NewsPeriod;
  sort: NewsSort;
  facets?: NewsFacets;
  activeFilters: number;
  onChange: (patch: {
    source?: string | null;
    period?: NewsPeriod;
    sort?: NewsSort;
  }) => void;
  onClear: () => void;
  className?: string;
}

/** Estilo dos três controles — idêntico, porque eles são a mesma coisa. */
const SELECT_CLASS =
  'h-9 rounded-md border border-line bg-surface px-2.5 text-body-sm text-ink transition-colors duration-fast hover:border-line-strong focus-visible:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Fonte, período e ordenação — as dimensões da §7 que não cabem em pílula.
 *
 * **`<select>` nativo, não um dropdown desenhado.** Teclado, leitor de tela e
 * o seletor do sistema no mobile vêm de graça e corretos; um popover próprio
 * seria três dias de trabalho para reimplementar o que o navegador já faz, e a
 * §15 cobra exatamente esse comportamento. O visual fica coerente pelos tokens
 * de borda, superfície e raio.
 *
 * A lista de fontes vem das facetas, não de uma constante: o acervo muda de
 * fonte quando o pipeline muda de feed, e uma lista fixa começaria a oferecer
 * filtro que não devolve nada.
 */
export function NewsFilterBar({
  source,
  period,
  sort,
  facets,
  activeFilters,
  onChange,
  onClear,
  className,
}: NewsFilterBarProps) {
  const t = useTranslations('news');
  const tPeriod = useTranslations('newsPeriod');
  const tSort = useTranslations('newsSort');
  // Os controles do shell aparecem duas vezes na árvore em algumas telas —
  // `id` fixo colidiria e o `<label>` apontaria para o elemento errado.
  const ids = useId();

  const sources = facets?.sources ?? [];

  return (
    <div
      role='group'
      aria-label={t('filtersLabel')}
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-3', className)}
    >
      {/* A fonte só aparece quando há mais de uma para escolher: um seletor de
          um item só é decoração que ocupa uma coluna. */}
      {sources.length > 1 ? (
        <div className='flex items-center gap-2'>
          <label
            htmlFor={`${ids}-source`}
            className='text-meta font-medium uppercase tracking-wide text-ink-muted'
          >
            {t('sourceLabel')}
          </label>
          <select
            id={`${ids}-source`}
            value={source ?? ''}
            onChange={(event) => onChange({ source: event.target.value || null })}
            className={cn(SELECT_CLASS, 'max-w-48')}
          >
            <option value=''>{t('sourceAll')}</option>
            {sources.map((row) => (
              <option key={row.source} value={row.source}>
                {row.source} ({row.count})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className='flex items-center gap-2'>
        <label
          htmlFor={`${ids}-period`}
          className='text-meta font-medium uppercase tracking-wide text-ink-muted'
        >
          {t('periodLabel')}
        </label>
        <select
          id={`${ids}-period`}
          value={period}
          onChange={(event) =>
            onChange({ period: event.target.value as NewsPeriod })
          }
          className={SELECT_CLASS}
        >
          {NEWS_PERIODS.map((value) => (
            <option key={value} value={value}>
              {tPeriod(value)}
            </option>
          ))}
        </select>
      </div>

      <div className='flex items-center gap-2'>
        <label
          htmlFor={`${ids}-sort`}
          className='text-meta font-medium uppercase tracking-wide text-ink-muted'
        >
          {t('sortLabel')}
        </label>
        <select
          id={`${ids}-sort`}
          value={sort}
          onChange={(event) => onChange({ sort: event.target.value as NewsSort })}
          className={SELECT_CLASS}
        >
          <option value='recent'>{tSort('recent')}</option>
          <option value='oldest'>{tSort('oldest')}</option>
        </select>
      </div>

      {activeFilters > 0 ? (
        <button
          type='button'
          onClick={onClear}
          className='ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body-sm font-medium text-link transition-colors duration-fast hover:text-link-hover'
        >
          <X className='size-3.5' aria-hidden='true' />
          {t('clearFilters')}
        </button>
      ) : null}
    </div>
  );
}
