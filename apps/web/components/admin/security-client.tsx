'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ErrorSummaryWindow } from '@newranews/types';
import { useErrorSummary } from '@/lib/queries';
import { formatCount, formatDateTime } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { CategoryBars } from '@/components/dashboard/category-bars';
import { DonutChart } from '@/components/dashboard/donut-chart';
import { MetricCard } from '@/components/dashboard/metric-card';
import { WindowSelector } from '@/components/dashboard/window-selector';
import { Skeleton } from '@/components/ui/skeleton';
import { AuditTrail } from './audit-trail';
import { ErrorGroupsTable } from './error-groups-table';
import { InvariantsPanel } from './invariants-panel';

/** As duas janelas que `GET /api/admin/errors` aceita. */
const WINDOWS: readonly ErrorSummaryWindow[] = ['24h', '7d'];

const WINDOW_KEY = {
  '24h': 'security.window24h',
  '7d': 'security.window7d',
} as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className='font-display mb-1 text-lg font-semibold text-foreground'>
      {children}
    </h2>
  );
}

function ErrorsSkeleton() {
  return (
    <div className='flex flex-col gap-8'>
      <div className='grid grid-cols-2 gap-4 md:grid-cols-5'>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className='flex flex-col gap-2 rounded-lg border p-4'>
            <Skeleton className='h-3 w-24' />
            <Skeleton className='h-8 w-16' />
          </div>
        ))}
      </div>
      <div className='flex items-center gap-6'>
        <Skeleton className='h-36 w-36 rounded-full' />
        <div className='flex flex-1 flex-col gap-2'>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className='h-4 w-full' />
          ))}
        </div>
      </div>
      <div className='space-y-3'>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className='h-12 w-full' />
        ))}
      </div>
    </div>
  );
}

/**
 * A aba **Logs e segurança** (§4.1 e §9 do plano de observabilidade): "o que
 * quebrou e quem tentou o quê?".
 *
 * Cinco painéis, na ordem em que se lê um incidente: o **resumo** da janela
 * (total, falhas distintas, e as três severidades), a **rosquinha por
 * categoria** — que diz de onde vem a dor sem ler uma linha —, a **tabela de
 * falhas** com busca, filtros e o `lastRequestId`, as **invariantes** (Fase 6:
 * o último relatório da etapa 9.5 — "o que deveria ter acontecido
 * aconteceu?") e a **trilha de auditoria**.
 *
 * **Sem `refetchInterval`**, como o resto da área (armadilha 3 do §17).
 *
 * **A rosquinha tem fatias fixas**: `byCategory` vem sempre com as seis
 * categorias da taxonomia, na ordem dela, e `keepOrder` mantém a cor de cada
 * uma estável entre janelas — `upstream` é sempre a primeira cor, mesmo
 * quando o dia inteiro foi `authorization`.
 */
export function SecurityClient() {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  // `errorWindow`, e não `window`: o nome curto sombrearia o global do
  // navegador dentro do componente.
  const [errorWindow, setErrorWindow] = useState<ErrorSummaryWindow>('24h');
  const { data, isFetching, isError } = useErrorSummary(errorWindow);

  const bySeverity = (severity: 'WARN' | 'ERROR' | 'FATAL') =>
    data?.bySeverity.find((entry) => entry.severity === severity)?.count ?? 0;

  return (
    <div className='space-y-12'>
      <section aria-busy={isFetching}>
        <SectionTitle>{t('security.errors.title')}</SectionTitle>
        <p className='mb-4 text-sm text-muted-foreground'>{t('security.errors.description')}</p>

        <div className='mb-6'>
          <WindowSelector
            options={WINDOWS}
            value={errorWindow}
            onChange={setErrorWindow}
            optionLabel={(option) => t(WINDOW_KEY[option])}
            label={t('security.errors.windowLabel')}
          />
        </div>

        {isError ? (
          <p role='alert' className='text-sm text-danger'>
            {t('security.errors.loadError')}
          </p>
        ) : !data ? (
          <ErrorsSkeleton />
        ) : (
          <div className='flex flex-col gap-8'>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-5'>
              <MetricCard
                label={t('security.errors.total')}
                value={formatCount(data.total, locale)}
                hint={t('security.errors.sinceHint', {
                  since: formatDateTime(data.window.since, locale),
                })}
              />
              <MetricCard
                label={t('security.errors.distinct')}
                value={formatCount(data.distinctFingerprints, locale)}
                hint={t('security.errors.distinctHint')}
              />
              <MetricCard label='WARN' value={formatCount(bySeverity('WARN'), locale)} />
              <MetricCard label='ERROR' value={formatCount(bySeverity('ERROR'), locale)} />
              <MetricCard label='FATAL' value={formatCount(bySeverity('FATAL'), locale)} />
            </div>

            {/**
              * `truncated` é a leitura que bateu no teto de 5.000 linhas: o
              * recorte está incompleto e a tela diz, em vez de mostrar um
              * total menor com cara de total.
              */}
            {data.truncated && (
              <p className='rounded-md border border-line-strong px-4 py-3 text-body-sm text-ink-secondary'>
                {t('security.errors.truncated')}
              </p>
            )}

            <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
              <div>
                <h3 className='font-display mb-4 text-base font-semibold text-foreground'>
                  {t('security.errors.byCategory')}
                </h3>
                <DonutChart
                  label={t('security.errors.byCategory')}
                  slices={data.byCategory.map((entry) => ({
                    key: entry.category,
                    label: entry.category,
                    value: entry.count,
                  }))}
                  center={{
                    value: formatCount(data.total, locale),
                    caption: t('security.errors.centerCaption'),
                  }}
                  keepOrder
                  emptyText={t('security.errors.empty')}
                />
              </div>
              <div>
                <h3 className='font-display mb-4 text-base font-semibold text-foreground'>
                  {t('security.errors.byOrigin')}
                </h3>
                <CategoryBars
                  data={Object.fromEntries(
                    data.byOrigin
                      .filter((entry) => entry.count > 0)
                      .map((entry) => [entry.origin, entry.count]),
                  )}
                />
              </div>
            </div>

            <div>
              <h3 className='font-display mb-4 text-base font-semibold text-foreground'>
                {t('security.errors.tableTitle')}
              </h3>
              <ErrorGroupsTable
                groups={data.groups}
                categories={data.byCategory.map((entry) => entry.category)}
              />
            </div>
          </div>
        )}
      </section>

      {/**
        * A seção nasceu vazia no 5c e a Fase 6 a preencheu (§10 do plano). O
        * painel desenha os próprios três estados — indisponível, nenhuma
        * verificação ainda, e a tabela — e carrega em consulta separada, como
        * os outros: uma fronteira de rota trocaria a aba inteira pelo estado
        * do painel que falhou.
        */}
      <section>
        <SectionTitle>{t('security.invariants.title')}</SectionTitle>
        <p className='mb-4 text-sm text-muted-foreground'>{t('security.invariants.description')}</p>
        <InvariantsPanel />
      </section>

      <AuditTrail />
    </div>
  );
}
