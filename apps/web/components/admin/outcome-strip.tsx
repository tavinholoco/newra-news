'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { DayOutcome, OutcomeDay } from '@/lib/outcome-days';
import { formatCalendarDay, formatList } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { DayStrip } from './day-strip';

/**
 * A faixa de 30 dias do pipeline — um quadrado por dia, colorido por
 * desfecho. (§12 do plano de observabilidade, Fase 8)
 *
 * Verde é sucesso, laranja é sucesso degradado, vermelho é falha, **vazado é
 * o dia que não rodou** — o estado que não existia em lugar nenhum até a
 * Fase 8. A casca (os trinta `<li>`, as pontas, a legenda) é a `DayStrip`,
 * extraída na Fase 11 para a faixa por fonte reusá-la; o que mora aqui é o
 * mapeamento do desfecho de **run** para cor, forma e texto.
 */

/**
 * As chaves de mensagem por desfecho, escritas por extenso — chave montada em
 * runtime parece órfã para o `i18n-messages.test.ts`. Os três de run reusam
 * as chaves de status que a tela já tinha; `SUCCESS_DEGRADED` e `NEVER_RAN`
 * são os dois valores novos.
 */
export const OUTCOME_MESSAGE_KEY = {
  RUNNING: 'pipeline.statusRunning',
  SUCCESS: 'pipeline.statusSuccess',
  SUCCESS_DEGRADED: 'pipeline.statusDegraded',
  FAILED: 'pipeline.statusFailed',
  NEVER_RAN: 'pipeline.statusNeverRan',
} as const satisfies Record<DayOutcome, string>;

/**
 * O preenchimento de cada quadrado, semântico dos dois lados do tema — e a
 * forma carrega o estado junto com a cor.
 *
 * `SUCCESS_DEGRADED` é contorno laranja com o miolo fraco, e não laranja
 * cheio: **a primeira captura desta faixa, no tema escuro, mostrou o degradado
 * (`ember-500`) e o falhou (`danger-400`) na mesma cor a olho** — os dois são
 * quentes ali, e um quadrado de 20 px não tem onde mais diferir. O contorno
 * com miolo claro lê como "menos que cheio", que é o que o estado é; o
 * laranja é o **de preenchimento** (`brand-accent`, permitido sem texto
 * dentro), e a versão em texto do mesmo estado, na pílula da linha, é
 * `text-link` — a regra do `WARN` na lista de eventos. `NEVER_RAN` é só borda
 * neutra: vazado é o desenho de "nada aqui", e o cinza cheio fica para
 * `RUNNING`, que é "ainda não se sabe".
 */
const OUTCOME_FILL: Record<DayOutcome, string> = {
  RUNNING: 'bg-line-strong',
  SUCCESS: 'bg-success',
  SUCCESS_DEGRADED: 'border-2 border-brand-accent bg-brand-accent/25',
  FAILED: 'bg-danger',
  NEVER_RAN: 'border border-line-strong',
};

const LEGEND: DayOutcome[] = ['SUCCESS', 'SUCCESS_DEGRADED', 'FAILED', 'NEVER_RAN'];

interface OutcomeStripProps {
  days: OutcomeDay[];
}

export function OutcomeStrip({ days }: OutcomeStripProps) {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());

  const first = days[0];
  const last = days[days.length - 1];
  // `RUNNING` só entra na legenda quando há um quadrado assim: é estado de
  // minutos, e uma legenda que o anuncia todo dia ensina a ignorá-lo.
  const legend = days.some((day) => day.outcome === 'RUNNING') ? [...LEGEND, 'RUNNING' as const] : LEGEND;

  const describe = (day: OutcomeDay): string => {
    const base = t('pipeline.dayOutcome', {
      date: formatCalendarDay(day.date, locale),
      outcome: t(OUTCOME_MESSAGE_KEY[day.outcome]),
    });
    if (day.degradedBy.length === 0) return base;
    return `${base} — ${t('pipeline.degradedBy', {
      count: day.degradedBy.length,
      stages: formatList(day.degradedBy.map(String), locale),
    })}`;
  };

  return (
    <DayStrip
      label={t('pipeline.stripLabel', { days: days.length })}
      days={days.map((day) => ({
        key: day.date,
        fill: OUTCOME_FILL[day.outcome],
        label: describe(day),
      }))}
      ends={
        first && last
          ? { first: formatCalendarDay(first.date, locale), last: formatCalendarDay(last.date, locale) }
          : undefined
      }
      legend={legend.map((outcome) => ({
        key: outcome,
        fill: OUTCOME_FILL[outcome],
        label: t(OUTCOME_MESSAGE_KEY[outcome]),
      }))}
    />
  );
}
