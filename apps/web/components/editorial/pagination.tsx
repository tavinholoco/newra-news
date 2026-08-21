'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Desabilita os controles enquanto a página seguinte está a caminho. */
  disabled?: boolean;
  /** Nome da região para o leitor de tela. A tela sabe do que é a lista. */
  label: string;
  onChange: (page: number) => void;
}

/** Quantos números aparecem além do primeiro, do último e do atual. */
const WINDOW = 1;

/** Até aqui a faixa inteira cabe, e cortar seria esconder o que já era visível. */
const MAX_PLAIN = 7;

/**
 * As páginas visíveis, com `null` onde há corte.
 *
 * Primeira e última sempre aparecem — são os dois destinos que alguém procura
 * de verdade numa lista longa — mais uma vizinhança da página atual. O acervo
 * passa de 180 páginas; imprimir todas seria uma faixa de números impossível de
 * mirar, no mouse e mais ainda no toque.
 */
export function paginationRange(
  page: number,
  totalPages: number,
): Array<number | null> {
  if (totalPages <= MAX_PLAIN) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);
  for (let offset = -WINDOW; offset <= WINDOW; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= totalPages) pages.add(candidate);
  }

  const sorted = [...pages].sort((a, b) => a - b);

  return sorted.flatMap((value, index) => {
    const previous = sorted[index - 1];
    // Buraco de exatamente uma página vira o número, não reticências: "1 … 3"
    // esconde a página 2 atrás de um símbolo mais largo que ela.
    if (previous !== undefined && value - previous === 2) {
      return [value - 1, value];
    }
    return previous !== undefined && value - previous > 2 ? [null, value] : [value];
  });
}

/**
 * Paginação numerada, usada pelo acervo (§7) e pelo histórico de briefings.
 *
 * Numerada e não "carregar mais": em `/news` a página está na URL, então um
 * resultado é compartilhável e o botão Voltar devolve a página certa. Rolagem
 * infinita fecharia as duas coisas e ainda deixaria o rodapé inalcançável.
 *
 * Vive em `editorial/` e não em `news/` porque não sabe nada sobre notícia — as
 * duas listas do produto paginam igual, e duas cópias divergiriam na primeira
 * correção de acessibilidade.
 */
export function Pagination({
  page,
  totalPages,
  disabled = false,
  label,
  onChange,
}: PaginationProps) {
  const t = useTranslations('pagination');
  const tCommon = useTranslations('common');

  if (totalPages <= 1) return null;

  const arrow =
    'inline-flex size-9 items-center justify-center rounded-md border border-line text-ink-secondary transition-colors duration-fast hover:border-line-strong hover:text-link disabled:pointer-events-none disabled:opacity-50';

  return (
    <nav aria-label={label} className='flex items-center justify-center gap-1.5'>
      <button
        type='button'
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
        aria-label={tCommon('previous')}
        className={arrow}
      >
        <ChevronLeft className='size-4' aria-hidden='true' />
      </button>

      {paginationRange(page, totalPages).map((value, index) =>
        value === null ? (
          <span
            key={`gap-${index}`}
            aria-hidden='true'
            className='px-1 text-body-sm text-ink-muted'
          >
            …
          </span>
        ) : (
          <button
            key={value}
            type='button'
            onClick={() => onChange(value)}
            disabled={disabled}
            aria-current={value === page ? 'page' : undefined}
            aria-label={
              value === page
                ? t('currentPage', { page: value })
                : t('goToPage', { page: value })
            }
            className={cn(
              'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-body-sm font-medium tabular-nums transition-colors duration-fast disabled:pointer-events-none',
              value === page
                ? 'border-transparent bg-brand-solid text-on-brand'
                : 'border-line text-ink-secondary hover:border-line-strong hover:text-link',
            )}
          >
            {value}
          </button>
        ),
      )}

      <button
        type='button'
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= totalPages}
        aria-label={tCommon('next')}
        className={arrow}
      >
        <ChevronRight className='size-4' aria-hidden='true' />
      </button>
    </nav>
  );
}
