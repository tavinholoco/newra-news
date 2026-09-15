'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type {
  PipelineRunEvent,
  PipelineRunSummary,
  RunOutcome,
} from '@newranews/types';
import { usePipelineRunDetail, usePipelineRuns } from '@/lib/queries';
import {
  formatCount,
  formatDateTime,
  formatEventTime,
  formatList,
  formatProviderName,
  formatRunDuration,
  formatUptime,
} from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import {
  BRIEFING_OVERDUE_MS,
  DEGRADED_STREAK_TRIGGER,
  degradedStreak,
  lastBriefingRun,
  outcomeByDay,
  OUTCOME_WINDOW_DAYS,
  type OutcomeDay,
} from '@/lib/outcome-days';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { OutcomeStrip, OUTCOME_MESSAGE_KEY } from './outcome-strip';

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
 *
 * **Desde a Fase 8 a tela fala em desfecho, não em status.** `SUCCESS` é
 * binário e o pipeline não é: um run pode sair pelo Groq com a newsletter
 * falhada e reportar sucesso. O `outcome` da API separa o `SUCCESS_DEGRADED`,
 * `degradedBy` diz qual etapa, e a faixa de 30 dias no topo mostra o que
 * nenhum run consegue dizer — o dia em que nada rodou.
 */

/**
 * Quantos runs a lista mostra (§6.2). A consulta traz mais — a janela de 30
 * dias inteira, para a faixa de desfechos —, e a lista corta aqui.
 */
const PIPELINE_RUNS_SHOWN = 20;

/** O estado de um run como a tela o nomeia: o desfecho, ou `RUNNING` enquanto não há. */
type RunState = RunOutcome | 'RUNNING';

function runStateOf(run: PipelineRunSummary): RunState {
  return run.outcome ?? 'RUNNING';
}

/**
 * A cor do estado, e ela é semântica dos dois lados.
 *
 * `RUNNING` fica no texto secundário de propósito: verde afirmaria que deu
 * certo, e o run ainda não terminou — a mesma distinção que o `TriggerOutcome`
 * faz logo acima nesta tela. `SUCCESS_DEGRADED` é `text-link`, o laranja que
 * vai em texto — a mesma regra do `WARN` na lista de eventos, porque é o mesmo
 * estado visto de longe.
 */
const STATE_TONE: Record<RunState, string> = {
  RUNNING: 'border-line-strong text-ink-secondary',
  SUCCESS: 'border-success/40 text-success',
  SUCCESS_DEGRADED: 'border-link/40 text-link',
  FAILED: 'border-danger/40 text-danger',
};

/** `WARN` usa `--link` e não `--brand-accent`: há texto na linha (§ tokens). */
const LEVEL_TONE: Record<PipelineRunEvent['level'], string> = {
  INFO: 'text-ink-secondary',
  WARN: 'text-link',
  ERROR: 'text-danger',
};

function OutcomePill({ state }: { state: RunState }) {
  const t = useTranslations('admin');

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider',
        STATE_TONE[state],
      )}
    >
      {t(OUTCOME_MESSAGE_KEY[state])}
    </span>
  );
}

/**
 * As etapas que engoliram a própria falha, em prosa: "Degradado pelas etapas
 * 6 e 7.5". É o que faz o `SUCCESS_DEGRADED` ser acionável — o diário do run,
 * uma linha abaixo, diz o que cada uma engoliu.
 */
function DegradedBy({ stages }: { stages: number[] }) {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());

  if (stages.length === 0) return null;

  return (
    <p className='text-body-sm text-link'>
      {t('pipeline.degradedBy', {
        count: stages.length,
        stages: formatList(stages.map(String), locale),
      })}
    </p>
  );
}

/**
 * O gatilho numérico da §12, medido (pós-merge da Fase 8): três runs seguidos
 * degradados pela mesma etapa. Antes era contar contornos laranja na faixa; o
 * `CLAUDE.md` já escrevia em prosa "três dias seguidos de fallback" como o
 * gatilho para agir sobre o Gemini. Abaixo do gatilho a linha não existe —
 * uma linha que aparece a cada dia degradado ensina a ignorá-la.
 */
function DegradedStreakLine({ days }: { days: OutcomeDay[] }) {
  const t = useTranslations('admin');
  const streak = degradedStreak(days);

  if (!streak || streak.runs < DEGRADED_STREAK_TRIGGER) return null;

  return (
    <p className='mt-2 text-body-sm font-semibold text-link'>
      {t('pipeline.degradedStreak', { count: streak.runs, stage: String(streak.stage) })}
    </p>
  );
}

/**
 * O batimento positivo (§12.3): "último briefing há 4 h".
 *
 * Mede do último run que **produziu briefing**, e não do último run — se o de
 * hoje falhou, o briefing no ar é o de ontem, e é dessa idade que se fala.
 * Acima de `BRIEFING_OVERDUE_MS` a linha muda de tom e ganha a palavra: é o
 * 01/09/2026 virando observável antes de alguém abrir a Home.
 *
 * O relógio é lido no render de propósito: isto é client component sobre dado
 * de consulta, sem HTML de servidor com que divergir — a regra do
 * `PlanPaceLine`.
 */
function LastBriefing({ runs }: { runs: PipelineRunSummary[] }) {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  const last = lastBriefingRun(runs);

  if (!last || last.completedAt === null) {
    return (
      <p className='text-body-sm text-danger'>
        {t('pipeline.lastBriefingNone', { days: OUTCOME_WINDOW_DAYS })}
      </p>
    );
  }

  const ageMs = Date.now() - new Date(last.completedAt).getTime();
  const overdue = ageMs >= BRIEFING_OVERDUE_MS;
  const age = formatUptime(ageMs / 1000, locale);

  return (
    <p className='text-body-sm'>
      <span className={overdue ? 'font-semibold text-danger' : 'text-ink'}>
        {overdue
          ? t('pipeline.lastBriefingOverdue', { age })
          : t('pipeline.lastBriefing', { age })}
      </span>{' '}
      <span className='text-ink-muted'>· {formatDateTime(last.completedAt, locale)}</span>
    </p>
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
              {/**
                * Hora com segundos e sem data: a linha do run já declara as
                * duas, e sem os segundos as ~19 etapas imprimem o mesmo minuto.
                */}
              <span className='text-xs text-ink-muted'>
                {formatEventTime(event.createdAt, dateLocale)}
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

/**
 * De onde veio a falha, quando o erro estruturado sabe dizer.
 *
 * `errorDetail` é coluna `Json`, então **é `Record<string, unknown>` e não um
 * tipo**: estreitar campo a campo é o preço honesto de ler JSON de banco. O que
 * ele acrescenta à mensagem é o que responde a pergunta seguinte de quem lê
 * "Gemini API error 503" — qual provider, e que status HTTP.
 */
function errorOrigin(detail: Record<string, unknown> | null): string | null {
  if (!detail) return null;

  const provider = typeof detail.provider === 'string' ? detail.provider : null;
  const statusCode =
    typeof detail.statusCode === 'number' ? detail.statusCode : null;

  const parts = [
    provider ? formatProviderName(provider) : null,
    statusCode === null ? null : `HTTP ${statusCode}`,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(' · ') : null;
}

/** O último run, em cartões: status, etapa da falha, duração e a mensagem. */
function LastRun({ run }: { run: PipelineRunSummary }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const dateLocale = toDateFormatLocale(locale);
  const origin = errorOrigin(run.errorDetail);

  return (
    <div>
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <MetricCard
          label={t('pipeline.status')}
          // O desfecho, não o `status`: "Sucesso" sobre um run que saiu pelo
          // Groq com a newsletter falhada é o que a Fase 8 existe para corrigir.
          value={t(OUTCOME_MESSAGE_KEY[runStateOf(run)])}
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

      {/**
        * **Sem `role='alert'`, e a diferença não é estilística.** `alert` é
        * região viva: o leitor de tela interrompe o que estiver lendo para
        * anunciá-la. Isto aqui não é um estado que acabou de mudar — é o
        * conteúdo do run, presente já na primeira renderização. Os dois
        * `role='alert'` que sobraram neste arquivo são os certos: falha de
        * carregamento, que é mudança de estado.
        */}
      {run.error && (
        <div className='mt-4 rounded-md border border-danger/30 px-4 py-3'>
          <p className='text-body-sm text-danger'>{run.error}</p>
          {origin && (
            <p className='mt-1 text-xs text-ink-secondary'>
              {t('pipeline.errorOrigin', { origin })}
            </p>
          )}
        </div>
      )}

      {run.degradedBy.length > 0 && (
        <div className='mt-4 rounded-md border border-link/40 px-4 py-3'>
          <DegradedBy stages={run.degradedBy} />
        </div>
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
  // A consulta traz a janela inteira (até 100 runs); a lista mostra as últimas
  // 20, e a faixa lê todas — é ela que precisa saber qual dia não rodou.
  const listed = runs.slice(0, PIPELINE_RUNS_SHOWN);
  const days = outcomeByDay(runs, new Date());

  /**
   * **A falha que os cartões já mostram não conta de novo aqui.**
   *
   * `recentErrors` inclui o último run quando ele falhou — e sem tirá-lo a tela
   * empilhava **duas caixas vermelhas sobre o mesmo run**: a mensagem do erro,
   * e logo abaixo um aviso dizendo que "1 execução recente falhou", com a mesma
   * hora. Ruído que parece informação nova.
   *
   * O que sobra depois do filtro é exatamente a pergunta que os cartões não
   * respondem: **além desta, o que mais falhou recentemente?**
   */
  const otherFailures = recentErrors.filter(
    (failure) => failure.id !== lastRun?.id,
  );
  const [latestOtherFailure] = otherFailures;

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
          {/**
           * **A faixa vem antes dos cartões** (§12.4): três semanas de saúde
           * do produto num relance, e só depois o detalhe do último run. O
           * batimento positivo abre a seção porque é a pergunta mais barata —
           * "tem briefing de hoje?" — respondida antes de qualquer gráfico.
           */}
          <div className='mb-8'>
            <h3 className='font-display mb-2 text-base font-semibold text-foreground'>
              {t('pipeline.stripTitle', { days: OUTCOME_WINDOW_DAYS })}
            </h3>
            <div className='mb-3'>
              <LastBriefing runs={runs} />
            </div>
            <OutcomeStrip days={days} />
            <DegradedStreakLine days={days} />
          </div>

          <LastRun run={lastRun} />

          {/**
           * **"Ele falha há três dias?" é uma pergunta diferente de "o último
           * falhou?"**, e é a que não tinha resposta em superfície nenhuma.
           * `recentErrors` não é um recorte de `runs`: é o mesmo filtro com
           * `status: FAILED`, então a falha de anteontem aparece aqui mesmo
           * quando os últimos runs foram todos verdes.
           *
           * A contagem é a das falhas que a resposta trouxe, e ela tem teto
           * (`Math.min(limit, 20)` no serviço) — daí "recentes" e nunca "no
           * total", que é um número que esta tela não tem.
           */}
          {latestOtherFailure && (
            <p className='mt-4 rounded-md border border-danger/30 px-4 py-3 text-body-sm text-danger'>
              {t('pipeline.recentFailures', {
                count: otherFailures.length,
                date: formatDateTime(latestOtherFailure.startedAt, dateLocale),
              })}
            </p>
          )}

          <h3 className='font-display mb-2 mt-8 text-base font-semibold text-foreground'>
            {t('pipeline.historyTitle')}
          </h3>

          <ul className='divide-y divide-border overflow-hidden rounded-lg border border-border bg-card'>
            {listed.map((run) => {
              const isOpen = openRunId === run.id;

              return (
                <li key={run.id}>
                  <div className='flex flex-wrap items-center gap-3 px-4 py-3'>
                    <OutcomePill state={runStateOf(run)} />
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
                      // Só quando aberto: `aria-controls` apontando para um id
                      // que não existe no DOM é referência quebrada, e a região
                      // só é montada depois do clique.
                      aria-controls={isOpen ? `pipeline-run-${run.id}` : undefined}
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
