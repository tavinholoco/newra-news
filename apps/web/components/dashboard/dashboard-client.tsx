'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { DashboardMetrics } from '@newranews/types';
import { Category as CategoryEnum } from '@newranews/types';
import { useDashboardMetrics } from '@/lib/queries';
import {
  formatCount,
  formatPercent,
  formatPipelineDuration,
  formatProviderName,
} from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { kpiDelta } from '@/lib/kpi';
import { MetricCard } from './metric-card';
import { DonutChart } from './donut-chart';
import { DashboardSkeleton } from './dashboard-skeleton';
import { GoldenSignals } from './golden-signals';

interface DashboardClientProps {
  initialData: DashboardMetrics | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className='font-display mb-4 text-xl font-bold text-foreground'>
      {children}
    </h2>
  );
}

/**
 * A aba de métricas do pipeline (§9 do plano de observabilidade, PR 5c).
 *
 * **A linha de KPI com variação vem primeiro** (§4.2, item 1): `491` sozinho
 * não diz nada, `491, +12,5% vs. média 7 d` diz. Três dos quatro cartões têm
 * chip; o quarto — a taxa de sucesso — **não tem par honesto no contrato**:
 * `lastMonth` não devolve quantos dias têm linha, e derivar a taxa de 30 dias
 * de `failureDays / 30` mentiria para o otimista em todo mês com dia sem
 * `DailyMetric` (29 a 31/08, quando a API esteve suspensa, são três). A §9
 * pedia quatro chips; o que ela não tinha medido é que o dado só sustenta
 * três, e um cartão sem chip é mais honesto que um chip inventado.
 *
 * As três colunas órfãs (`newsApiCount`, `rssCount`, `cleanupCount`) entram
 * aqui pela primeira vez — gravadas desde a V1, serializadas desde o 5b.
 */
export function DashboardClient({ initialData }: DashboardClientProps) {
  const t = useTranslations('dashboard');
  const tCategories = useTranslations('categories');
  const locale = useLocale();
  const { data, isFetching, isError } = useDashboardMetrics(
    initialData ?? undefined,
  );

  const categoryLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const key of Object.values(CategoryEnum)) {
      labels[key] = tCategories(key);
    }
    return labels;
  }, [tCategories]);

  const dateLocale = toDateFormatLocale(locale);

  if (isError) {
    return (
      <p className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
        {t('loadError')}
      </p>
    );
  }

  if (!data || (isFetching && !initialData)) {
    return <DashboardSkeleton />;
  }

  const { today, lastWeek, lastMonth } = data;
  const vsWeek = t('kpi.vsWeekAverage');
  const vsMonth = t('kpi.vsMonthAverage');

  return (
    <div className='flex flex-col gap-10'>
      {/* A linha de KPI */}
      <section aria-label={t('kpi.label')}>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          <MetricCard
            label={t('kpi.newsToday')}
            value={today ? formatCount(today.newsCollected, dateLocale) : '—'}
            delta={kpiDelta(today?.newsCollected, lastWeek.avgNewsPerDay, {
              period: vsWeek,
              locale: dateLocale,
            })}
          />
          <MetricCard
            label={t('kpi.durationToday')}
            value={formatPipelineDuration(today?.pipelineDuration)}
            // Duração subindo é pior: a seta para cima sai vermelha.
            delta={kpiDelta(today?.pipelineDuration, lastWeek.avgPipelineDuration, {
              betterWhen: 'down',
              period: vsWeek,
              locale: dateLocale,
            })}
          />
          <MetricCard
            label={t('kpi.avgNewsWeek')}
            value={formatCount(Math.round(lastWeek.avgNewsPerDay), dateLocale)}
            delta={kpiDelta(lastWeek.avgNewsPerDay, lastMonth.avgNewsPerDay, {
              period: vsMonth,
              locale: dateLocale,
            })}
          />
          <MetricCard
            label={t('kpi.successRateWeek')}
            value={formatPercent(lastWeek.pipelineSuccessRate)}
            hint={t('daysWithData', { count: lastWeek.totalDays })}
          />
        </div>
      </section>

      {/* Hoje */}
      <section>
        <SectionTitle>{t('today')}</SectionTitle>
        {today ? (
          <div className='flex flex-col gap-6'>
            <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
              <MetricCard
                label={t('dailyArticle')}
                value={today.articleGenerated ? t('generated') : t('pending')}
                hint={
                  today.articleGenerated ? t('publishedHint') : t('runsAt')
                }
              />
              <MetricCard
                label={t('aiUsed')}
                value={formatProviderName(today.aiProvider)}
              />
              <MetricCard
                label={t('pipelineErrors')}
                value={today.pipelineErrors}
              />
              <MetricCard
                label={t('cleanupCount')}
                value={formatCount(today.cleanupCount, dateLocale)}
                hint={t('cleanupHint')}
              />
            </div>

            <div>
              <h3 className='font-display mb-4 text-base font-semibold text-foreground'>
                {t('ingestionBySource')}
              </h3>
              {/**
                * NewsData e RSS são as duas fontes de ingestão, e a rosquinha
                * responde a única pergunta que elas têm: que parte veio de qual.
                * As duas colunas eram gravadas desde a V1 e descartadas na
                * serialização até o 5b.
                */}
              <DonutChart
                label={t('ingestionBySource')}
                slices={[
                  { key: 'newsApi', label: t('sourceNewsApi'), value: today.newsApiCount },
                  { key: 'rss', label: t('sourceRss'), value: today.rssCount },
                ]}
                center={{
                  value: formatCount(today.newsCollected, dateLocale),
                  caption: t('centerNews'),
                }}
              />
            </div>
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>
            {t('notRunYet')}
          </p>
        )}
      </section>

      {/* Últimos 7 dias */}
      <section>
        <SectionTitle>{t('last7Days')}</SectionTitle>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-2'>
          <MetricCard
            label={t('articlesGenerated')}
            value={lastWeek.totalArticlesGenerated}
            hint={t('daysWithData', { count: lastWeek.totalDays })}
          />
          <MetricCard
            label={t('avgDuration')}
            value={formatPipelineDuration(lastWeek.avgPipelineDuration)}
          />
        </div>
      </section>

      {/* Distribuição por categoria e uso de IA: rosquinhas (§4.3) */}
      <div className='grid grid-cols-1 gap-10 lg:grid-cols-2'>
        <section>
          <SectionTitle>{t('newsByCategory')}</SectionTitle>
          <DonutChart
            label={t('newsByCategory')}
            slices={Object.entries(lastWeek.newsByCategory).map(([key, value]) => ({
              key,
              label: categoryLabels[key] ?? key,
              value,
            }))}
          />
        </section>

        <section>
          <SectionTitle>{t('aiUsage')}</SectionTitle>
          {/**
            * Duas fatias, e o buraco do meio carrega o número de dias que
            * caíram para o Groq — é o que torna visível o gatilho documentado
            * de "três dias seguidos de fallback".
            */}
          <DonutChart
            label={t('aiUsage')}
            slices={Object.entries(lastWeek.aiProviderUsage).map(([key, value]) => ({
              key,
              label: PROVIDER_LABELS[key] ?? formatProviderName(key),
              value,
            }))}
            center={{
              value: formatCount(lastWeek.aiProviderUsage.groq ?? 0, dateLocale),
              caption: t('centerFallbacks'),
            }}
          />
        </section>
      </div>

      {/* Últimos 30 dias */}
      <section>
        <SectionTitle>{t('last30Days')}</SectionTitle>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          <MetricCard
            label={t('newsCollected')}
            value={formatCount(lastMonth.totalNewsCollected, dateLocale)}
          />
          <MetricCard
            label={t('articlesGenerated')}
            value={lastMonth.totalArticlesGenerated}
          />
          <MetricCard
            label={t('avgNewsPerDay')}
            value={formatCount(Math.round(lastMonth.avgNewsPerDay), dateLocale)}
          />
          <MetricCard
            label={t('failureDays')}
            value={lastMonth.failureDays}
          />
        </div>
      </section>

      {/* Os quatro sinais da API — consulta própria, esqueleto próprio */}
      <section>
        <SectionTitle>{t('signals.title')}</SectionTitle>
        <p className='mb-6 max-w-prose text-sm text-muted-foreground'>
          {t('signals.description')}
        </p>
        <GoldenSignals />
      </section>
    </div>
  );
}
