'use client';

import { useCallback, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * O estado de ordenação de uma tabela e o gesto que o muda — extraído da
 * tabela de falhas do 5c quando a tabela de fontes (Fase 11) virou a segunda
 * ordenável do admin.
 *
 * O gesto é o da referência (§4.2, item 4): clicar na coluna ativa inverte a
 * direção; clicar noutra a torna ativa **descendente** — "o maior primeiro" é
 * a pergunta que se faz a uma tabela de contagem.
 */
export function useSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const toggle = useCallback((key: K) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: 'desc' },
    );
  }, []);

  return useMemo(() => ({ sort, toggle }), [sort, toggle]);
}

/** Ordena uma cópia pela comparação dada, na direção do estado. */
export function sortBy<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  compare: (a: T, b: T, key: K) => number,
): T[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => sign * compare(a, b, sort.key));
}

interface SortableHeaderProps<K extends string> {
  sortKey: K;
  label: string;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  align?: 'left' | 'right';
}

/**
 * Um `<th>` ordenável: `aria-sort` na célula ativa e um botão com o rótulo e
 * a seta. A seta esmaecida nas colunas inativas é o que diz "isto também
 * ordena" sem uma legenda.
 */
export function SortableHeader<K extends string>({
  sortKey,
  label,
  sort,
  onToggle,
  align = 'right',
}: SortableHeaderProps<K>) {
  const active = sort.key === sortKey;
  return (
    <th
      scope='col'
      aria-sort={active ? (sort.direction === 'desc' ? 'descending' : 'ascending') : undefined}
      className={cn('px-3 py-2 font-medium', align === 'right' ? 'text-right' : 'text-left')}
    >
      <button
        type='button'
        onClick={() => onToggle(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wider transition-colors duration-base hover:text-link',
          active && 'text-link',
        )}
      >
        {label}
        <ChevronDown
          aria-hidden='true'
          className={cn('h-3 w-3', !active && 'opacity-40', active && sort.direction === 'asc' && 'rotate-180')}
        />
      </button>
    </th>
  );
}
