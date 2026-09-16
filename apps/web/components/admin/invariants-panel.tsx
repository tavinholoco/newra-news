'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { InvariantId, InvariantResult, InvariantStatus } from '@newranews/types';
import { useInvariantReport } from '@/lib/queries';
import { formatCount, formatDateTime, formatMilliseconds } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * O painel "Invariantes" da aba de segurança (§10 do plano de observabilidade,
 * Fase 6). Responde à pergunta que nenhuma etapa fazia: **"o que deveria ter
 * acontecido aconteceu?"** — a retenção de cada tabela que a etapa 8 expurga,
 * um briefing por dia, o run morto em `RUNNING`, o dia com run e sem
 * métrica, a newsletter que não entrega.
 *
 * A API devolve **o último relatório**, lido do evento da etapa 9.5 do run
 * mais recente — nunca roda a suíte por pedido da tela. Três estados que não
 * são o mesmo: `isError` é "indisponível" (a rota é nova, e o preview da
 * `dev` fala com a API de produção — armadilha 37); `data: null` é "nenhuma
 * verificação ainda" (antes do primeiro run com a etapa); e o relatório é a
 * tabela, sempre com as doze linhas na ordem da API.
 *
 * **A forma carrega o estado junto com a cor** (armadilha 35): `OK` é ponto
 * verde cheio, `VIOLATED` vermelho cheio, `ERROR` — a pergunta que não pôde
 * ser feita — é contorno laranja tracejado, porque não é resposta.
 */

/**
 * O rótulo de cada invariante, com as chaves por extenso: o teste de i18n
 * procura o literal no código, e chave montada em runtime pareceria órfã. O
 * conjunto fechado mora em `InvariantId`; uma invariante que a tela ainda não
 * conhece sai pelo id, em vez de sumir.
 */
const CHECK_KEY = {
  'retention.news': 'security.invariants.checks.retentionNews',
  'retention.pipelineLog': 'security.invariants.checks.retentionPipelineLog',
  'retention.article': 'security.invariants.checks.retentionArticle',
  'retention.productEvent': 'security.invariants.checks.retentionProductEvent',
  'retention.errorEvent': 'security.invariants.checks.retentionErrorEvent',
  'retention.auditEvent': 'security.invariants.checks.retentionAuditEvent',
  'retention.sourceHealth': 'security.invariants.checks.retentionSourceHealth',
  'briefing.one_per_day': 'security.invariants.checks.briefingOnePerDay',
  'briefing.has_sources': 'security.invariants.checks.briefingHasSources',
  'pipeline.no_stale_running': 'security.invariants.checks.pipelineNoStaleRunning',
  'metrics.day_recorded': 'security.invariants.checks.metricsDayRecorded',
  'newsletter.delivered': 'security.invariants.checks.newsletterDelivered',
} as const satisfies Record<InvariantId, string>;

const STATUS_KEY = {
  OK: 'security.invariants.statusOk',
  VIOLATED: 'security.invariants.statusViolated',
  ERROR: 'security.invariants.statusError',
} as const satisfies Record<InvariantStatus, string>;

/** O ponto: cheio para resposta, contorno tracejado para a pergunta que falhou. */
const STATUS_DOT: Record<InvariantStatus, string> = {
  OK: 'bg-success',
  VIOLATED: 'bg-danger',
  ERROR: 'border-2 border-dashed border-brand-accent bg-brand-accent/25',
};

const STATUS_TONE: Record<InvariantStatus, string> = {
  OK: 'border-success/40 text-success',
  VIOLATED: 'border-danger/40 text-danger',
  ERROR: 'border-dashed border-brand-accent text-link',
};

function StatusPill({ status }: { status: InvariantStatus }) {
  const t = useTranslations('admin');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wider',
        STATUS_TONE[status],
      )}
    >
      <span aria-hidden='true' className={cn('h-2.5 w-2.5 rounded-full', STATUS_DOT[status])} />
      {t(STATUS_KEY[status])}
    </span>
  );
}

function InvariantsSkeleton() {
  return (
    <div className='space-y-3'>
      <Skeleton className='h-4 w-2/3' />
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className='flex items-center gap-4'>
          <Skeleton className='h-4 w-56' />
          <Skeleton className='h-5 w-20 rounded-full' />
          <Skeleton className='h-4 flex-1' />
        </div>
      ))}
    </div>
  );
}

export function InvariantsPanel() {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  const { data, isPending, isError } = useInvariantReport();

  if (isError) {
    return <p className='text-sm text-muted-foreground'>{t('security.invariants.unavailable')}</p>;
  }
  if (isPending) {
    return <InvariantsSkeleton />;
  }
  if (data === null) {
    return <p className='text-sm text-muted-foreground'>{t('security.invariants.empty')}</p>;
  }

  /** `count` é número; `oldest` é instante (ISO) ou vazio na tabela vazia. */
  const formatMeasure = (result: InvariantResult, value: number | string | null): string => {
    if (value === null) return t('security.invariants.none');
    if (result.measure === 'oldest' && typeof value === 'string') return formatDateTime(value, locale);
    return typeof value === 'number' ? formatCount(value, locale) : value;
  };
  const formatExpected = (result: InvariantResult): string => {
    const value = formatMeasure(result, result.expected);
    return result.measure === 'oldest'
      ? t('security.invariants.atLeast', { value })
      : t('security.invariants.exactly', { value });
  };

  return (
    <div className='space-y-4' data-testid='invariants-panel'>
      <p className='text-sm text-ink-secondary'>
        <span className='font-medium text-ink'>{t('security.invariants.checkedAt')}</span>{' '}
        <time dateTime={data.checkedAt}>{formatDateTime(data.checkedAt, locale)}</time>
        {' · '}
        <span
          className={cn(
            data.violated > 0 ? 'text-danger' : data.errored > 0 ? 'text-link' : 'text-success',
            'font-medium',
          )}
        >
          {t('security.invariants.summary', { violated: data.violated, checked: data.checked })}
        </span>
        {data.errored > 0 && (
          <>
            {' · '}
            <span className='text-link'>{t('security.invariants.errored', { errored: data.errored })}</span>
          </>
        )}
        {' · '}
        {t('security.invariants.duration', {
          duration: formatMilliseconds(data.durationMs, locale),
          budget: formatMilliseconds(data.budgetMs, locale),
        })}
        {' · '}
        {t('security.invariants.run')}{' '}
        <code className='select-all font-mono text-ink-secondary'>{data.pipelineLogId}</code>
      </p>

      <div className='overflow-x-auto rounded-lg border border-border bg-card'>
        <table className='w-full text-sm' aria-label={t('security.invariants.title')}>
          <thead>
            <tr className='border-b border-line text-left text-xs uppercase tracking-wider text-ink-muted'>
              <th scope='col' className='px-4 py-2 font-medium'>{t('security.invariants.columnCheck')}</th>
              <th scope='col' className='px-4 py-2 font-medium'>{t('security.invariants.columnStatus')}</th>
              <th scope='col' className='px-4 py-2 font-medium'>{t('security.invariants.columnObserved')}</th>
              <th scope='col' className='px-4 py-2 font-medium'>{t('security.invariants.columnExpected')}</th>
              <th scope='col' className='px-4 py-2 text-right font-medium'>{t('security.invariants.columnDuration')}</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-line'>
            {data.results.map((result) => {
              const labelKey = (CHECK_KEY as Record<string, string | undefined>)[result.id];
              return (
                <tr key={result.id} className='align-top'>
                  <td className='px-4 py-3'>
                    <div className='font-medium text-ink'>{labelKey ? t(labelKey) : result.id}</div>
                    <code className='font-mono text-xs text-ink-muted'>{result.id}</code>
                    {result.detail && (
                      <p className='mt-1 text-xs text-ink-secondary'>
                        {t('security.invariants.detail')} {result.detail}
                      </p>
                    )}
                    {result.error && (
                      <p className='mt-1 text-xs text-link'>
                        {t('security.invariants.error')} {result.error}
                      </p>
                    )}
                  </td>
                  <td className='px-4 py-3'>
                    <StatusPill status={result.status} />
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 tabular-nums text-ink-secondary'>
                    {formatMeasure(result, result.observed)}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 tabular-nums text-ink-secondary'>
                    {formatExpected(result)}
                  </td>
                  <td className='whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink-muted'>
                    {formatMilliseconds(result.durationMs, locale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
