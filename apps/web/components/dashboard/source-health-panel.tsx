'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SourceKind } from '@newranews/types';
import { useSourceHealth } from '@/lib/queries';
import { formatCalendarDay, formatCount, formatMilliseconds } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { kpiDelta } from '@/lib/kpi';
import {
  SOURCE_WINDOW_DAYS,
  reportStats,
  sourceAlerts,
  type SourceAlert,
  type SourceCalendarDay,
  type SourceDayState,
  type SourceStats,
} from '@/lib/source-days';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { DayStrip } from '@/components/admin/day-strip';
import { SortableHeader, sortBy, useSort } from '@/components/admin/sortable-header';
import { DeltaChip } from './metric-card';
import { DonutChart } from './donut-chart';

/**
 * O painel "Fontes" da aba Métricas (§15 do plano de observabilidade, Fase 11
 * — PR 11c). Responde às três perguntas que até aqui não tinham resposta:
 * "há quantos dias a Superinteressante está fora?", "esta fonte entrega menos
 * do que entregava?", "vale a pena trocar este provedor?".
 *
 * Três peças, na ordem em que se lê: **os alertas** (só quando um dos dois
 * gatilhos da §15 disparou — linha que aparece todo dia ensina a ignorá-la),
 * **a tabela por fonte** no formato da referência (§4.2, item 4 — colunas
 * ordenáveis, é assim que se acha a fonte que definhou), com a faixa de 30
 * dias por linha, e **a rosquinha de contribuição** por `kept`, que é o
 * retrato de "de que eu realmente dependo".
 *
 * **A API devolve só os dias com linha; tudo o mais é derivado aqui**
 * (`lib/source-days.ts`), como o desfecho por dia da Fase 8: o dia "não
 * tentado" pela ausência, as médias sobre os dias tentados, a sequência de
 * falhas que um dia sem run não quebra.
 *
 * **Rota nova, e o preview da `dev` lê a API de produção** (armadilha 37):
 * até a promoção o `/api/admin/sources` responde 404 ali, e este painel
 * desenha "indisponível" — nunca quebra a aba inteira.
 */

/**
 * As chaves de mensagem por estado, escritas por extenso — chave montada em
 * runtime parece órfã para o `i18n-messages.test.ts`.
 */
const STATE_MESSAGE_KEY = {
  OK: 'sources.stateOk',
  EMPTY: 'sources.stateEmpty',
  FAILED: 'sources.stateFailed',
  NOT_ATTEMPTED: 'sources.stateNotAttempted',
} as const satisfies Record<SourceDayState, string>;

/**
 * O preenchimento de cada quadrado, e a forma carrega o estado (armadilha 35):
 * `OK` é verde cheio, `FAILED` vermelho cheio, `EMPTY` **cinza cheio** — a
 * fonte foi perguntada e não tinha nada — e `NOT_ATTEMPTED` **vazado**, como o
 * `NEVER_RAN` do run: ninguém perguntou. Dois cinzas, duas formas.
 */
const STATE_FILL: Record<SourceDayState, string> = {
  OK: 'bg-success',
  EMPTY: 'bg-line-strong',
  FAILED: 'bg-danger',
  NOT_ATTEMPTED: 'border border-line-strong',
};

/** A pílula de "hoje": `EMPTY` e `NOT_ATTEMPTED` em texto secundário — só o falhou é vermelho. */
const STATE_TONE: Record<SourceDayState, string> = {
  OK: 'border-success/40 text-success',
  EMPTY: 'border-line-strong text-ink-secondary',
  FAILED: 'border-danger/40 text-danger',
  NOT_ATTEMPTED: 'border-dashed border-line-strong text-ink-muted',
};

const LEGEND: SourceDayState[] = ['OK', 'EMPTY', 'FAILED', 'NOT_ATTEMPTED'];

const KIND_MESSAGE_KEY = {
  RSS: 'sources.kindRss',
  AGGREGATOR: 'sources.kindAggregator',
} as const satisfies Record<SourceKind, string>;

type SortKey = 'source' | 'keptToday' | 'keptAvg7' | 'keptAvg30' | 'keptChange' | 'failedStreak' | 'latencyMs';

const SORT_HEADER_KEY = {
  source: 'sources.colSource',
  keptToday: 'sources.colKeptToday',
  keptAvg7: 'sources.colKeptAvg7',
  keptAvg30: 'sources.colKeptAvg30',
  keptChange: 'sources.colChange',
  failedStreak: 'sources.colFailedStreak',
  latencyMs: 'sources.colLatency',
} as const satisfies Record<SortKey, string>;

/** `null` ordena por último em qualquer direção: "sem amostra" não é menor que zero. */
function compareNullable(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a - b;
}

function compare(a: SourceStats, b: SourceStats, key: SortKey): number {
  switch (key) {
    case 'source':
      return a.source.localeCompare(b.source);
    case 'keptToday':
      return (a.today.day?.kept ?? 0) - (b.today.day?.kept ?? 0);
    case 'failedStreak':
      return a.failedStreak - b.failedStreak;
    default:
      return compareNullable(a[key], b[key]);
  }
}

/** Da oitava fatia em diante a cauda vira "Outras" — 8 é o limite da rosquinha (§4.3). */
const DONUT_SLICES = 7;

function SourcesSkeleton() {
  return (
    <div className='flex flex-col gap-6'>
      <div className='overflow-hidden rounded-lg border border-border'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className='flex items-center gap-4 border-b border-border px-3 py-3 last:border-b-0'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-4 w-16' />
            <Skeleton className='h-3 flex-1' />
          </div>
        ))}
      </div>
      <div className='flex gap-6'>
        <Skeleton className='h-36 w-36 rounded-full' />
        <Skeleton className='h-36 flex-1' />
      </div>
    </div>
  );
}

export function SourceHealthPanel() {
  const t = useTranslations('dashboard');
  const locale = toDateFormatLocale(useLocale());
  const { data, isPending, isError } = useSourceHealth(SOURCE_WINDOW_DAYS);

  const stats = useMemo(() => (data ? reportStats(data) : []), [data]);
  const alerts = useMemo(() => sourceAlerts(stats), [stats]);
  const { sort, toggle } = useSort<SortKey>({ key: 'keptAvg30', direction: 'desc' });
  const rows = useMemo(() => sortBy(stats, sort, compare), [stats, sort]);

  if (isError) {
    return <p className='text-sm text-muted-foreground'>{t('sources.unavailable')}</p>;
  }
  if (isPending || !data) {
    return <SourcesSkeleton />;
  }
  if (stats.length === 0) {
    return <p className='text-sm text-muted-foreground'>{t('sources.empty')}</p>;
  }

  const describeDay = (day: SourceCalendarDay): string => {
    const base = t('sources.dayState', {
      date: formatCalendarDay(day.date, locale),
      state: t(STATE_MESSAGE_KEY[day.state]),
    });
    if (!day.day) return base;
    if (day.state === 'FAILED' && day.day.failureReason) return `${base} — ${day.day.failureReason}`;
    if (day.state === 'OK') {
      return `${base} — ${t('sources.dayKept', { kept: day.day.kept, fetched: day.day.fetched })}`;
    }
    return base;
  };

  const describeAlert = (alert: SourceAlert): string =>
    alert.kind === 'failed-streak'
      ? t('sources.alertFailedStreak', { source: alert.source, days: alert.days })
      : t('sources.alertWithering', {
          source: alert.source,
          ratio: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(alert.ratio),
        });

  const sortHeader = (key: SortKey, align: 'left' | 'right' = 'right') => (
    <SortableHeader sortKey={key} label={t(SORT_HEADER_KEY[key])} sort={sort} onToggle={toggle} align={align} />
  );

  const totalKept = stats.reduce((sum, entry) => sum + entry.keptTotal, 0);
  const byContribution = [...stats].sort((a, b) => b.keptTotal - a.keptTotal);
  const head = byContribution.slice(0, DONUT_SLICES);
  const tail = byContribution.slice(DONUT_SLICES);
  const slices = [
    ...head.map((entry) => ({ key: entry.source, label: entry.source, value: entry.keptTotal })),
    ...(tail.length > 0
      ? [{ key: 'others', label: t('sources.others', { count: tail.length }), value: tail.reduce((sum, e) => sum + e.keptTotal, 0) }]
      : []),
  ];

  const first = stats[0]?.calendar[0];
  const last = stats[0]?.calendar[stats[0].calendar.length - 1];

  return (
    <div className='flex flex-col gap-8'>
      {/**
        * Os dois gatilhos da §15, só quando dispararam. `role='status'`, e não
        * `alert`: é conteúdo da página, não interrupção — a lição da Fase 2.
        */}
      {alerts.length > 0 && (
        <ul role='status' aria-label={t('sources.alertsLabel')} className='flex flex-col gap-1 text-sm'>
          {alerts.map((alert) => (
            <li
              key={`${alert.kind}:${alert.source}`}
              className={cn('font-medium', alert.kind === 'failed-streak' ? 'text-danger' : 'text-link')}
            >
              {describeAlert(alert)}
            </li>
          ))}
        </ul>
      )}

      {/* `relative`: os `sr-only` da faixa por fonte são absolutos — ver `error-groups-table`. */}
      <div className='relative overflow-x-auto rounded-lg border border-border'>
        <table className='w-full text-sm' aria-label={t('sources.title')}>
          <thead className='bg-surface-raised text-xs text-muted-foreground'>
            <tr>
              {sortHeader('source', 'left')}
              <th scope='col' className='px-3 py-2 text-left font-medium uppercase tracking-wider'>
                {t('sources.colToday')}
              </th>
              {sortHeader('keptToday')}
              {sortHeader('keptAvg7')}
              {sortHeader('keptAvg30')}
              {sortHeader('keptChange')}
              {sortHeader('failedStreak')}
              {sortHeader('latencyMs')}
              <th scope='col' className='px-3 py-2 text-left font-medium uppercase tracking-wider'>
                {t('sources.colStrip', { days: SOURCE_WINDOW_DAYS })}
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-border'>
            {rows.map((entry) => {
              const delta = kpiDelta(entry.keptAvg7, entry.keptAvg30, {
                period: t('kpi.vsMonthAverage'),
                locale,
              });
              return (
                <tr key={entry.source} className='align-middle'>
                  <td className='whitespace-nowrap px-3 py-2'>
                    <p className='font-medium text-ink'>{entry.source}</p>
                    <p className='text-xs uppercase tracking-wider text-ink-muted'>{t(KIND_MESSAGE_KEY[entry.kind])}</p>
                  </td>
                  <td className='px-3 py-2'>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider',
                        STATE_TONE[entry.today.state],
                      )}
                    >
                      {t(STATE_MESSAGE_KEY[entry.today.state])}
                    </span>
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums text-ink'>
                    {entry.today.day ? formatCount(entry.today.day.kept, locale) : '—'}
                    {entry.today.day && (
                      <span className='text-ink-muted'>
                        {' '}
                        / {formatCount(entry.today.day.fetched, locale)}
                      </span>
                    )}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums text-ink-secondary'>
                    {entry.keptAvg7 === null ? '—' : entry.keptAvg7.toLocaleString(locale, { maximumFractionDigits: 1 })}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums text-ink-secondary'>
                    {entry.keptAvg30 === null ? '—' : entry.keptAvg30.toLocaleString(locale, { maximumFractionDigits: 1 })}
                  </td>
                  <td className='px-3 py-2 text-right'>
                    {/* Sem linha de base honesta, célula vazia — nunca um chip inventado. */}
                    {delta ? <DeltaChip delta={delta} withPeriod={false} /> : <span className='text-ink-muted'>—</span>}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right tabular-nums',
                      entry.failedStreak > 0 ? 'font-semibold text-danger' : 'text-ink-secondary',
                    )}
                  >
                    {formatCount(entry.failedStreak, locale)}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums text-ink-secondary'>
                    {entry.latencyMs === null ? '—' : formatMilliseconds(entry.latencyMs, locale)}
                  </td>
                  <td className='min-w-48 px-3 py-2'>
                    <DayStrip
                      size='compact'
                      label={t('sources.stripLabel', { source: entry.source, days: SOURCE_WINDOW_DAYS })}
                      days={entry.calendar.map((day) => ({
                        key: day.date,
                        fill: STATE_FILL[day.state],
                        label: describeDay(day),
                      }))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* A legenda das faixas, uma vez — e as pontas da janela. */}
      <div className='flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs'>
        <ul className='flex flex-wrap gap-x-4 gap-y-1 text-ink-secondary'>
          {LEGEND.map((state) => (
            <li key={state} className='inline-flex items-center gap-1.5'>
              <span aria-hidden='true' className={cn('h-2.5 w-2.5 rounded-sm', STATE_FILL[state])} />
              {t(STATE_MESSAGE_KEY[state])}
            </li>
          ))}
        </ul>
        {first && last && (
          <p className='text-ink-muted'>
            {t('sources.window', {
              first: formatCalendarDay(first.date, locale),
              last: formatCalendarDay(last.date, locale),
            })}
          </p>
        )}
      </div>

      <div>
        <h3 className='font-display mb-4 text-base font-semibold text-foreground'>
          {t('sources.contribution')}
        </h3>
        <p className='mb-4 max-w-prose text-sm text-muted-foreground'>{t('sources.contributionHint')}</p>
        {/**
          * `keepOrder`: as fatias já vêm por contribuição, com "Outras" no
          * fim — reordenadas por valor, a cauda somada (22 %) saía **em
          * primeiro**, acima da própria NewsData. Achado da captura.
          */}
        <DonutChart
          label={t('sources.contribution')}
          slices={slices}
          keepOrder
          center={{ value: formatCount(totalKept, locale), caption: t('sources.centerKept') }}
        />
      </div>
    </div>
  );
}
