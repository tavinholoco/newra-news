'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type {
  PipelineRunEvent,
  PipelineRunStatus,
  PipelineRunSummary,
} from '@newranews/types';
import { usePipelineRunDetail, usePipelineRuns } from '@/lib/queries';
import { formatCount, formatDateTime, formatRunDuration } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * O pipeline diário, visível para quem consegue entrar. (§6.2 do plano de
 * observabilidade)
 *
 * **A pergunta que esta tela responde é uma só:** o run de ontem falhou? em que
 * etapa? o que o erro dizia? e ele falha há três dias? O dado existia desde a
 * Fase 9 — em `PipelineLog` e `PipelineEvent` —, e a única superfície que o
 * mostrava era o `/dev/dashboard`, atrás do `JOB_SECRET`. O dono do produto
 * consegue entrar na `/admin` e não conseguia entrar lá.
 *
 * **Sem rota nova.** A primeira versão da fase criava `/admin/pipeline`, e isso
 * contradizia as três abas declaradas no §4.1 do plano. A `/admin` já é a aba
 * "está tudo de pé agora?", e o histórico de runs é exatamente essa pergunta —
 * então os painéis entram nela. Rota nova custaria linha na matriz de estados,
 * chave nos dois arquivos de mensagem e `alternatesFor`, para uma tela que só
 * um admin abre.
 *
 * **O detalhe de um run é linha expansível pelo mesmo motivo.** Uma `/[id]`
 * pediria `loading.tsx`, `error.tsx` e `not-found.tsx`, e a matriz de estados
 * cobraria os três.
 */

const STATUS_KEY = {
  RUNNING: 'pipeline.statusRunning',
  SUCCESS: 'pipeline.statusSuccess',
  FAILED: 'pipeline.statusFailed',
} as const;

/**
 * A cor do estado, e ela é semântica dos dois lados.
 *
 * `RUNNING` fica no texto secundário de propósito: verde afirmaria que deu
 * certo, e o run ainda não terminou — a mesma distinção que o `TriggerOutcome`
 * faz logo acima nesta tela.
 */
const STATUS_TONE: Record<PipelineRunStatus, string> = {
  RUNNING: 'border-line-strong text-ink-secondary',
  SUCCESS: 'border-success/40 text-success',
  FAILED: 'border-danger/40 text-danger',
};

/** `WARN` usa `--link` e não `--brand-accent`: há texto na linha (§ tokens). */
const LEVEL_TONE: Record<PipelineRunEvent['level'], string> = {
  INFO: 'text-ink-secondary',
  WARN: 'text-link',
  ERROR: 'text-danger',
};

function StatusPill({ status }: { status: PipelineRunStatus }) {
  const t = useTranslations('admin');

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider',
        STATUS_TONE[status],
      )}
    >
      {t(STATUS_KEY[status])}
    </span>
  );
}

/** Os eventos de um run, agrupados por etapa e coloridos por nível. */
function RunEvents({ pipelineId }: { pipelineId: string }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateLocale = toDateFormatLocale(locale);
  const { data, isError } = usePipelineRunDetail(pipelineId);

  if (isError) {
    return (
      <p role='alert' className='py-3 text-body-sm text-danger'>
        {t('pipeline.eventsError')}
      </p>
    );
  }

  // `!data` e não `isPending`: desestruturar o resultado do TanStack Query
  // desfaz a união discriminada, então `isPending === false` não estreita
  // `data` para definido. É o padrão já usado no `product-metrics-client`.
  if (!data) {
    return (
      <div className='space-y-2 py-3'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className='h-5 w-full' />
        ))}
      </div>
    );
  }

  if (data.events.length === 0) {
    return (
      <p className='py-3 text-body-sm text-ink-secondary'>
        {t('pipeline.eventsEmpty')}
      </p>
    );
  }

  return (
    <ol className='space-y-3 py-3'>
      {data.events.map((event, index) => {
        // Agrupamento por etapa: os eventos vêm ordenados por `createdAt` e as
        // etapas sobem junto, então "mudou de etapa" é a comparação com o
        // anterior. Um `groupBy` daria o mesmo resultado com mais estrutura.
        const previous = data.events[index - 1];
        const opensStage = !previous || previous.stage !== event.stage;

        return (
          <li key={event.id}>
            {opensStage && (
              <p className='mb-1 text-overline text-ink-muted'>
                {t('pipeline.stageLabel', { stage: event.stage })}
              </p>
            )}
            <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
              <span
                className={cn(
                  'text-xs font-semibold uppercase tracking-wider',
                  LEVEL_TONE[event.level],
                )}
              >
                {event.level}
              </span>
              <span className='text-body-sm text-ink'>{event.message}</span>
              <span className='text-xs text-ink-muted'>
                {formatDateTime(event.createdAt, dateLocale)}
              </span>
            </div>
            {event.context && (
              <details className='mt-1'>
                <summary className='cursor-pointer text-xs text-ink-secondary'>
                  {t('pipeline.contextLabel')}
                </summary>
                <pre className='mt-1 overflow-x-auto rounded-sm border border-line bg-surface-raised p-2 text-xs text-ink-secondary'>
                  {JSON.stringify(event.context, null, 2)}
                </pre>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** O último run, em cartões: status, etapa da falha, duração e a mensagem. */
function LastRun({ run }: { run: PipelineRunSummary }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateLocale = toDateFormatLocale(locale);
  const message = run.error ?? null;

  return (
    <div>
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <MetricCard
          label={t('pipeline.status')}
          value={t(STATUS_KEY[run.status])}
          hint={formatDateTime(run.startedAt, dateLocale)}
        />
        <MetricCard
          label={t('pipeline.stage')}
          // `—` e não "9": etapa só existe quando houve falha, e imprimir a
          // última etapa de um run bem-sucedido leria como se ele tivesse
          // parado ali.
          value={run.errorStage === null ? '—' : String(run.errorStage)}
        />
        <MetricCard
          label={t('pipeline.duration')}
          // Segundos. Passar isto ao `formatPipelineDuration`, que recebe
          // milissegundos, renderiza "45 ms" para um run de 45 s.
          value={formatRunDuration(run.durationSeconds)}
        />
        <MetricCard
          label={t('pipeline.newsCollected')}
          value={formatCount(run.newsCount, dateLocale)}
        />
      </div>

      {message && (
        <p
          role='alert'
          className='mt-4 rounded-md border border-danger/30 px-4 py-3 text-body-sm text-danger'
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function PipelineRuns() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateLocale = toDateFormatLocale(locale);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const { data, isError } = usePipelineRuns();

  if (isError) {
    return (
      <section>
        <h2 className='font-display mb-4 text-lg font-semibold text-foreground'>
          {t('pipeline.title')}
        </h2>
        <p role='alert' className='text-sm text-danger'>
          {t('pipeline.loadError')}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section>
        <h2 className='font-display mb-4 text-lg font-semibold text-foreground'>
          {t('pipeline.title')}
        </h2>
        <div className='space-y-3'>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className='h-12 w-full' />
          ))}
        </div>
      </section>
    );
  }

  const { runs, recentErrors } = data.data;
  const lastRun = runs[0];

  return (
    <section>
      <h2 className='font-display mb-1 text-lg font-semibold text-foreground'>
        {t('pipeline.title')}
      </h2>
      <p className='mb-4 text-sm text-muted-foreground'>
        {t('pipeline.description')}
      </p>

      {!lastRun ? (
        <p className='text-sm text-muted-foreground'>{t('pipeline.empty')}</p>
      ) : (
        <>
          <LastRun run={lastRun} />

          {/**
           * **"Ele falha há três dias?" é uma pergunta diferente de "o último
           * falhou?"**, e é a que não tinha resposta em superfície nenhuma.
           * `recentErrors` não é um recorte de `runs`: é o mesmo filtro com
           * `status: FAILED`, então a falha de anteontem aparece aqui mesmo
           * quando os últimos runs foram todos verdes.
           */}
          {recentErrors.length > 0 && (
            <p className='mt-4 rounded-md border border-danger/30 px-4 py-3 text-body-sm text-danger'>
              {t('pipeline.recentFailures', {
                count: recentErrors.length,
                date: formatDateTime(
                  recentErrors[0]?.startedAt ?? lastRun.startedAt,
                  dateLocale,
                ),
              })}
            </p>
          )}

          <h3 className='font-display mb-2 mt-8 text-base font-semibold text-foreground'>
            {t('pipeline.historyTitle')}
          </h3>

          <ul className='divide-y divide-border overflow-hidden rounded-lg border border-border bg-card'>
            {runs.map((run) => {
              const isOpen = openRunId === run.id;

              return (
                <li key={run.id}>
                  <div className='flex flex-wrap items-center gap-3 px-4 py-3'>
                    <StatusPill status={run.status} />
                    <span className='text-sm text-foreground'>
                      {formatDateTime(run.startedAt, dateLocale)}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {t('pipeline.rowSummary', {
                        news: formatCount(run.newsCount, dateLocale),
                        duration: formatRunDuration(run.durationSeconds),
                      })}
                    </span>
                    <button
                      type='button'
                      onClick={() => setOpenRunId(isOpen ? null : run.id)}
                      aria-expanded={isOpen}
                      aria-controls={`pipeline-run-${run.id}`}
                      className='ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-link transition-colors duration-base hover:text-link-hover'
                    >
                      {t('pipeline.events', { count: run.eventCount })}
                      <ChevronDown
                        aria-hidden='true'
                        className={cn(
                          'h-3 w-3 transition-transform duration-base',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </button>
                  </div>

                  {/**
                   * O detalhe só é montado quando abre — é o que faz a consulta
                   * de eventos existir para o run que alguém quis ler, e não
                   * para os vinte da lista.
                   */}
                  {isOpen && (
                    <div
                      id={`pipeline-run-${run.id}`}
                      className='border-t border-border px-4'
                    >
                      <RunEvents pipelineId={run.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className='mt-2 text-xs text-muted-foreground'>
            {t('pipeline.totalRuns', { count: data.meta.total })}
          </p>
        </>
      )}
    </section>
  );
}
