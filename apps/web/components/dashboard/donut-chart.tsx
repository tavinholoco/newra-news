'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toDateFormatLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { chartColor } from './chart-colors';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** O nome acessível do gráfico — o que o `<svg>` anuncia. */
  label: string;
  /** O que vai no buraco do meio: o total, ou o número que importa. */
  center?: { value: string; caption?: string };
  /**
   * Mantém a ordem dada em vez de ordenar por valor. É o caso das **fatias
   * fixas** — as seis categorias de erro vêm sempre, na ordem da taxonomia,
   * e reordená-las a cada janela faria a mesma cor mudar de categoria.
   */
  keepOrder?: boolean;
  /** O texto do estado vazio; o padrão é o mesmo do `CategoryBars`. */
  emptyText?: string;
}

/** Geometria do arco: raio e o comprimento que o `stroke-dasharray` recorta. */
const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Rosquinha em SVG inline, no padrão da §4.3 do plano de observabilidade.
 *
 * Responde **"que parte do todo?"** — e só isso. Série temporal é o
 * `SeriesBars`; grandeza independente (latência por rota) é tabela. Não há
 * biblioteca de gráfico e não entra nenhuma: a CSP e o orçamento de bundle não
 * pagam por um `<circle>` com `stroke-dasharray`.
 *
 * As regras que a §4.3 lista, e o motivo de cada uma:
 *
 * - **legenda com valor e porcentagem ao lado de cada fatia** — cor sozinha não
 *   codifica informação, e a paleta tem cinco cores para até oito fatias;
 * - **`role='img'` com `aria-label` no `<svg>`**, e o dado na legenda, que é
 *   lista de verdade: o leitor de tela ouve o nome do gráfico uma vez e os
 *   números uma vez;
 * - **fatia única em 100% desenhada à mão** — `stroke-dasharray` com o arco
 *   inteiro não desenha nada em alguns navegadores (armadilha 15 do §17), então
 *   ela vira um círculo sem recorte;
 * - **sem animação de entrada**: o `prefers-reduced-motion` do `globals.css`
 *   cobre CSS, e não há o que cobrir aqui porque não há transição.
 */
export function DonutChart({ slices, label, center, keepOrder = false, emptyText }: DonutChartProps) {
  const t = useTranslations('dashboard');
  const locale = toDateFormatLocale(useLocale());

  const ordered = keepOrder ? slices : [...slices].sort((a, b) => b.value - a.value);
  const total = ordered.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return <p className='text-sm text-muted-foreground'>{emptyText ?? t('noData')}</p>;
  }

  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const drawn = ordered.filter((slice) => slice.value > 0);

  let offset = 0;
  const arcs = drawn.map((slice) => {
    const index = ordered.indexOf(slice);
    const length = (slice.value / total) * CIRCUMFERENCE;
    const arc = { slice, index, length, offset };
    offset += length;
    return arc;
  });

  return (
    <div className='flex flex-col items-center gap-6 sm:flex-row sm:items-center'>
      <svg
        viewBox='0 0 100 100'
        role='img'
        aria-label={label}
        className='h-36 w-36 shrink-0'
      >
        {arcs.length === 1 ? (
          // Uma fatia só: o círculo inteiro, sem recorte.
          <circle
            cx='50'
            cy='50'
            r={RADIUS}
            fill='none'
            strokeWidth='14'
            className={chartColor(arcs[0]!.index).stroke}
          />
        ) : (
          arcs.map(({ slice, index, length, offset: start }) => (
            <circle
              key={slice.key}
              cx='50'
              cy='50'
              r={RADIUS}
              fill='none'
              strokeWidth='14'
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-start}
              transform='rotate(-90 50 50)'
              className={chartColor(index).stroke}
            />
          ))
        )}
        {center && (
          <>
            <text
              x='50'
              y={center.caption ? 47 : 50}
              textAnchor='middle'
              dominantBaseline='central'
              className='fill-ink font-display text-[15px] font-bold'
            >
              {center.value}
            </text>
            {center.caption && (
              <text
                x='50'
                y='61'
                textAnchor='middle'
                dominantBaseline='central'
                className='fill-ink-muted text-[7px] uppercase tracking-wider'
              >
                {center.caption}
              </text>
            )}
          </>
        )}
      </svg>

      <ul className='flex min-w-0 flex-1 flex-col gap-1.5 self-stretch justify-center text-sm'>
        {ordered.map((slice, index) => (
          <li key={slice.key} className='flex items-center gap-2'>
            <span
              aria-hidden='true'
              className={cn('h-2.5 w-2.5 shrink-0 rounded-full', chartColor(index).bg)}
            />
            <span className='min-w-0 flex-1 truncate text-ink-secondary'>{slice.label}</span>
            <span className='shrink-0 tabular-nums text-ink'>
              {slice.value.toLocaleString(locale)}
            </span>
            <span className='w-11 shrink-0 text-right tabular-nums text-ink-muted'>
              {percent.format(slice.value / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
