'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { HttpMetrics, Saturation } from '@newranews/types';
import { useHttpMetrics } from '@/lib/queries';
import {
  formatCount,
  formatDateTime,
  formatHours,
  formatMegabytes,
  formatMilliseconds,
  formatRate,
  formatRatio,
} from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { planPace } from '@/lib/saturation';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from './metric-card';
import { SaturationArc } from './saturation-arc';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='font-display mb-4 text-base font-semibold text-foreground'>
      {children}
    </h3>
  );
}

/**
 * O que o ritmo do mês promete, escrito para quem lê.
 *
 * É a linha que teria avisado em 19/08 que 29/08 ia acontecer: `hoursUsed /
 * limitHours` no dia 10 dizia 32%, e 24/7 × 31 dias diz 744 h. O relógio é
 * lido **aqui, no cliente, depois de o dado chegar** — este componente só
 * renderiza com dado depois da hidratação, então não há HTML de servidor com
 * que divergir (a armadilha do relógio no render é das páginas estáticas).
 */
export function PlanPaceLine({ plan }: { plan: NonNullable<Saturation['plan']> }) {
  const t = useTranslations('dashboard');
  const locale = toDateFormatLocale(useLocale());
  const pace = planPace(plan, new Date());

  if (!pace) {
    return <p className='text-xs text-muted-foreground'>{t('signals.paceTooEarly')}</p>;
  }

  return (
    <p className='text-xs text-ink-secondary'>
      {t('signals.pace', {
        hours: formatHours(pace.projectedHours, locale),
        ratio: formatRatio(pace.projectedRatio, locale),
      })}
    </p>
  );
}

function SignalsSkeleton() {
  return (
    <div className='flex flex-col gap-8'>
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='flex flex-col gap-2 rounded-lg border p-4'>
            <Skeleton className='h-3 w-24' />
            <Skeleton className='h-8 w-16' />
          </div>
        ))}
      </div>
      <div className='flex flex-wrap gap-8'>
        <Skeleton className='h-24 w-24 rounded-full' />
        <Skeleton className='h-24 w-24 rounded-full' />
        <Skeleton className='h-24 flex-1' />
      </div>
    </div>
  );
}

/** O painel de saturação, compartilhado entre a `/admin` e a `/admin/metrics`. */
export function SaturationPanel({
  saturation,
  arcSize,
}: {
  saturation: Saturation;
  arcSize: 'lg' | 'sm';
}) {
  const t = useTranslations('dashboard');
  const locale = toDateFormatLocale(useLocale());
  const { plan, memory, eventLoop } = saturation;

  return (
    <div className='flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-start sm:gap-10'>
      <div className='flex flex-col items-center gap-2'>
        <SaturationArc
          ratio={plan ? plan.ratio : null}
          label={t('signals.planHours')}
          value={
            plan
              ? t('signals.planValue', {
                  used: formatHours(plan.hoursUsed, locale),
                  limit: formatHours(plan.limitHours, locale),
                })
              : null
          }
          unavailableText={t('signals.planUnavailable')}
          size={arcSize}
        />
        {plan ? (
          <PlanPaceLine plan={plan} />
        ) : (
          <p className='max-w-48 text-center text-xs text-muted-foreground'>
            {t('signals.planUnavailableHint')}
          </p>
        )}
      </div>

      <SaturationArc
        ratio={memory.ratio}
        label={t('signals.memory')}
        value={t('signals.memoryValue', {
          used: formatMegabytes(memory.rssBytes, locale),
          limit: formatMegabytes(memory.limitBytes, locale),
        })}
        unavailableText={t('signals.planUnavailable')}
        size='sm'
      />

      <div className='min-w-0 flex-1'>
        <MetricCard
          label={t('signals.eventLoop')}
          value={formatMilliseconds(eventLoop.lagMs.p95, locale)}
          hint={t('signals.eventLoopHint', {
            max: formatMilliseconds(eventLoop.lagMs.max, locale),
            samples: formatCount(eventLoop.samples, locale),
            resolution: formatMilliseconds(eventLoop.resolutionMs, locale),
          })}
        />
      </div>
    </div>
  );
}

function RoutesTable({ routes }: { routes: HttpMetrics['routes'] }) {
  const t = useTranslations('dashboard');
  const locale = toDateFormatLocale(useLocale());

  if (routes.length === 0) {
    return <p className='text-sm text-muted-foreground'>{t('signals.routesEmpty')}</p>;
  }

  return (
    <div className='overflow-x-auto rounded-lg border border-border'>
      <table className='w-full text-sm'>
        <thead className='bg-surface-raised text-xs uppercase tracking-wider text-muted-foreground'>
          <tr>
            <th scope='col' className='px-3 py-2 text-left font-medium'>{t('signals.colRoute')}</th>
            <th scope='col' className='px-3 py-2 text-right font-medium'>{t('signals.colCount')}</th>
            <th scope='col' className='px-3 py-2 text-right font-medium'>{t('signals.colP95')}</th>
            <th scope='col' className='px-3 py-2 text-right font-medium'>{t('signals.colAvg')}</th>
            <th scope='col' className='px-3 py-2 text-right font-medium'>{t('signals.colMax')}</th>
            <th scope='col' className='px-3 py-2 text-right font-medium'>{t('signals.colErrorRate')}</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border'>
          {routes.map((route) => (
            <tr key={route.route}>
              <td className='px-3 py-2 font-mono text-xs text-ink'>{route.route}</td>
              <td className='px-3 py-2 text-right tabular-nums text-ink'>{formatCount(route.count, locale)}</td>
              <td className='px-3 py-2 text-right tabular-nums text-ink'>{formatMilliseconds(route.p95Ms, locale)}</td>
              <td className='px-3 py-2 text-right tabular-nums text-ink-secondary'>{formatMilliseconds(route.avgMs, locale)}</td>
              <td className='px-3 py-2 text-right tabular-nums text-ink-secondary'>{formatMilliseconds(route.maxMs, locale)}</td>
              <td className='px-3 py-2 text-right tabular-nums text-ink-secondary'>{formatRate(route.errorRate, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Os quatro sinais de ouro (§3.1 do plano de observabilidade), na aba de
 * métricas.
 *
 * Latência, tráfego e erro existiam desde a Fase 9 **sem leitor no web** — o
 * `/api/metrics/http` era lido por operador, com `curl`. A saturação entrou no
 * 5b e não existia em lugar nenhum: é o sinal que faltava nos três incidentes.
 *
 * **A janela é a do processo, e a tela diz isso.** `since` e `uptimeSeconds`
 * não são enfeite: a API dorme e acorda várias vezes por dia desde 01/09, e um
 * `errorRate: 0` logo depois de acordar é ausência de amostra, não saúde.
 */
export function GoldenSignals() {
  const t = useTranslations('dashboard');
  const locale = toDateFormatLocale(useLocale());
  const { data, isError } = useHttpMetrics();

  if (isError) {
    return (
      <p role='alert' className='text-sm text-danger'>
        {t('signals.loadError')}
      </p>
    );
  }

  if (!data) return <SignalsSkeleton />;

  return (
    <div className='flex flex-col gap-8'>
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <MetricCard
          label={t('signals.requests')}
          value={formatCount(data.totalRequests, locale)}
          hint={t('signals.since', { since: formatDateTime(data.since, locale) })}
        />
        <MetricCard
          label={t('signals.latencyP95')}
          value={formatMilliseconds(data.latencyMs.p95, locale)}
          hint={t('signals.latencyHint', {
            p50: formatMilliseconds(data.latencyMs.p50, locale),
            max: formatMilliseconds(data.latencyMs.max, locale),
          })}
        />
        <MetricCard
          label={t('signals.errorRate')}
          value={formatRate(data.errorRate, locale)}
          hint={t('signals.ofRequests')}
        />
        <MetricCard
          label={t('signals.clientErrorRate')}
          value={formatRate(data.clientErrorRate, locale)}
          hint={t('signals.ofRequests')}
        />
      </div>

      <div>
        <SectionTitle>{t('signals.saturationTitle')}</SectionTitle>
        <SaturationPanel saturation={data.saturation} arcSize='sm' />
      </div>

      <div>
        <SectionTitle>{t('signals.routesTitle')}</SectionTitle>
        <RoutesTable routes={data.routes} />
      </div>
    </div>
  );
}
