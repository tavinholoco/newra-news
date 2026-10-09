'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useHttpMetrics } from '@/lib/queries';
import { formatCount, formatRate, formatUptime } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { SaturationPanel } from '@/components/dashboard/golden-signals';
import { PlanReadingForm } from './plan-reading-form';
import { UptimeDays } from './uptime-days';
import { uptimeByDayOf } from '@/lib/saturation';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * "Está tudo de pé agora?" — a linha de KPI da visão geral (§4.1 do plano de
 * observabilidade), com o **arco das horas do plano** que a §4.3 chama de o
 * mais importante do plano inteiro em custo/benefício: um arco, um número, e
 * o incidente que suspendeu a API por dois dias em 29/08/2026 vira algo que
 * se vê chegando. Desde a Fase 13 (13b) o arco é do **workspace** quando há
 * leitura do Billing — e é aqui, abaixo dele, que a leitura se registra.
 *
 * Lê a mesma consulta que o painel de sinais da `/admin/metrics`
 * (`useHttpMetrics`, uma chave): quem abre as duas abas faz uma requisição. O
 * que muda é o recorte — aqui a saturação inteira com o arco grande e uma
 * linha sobre a instância; lá, os quatro sinais com a latência por rota.
 */
export function ApiHealth() {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  const { data, isError } = useHttpMetrics();
  // As horas por dia (13.9) — ausentes na API de antes da Fase 13 (armadilha 37).
  const uptimeSeries = data?.saturation.plan ? uptimeByDayOf(data.saturation.plan) : null;

  return (
    <section className='rounded-lg border border-border bg-card p-6'>
      <h2 className='font-display mb-1 text-lg font-semibold text-foreground'>
        {t('overview.title')}
      </h2>
      <p className='mb-6 text-sm text-muted-foreground'>{t('overview.description')}</p>

      {isError ? (
        <p role='alert' className='text-sm text-danger'>
          {t('overview.loadError')}
        </p>
      ) : !data ? (
        <div className='flex flex-wrap items-center gap-10'>
          <Skeleton className='h-40 w-40 rounded-full' />
          <Skeleton className='h-24 w-24 rounded-full' />
          <Skeleton className='h-24 flex-1' />
        </div>
      ) : (
        <>
          <SaturationPanel saturation={data.saturation} arcSize='lg' />
          {/* A série por dia e a leitura do Billing (Fase 13, 13b) só existem
              com as horas do plano à mão — a leitura é comparada com elas. */}
          {data.saturation.plan && (
            <>
              {uptimeSeries && <UptimeDays series={uptimeSeries} />}
              <PlanReadingForm plan={data.saturation.plan} />
            </>
          )}
          <p className='mt-6 text-xs text-muted-foreground'>
            {t('overview.instance', {
              uptime: formatUptime(data.uptimeSeconds, locale),
              requests: formatCount(data.totalRequests, locale),
              errorRate: formatRate(data.errorRate, locale),
            })}
          </p>
        </>
      )}
    </section>
  );
}
