import { formatDeltaPercent } from '@/lib/format';

/**
 * A variação de um cartão de KPI (§4.2 do plano de observabilidade, item 1):
 * *"`45.6k` sozinho não diz nada e `45.6k, +12,5%` diz."*
 */
export interface KpiDelta {
  /** `+12,5%`, `−3%`, `0%` — já no locale. */
  text: string;
  direction: 'up' | 'down' | 'flat';
  /**
   * Se a direção é boa ou má depende do que se mede: notícia coletada subindo
   * é melhor, duração do pipeline subindo é pior. É o chamador que sabe.
   */
  tone: 'better' | 'worse' | 'neutral';
  /** `vs. média 7 d` — a linha de base, dita ao lado do número. */
  period: string;
}

interface KpiDeltaOptions {
  /** Em que direção o número melhora. O padrão é subir. */
  betterWhen?: 'up' | 'down';
  period: string;
  locale: string;
}

/**
 * Variações menores que isto saem como `flat`. O limiar é **o do
 * arredondamento do texto** (uma casa decimal: 0,05%): abaixo dele o
 * percentual imprime `0%`, e uma seta para cima ao lado de `0%` é
 * contradição; acima, `+0,3%` com uma seta neutra seria a contradição oposta.
 */
const FLAT_THRESHOLD = 0.0005;

/**
 * `null` quando não há comparação honesta — é o cartão **sem** chip, e não um
 * chip com `+∞%`. Ver `formatDeltaPercent`.
 */
export function kpiDelta(
  current: number | null | undefined,
  baseline: number | null | undefined,
  { betterWhen = 'up', period, locale }: KpiDeltaOptions,
): KpiDelta | null {
  const text = formatDeltaPercent(current, baseline, locale);
  if (text === null || current === null || current === undefined || !baseline) return null;

  const ratio = (current - baseline) / Math.abs(baseline);
  const direction = Math.abs(ratio) < FLAT_THRESHOLD ? 'flat' : ratio > 0 ? 'up' : 'down';
  const tone =
    direction === 'flat' ? 'neutral' : direction === betterWhen ? 'better' : 'worse';

  return { text, direction, tone, period };
}
