'use client';

import { useTranslations } from 'next-intl';
import { Category, type NewsFacets } from '@newranews/types';
import { cn } from '@/lib/utils';

interface CategoryNavProps {
  selected: Category | null;
  /** Contagem por categoria; `undefined` enquanto a primeira resposta não chega. */
  facets?: NewsFacets;
  /**
   * As facetas contam o **acervo**. Quando a lista vem de outra fonte — o
   * recorte de salvos —, o número deixa de ser o que o clique devolve, e aí ele
   * some: pílula sem contagem continua sendo um filtro utilizável, pílula com
   * contagem errada é uma promessa quebrada.
   */
  showCounts?: boolean;
  onChange: (category: Category | null) => void;
  className?: string;
}

/**
 * O filtro de categoria do acervo (§7 do plano, ficha da tela em
 * `docs/v2/02-sitemap-telas.md`).
 *
 * **Não é o `editorial-nav`.** Aquele é a linha 3 do masthead: navegação, em
 * todas as telas, sublinhado como indicador. Este é controle de filtro dentro
 * de `/news`, e por isso é pílula com estado preenchido e **contagem** — o
 * número é o que diz ao leitor se vale trocar de categoria antes de clicar.
 *
 * São `<button>` e não `<a>` porque a mudança acontece sem recarregar a lista
 * inteira; a URL é escrita por quem chama (`useNewsFilters`), então a tela
 * continua compartilhável.
 */
export function CategoryNav({
  selected,
  facets,
  showCounts = true,
  onChange,
  className,
}: CategoryNavProps) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');

  const counts = new Map(
    showCounts ? facets?.categories.map((row) => [row.category, row.count]) : [],
  );

  // A soma das facetas, e **não** `facets.total`: cada pílula promete quantas
  // matérias o clique dela devolve, e o clique em "Todas" tira o filtro de
  // categoria. `total` já o aplica — com Mundo selecionado, "Todas" mostraria
  // o número de Mundo e depois abriria o acervo inteiro. Os demais filtros
  // (busca, fonte, período) continuam valendo nos dois, porque o clique não
  // mexe neles.
  const allCount =
    facets && showCounts
      ? facets.categories.reduce((sum, row) => sum + row.count, 0)
      : undefined;

  const items: Array<{ key: Category | null; label: string; count?: number }> = [
    { key: null, label: tCommon('all'), count: allCount },
    ...Object.values(Category).map((category) => ({
      key: category,
      label: t(category),
      count: showCounts ? (counts.get(category) ?? 0) : undefined,
    })),
  ];

  return (
    <div
      className={cn(
        // Rolagem horizontal no mobile, como a faixa do masthead: esconder a
        // categoria atual atrás de um menu é o que a §10 proíbe.
        '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item) => {
        const active = selected === item.key;

        return (
          <button
            key={item.key ?? 'all'}
            type='button'
            onClick={() => onChange(item.key)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-body-sm font-medium transition-colors duration-fast',
              active
                ? 'border-transparent bg-brand-solid text-on-brand'
                : 'border-line text-ink-secondary hover:border-line-strong hover:text-link',
            )}
          >
            {item.label}
            {item.count === undefined ? null : (
              // `aria-hidden`: o leitor de tela já anuncia o rótulo e o estado;
              // o número é orientação visual sobre onde há matéria, e lê-lo
              // colado no nome ("Esportes 41") soa como parte do nome.
              <span
                aria-hidden='true'
                className={cn(
                  'text-meta tabular-nums',
                  active ? 'text-on-brand' : 'text-ink-muted',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
