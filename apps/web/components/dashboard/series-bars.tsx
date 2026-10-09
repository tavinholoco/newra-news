'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toDateFormatLocale } from '@/lib/i18n';
import { chartColor } from './chart-colors';

export interface SeriesPoint {
  key: string;
  /** O rótulo do ponto — a data, já formatada para quem lê. */
  label: string;
  value: number;
}

interface SeriesBarsProps {
  points: SeriesPoint[];
  /** O nome acessível da série. */
  label: string;
  /**
   * O topo da escala, quando a grandeza tem um (as 24 h de um dia). Sem ele a
   * escala é o maior ponto — certo para contagem, errado para o que se lê
   * contra uma faixa: nove dias de 9 h viravam nove barras cheias, e a tela
   * não dizia se 9 h é muito (13.9, achado da captura do 13b).
   */
  scaleMax?: number;
  /** Uma linha de referência — o limiar que a série é lida contra. */
  reference?: { value: number; label: string };
}

/**
 * Barras verticais **na ordem dada** — a série temporal do §9 do plano de
 * observabilidade.
 *
 * É o irmão do `CategoryBars` que preserva a ordem, e existe em vez de um
 * parâmetro naquele componente porque a ordenação por valor é a razão de ele
 * existir: `byDay` ordenado por volume deixaria de ser uma linha do tempo. O
 * `byDay` do `/api/metrics/product` voltava desde a Fase 8 e nenhum componente
 * o desenhava — este é o primeiro.
 *
 * As barras são colunas de largura fluida (`flex-1`) para que 7, 30 ou 90
 * pontos caibam na mesma largura sem rolagem; os rótulos visíveis são só o
 * primeiro e o último, e cada barra carrega o seu num texto só para leitor de
 * tela — 90 rótulos visíveis não caberiam em 375 px e o `title` não é lido.
 */
export function SeriesBars({ points, label, scaleMax, reference }: SeriesBarsProps) {
  const t = useTranslations('dashboard');
  const locale = toDateFormatLocale(useLocale());

  const highest = Math.max(0, ...points.map((point) => point.value));
  // Um ponto acima do topo declarado estica a escala em vez de vazar da caixa.
  const max = scaleMax === undefined ? highest : Math.max(scaleMax, highest);

  if (points.length === 0 || highest === 0) {
    return <p className='text-sm text-muted-foreground'>{t('noData')}</p>;
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <div>
      {/* `relative` é o bloco de contenção da linha de referência — e dos
          `sr-only` das barras (armadilha 44). A linha mora fora do `<ol>`:
          não é um ponto da série. */}
      <div className='relative'>
        <ol aria-label={label} className='flex h-32 items-end gap-px border-b border-line'>
          {points.map((point) => (
            <li key={point.key} className='flex h-full min-w-0 flex-1 items-end'>
              <span className='sr-only'>
                {point.label}: {point.value.toLocaleString(locale)}
              </span>
              <div
                aria-hidden='true'
                className={`w-full rounded-t-sm ${chartColor(0).bg}`}
                style={{ height: `${(point.value / max) * 100}%` }}
              />
            </li>
          ))}
        </ol>
        {reference && (
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-x-0 border-t border-dashed border-line-strong'
            style={{ bottom: `${(reference.value / max) * 100}%` }}
          >
            <span className='absolute -top-4 right-0 text-xs text-ink-muted'>{reference.label}</span>
          </div>
        )}
      </div>
      <div aria-hidden='true' className='mt-1 flex justify-between text-xs text-ink-muted'>
        <span>{first.label}</span>
        {points.length > 1 && <span>{last.label}</span>}
      </div>
    </div>
  );
}
