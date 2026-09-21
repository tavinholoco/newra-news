'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useErrorSummary, usePipelineRuns } from '@/lib/queries';
import { gateAlerts, gateDecisions, type GateAlert, type GateMotive } from '@/lib/gate-decisions';
import { formatCount } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { DonutChart } from '@/components/dashboard/donut-chart';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * O painel "Portões" da aba de segurança — §13.3 do plano de observabilidade,
 * Fase 9: *registre toda decisão de guarda e observe a deriva; mudança súbita
 * na taxa de aprovação, ou na distribuição dos motivos de recusa, costuma
 * preceder um bypass que funciona.*
 *
 * **Sem rota nova.** A taxa de aprovação de 7 dias e a distribuição de
 * motivos são derivadas (`lib/gate-decisions.ts`) dos grupos de
 * `PIPELINE_GATE_BLOCKED` do `GET /api/admin/errors` — o motivo está no
 * `route`, `stage-6.5:unanchored-url` — e da listagem de runs que a `/admin`
 * já pede. Os dois gatilhos do §16 saem como alerta: a taxa abaixo de 90 %,
 * e **qualquer** bloqueio por URL não ancorada, que é evento único e merece
 * olhar no mesmo dia.
 *
 * Antes da promoção a API de produção não grava o código: a taxa lê 100 %
 * sobre os runs da janela, e a rosquinha fica vazia — o estado certo, não
 * "indisponível" (as duas rotas existem desde a Fase 5).
 */

/**
 * O rótulo de cada motivo, por extenso: o teste de i18n procura o literal no
 * código. O conjunto é o `GATE_CHECKS` da API (os cinco do portão de entrada
 * e os seis do de saída), e `tests/lib/gate-checks.test.ts` o deriva dos dois
 * arquivos da API para este mapa não envelhecer em silêncio. Um check que a
 * tela ainda não conhece sai pelo nome, em vez de sumir.
 */
const CHECK_KEY: Record<string, string> = {
  volume: 'security.gates.checks.volume',
  diversity: 'security.gates.checks.diversity',
  freshness: 'security.gates.checks.freshness',
  'duplicate-rate': 'security.gates.checks.duplicateRate',
  'category-drift': 'security.gates.checks.categoryDrift',
  'unanchored-url': 'security.gates.checks.unanchoredUrl',
  'envelope-leak': 'security.gates.checks.envelopeLeak',
  language: 'security.gates.checks.language',
  size: 'security.gates.checks.size',
  'copied-url': 'security.gates.checks.copiedUrl',
  'instruction-text': 'security.gates.checks.instructionText',
};

export { CHECK_KEY as GATE_CHECK_KEY };

function GatesSkeleton() {
  return (
    <div className='flex flex-col gap-6'>
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className='flex flex-col gap-2 rounded-lg border p-4'>
            <Skeleton className='h-3 w-24' />
            <Skeleton className='h-8 w-16' />
          </div>
        ))}
      </div>
      <div className='flex items-center gap-6'>
        <Skeleton className='h-36 w-36 rounded-full' />
        <div className='flex flex-1 flex-col gap-2'>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className='h-4 w-full' />
          ))}
        </div>
      </div>
    </div>
  );
}

export function GatesPanel() {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  const errors = useErrorSummary('7d');
  const runs = usePipelineRuns();

  if (errors.isError || runs.isError) {
    return (
      <p role='alert' className='text-sm text-danger'>
        {t('security.gates.loadError')}
      </p>
    );
  }
  if (!errors.data || !runs.data) return <GatesSkeleton />;

  const decisions = gateDecisions(errors.data.groups, runs.data.data.runs, errors.data.window.since);
  const alerts = gateAlerts(decisions);

  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const motiveLabel = (motive: GateMotive): string => {
    const key = CHECK_KEY[motive.check];
    return key ? t(key) : motive.check;
  };
  const describeAlert = (alert: GateAlert): string =>
    alert.kind === 'unanchored-url'
      ? t('security.gates.alertUnanchored', { count: alert.count })
      : t('security.gates.alertLowApproval', { rate: percent.format(alert.rate) });

  return (
    <div className='flex flex-col gap-6'>
      {/**
        * `role='status'`, não `alert`: é conteúdo da página, não interrupção —
        * a lição da Fase 2, e o mesmo desenho dos alertas de fonte da Fase 11.
        * O de URL não ancorada é vermelho (é o evento único do §16); o de
        * taxa é o laranja de atenção.
        */}
      {alerts.length > 0 && (
        <ul role='status' aria-label={t('security.gates.alertsLabel')} className='flex flex-col gap-1 text-sm'>
          {alerts.map((alert) => (
            <li
              key={alert.kind}
              className={cn('font-medium', alert.kind === 'unanchored-url' ? 'text-danger' : 'text-link')}
            >
              {describeAlert(alert)}
            </li>
          ))}
        </ul>
      )}

      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <MetricCard
          label={t('security.gates.approval')}
          // Sem run na janela não há taxa — a taxa de zero runs não é 100 %.
          value={decisions.approvalRate === null ? t('security.gates.none') : percent.format(decisions.approvalRate)}
          hint={t('security.gates.approvalHint')}
        />
        <MetricCard label={t('security.gates.runs')} value={formatCount(decisions.runs, locale)} />
        <MetricCard
          label={t('security.gates.blocked')}
          value={formatCount(decisions.blocked, locale)}
          hint={t('security.gates.blockedHint')}
        />
        <MetricCard
          label={t('security.gates.recovered')}
          value={formatCount(decisions.recovered, locale)}
          hint={t('security.gates.recoveredHint')}
        />
      </div>

      <div>
        <h3 className='font-display mb-4 text-base font-semibold text-foreground'>
          {t('security.gates.motives')}
        </h3>
        <DonutChart
          label={t('security.gates.motives')}
          slices={decisions.motives.map((motive) => ({
            key: `${motive.gate}:${motive.check}`,
            label: motiveLabel(motive),
            value: motive.count,
          }))}
          center={{
            value: formatCount(decisions.blocked + decisions.recovered, locale),
            caption: t('security.gates.centerCaption'),
          }}
          emptyText={t('security.gates.empty')}
        />
      </div>
    </div>
  );
}
