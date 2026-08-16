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
import { MetricCard } from './metric-card';
import { CategoryBars } from './category-bars';
import { DashboardSkeleton } from './dashboard-skeleton';

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

  return (
    <div className='flex flex-col gap-10'>
      {/* Hoje */}
      <section>
        <SectionTitle>{t('today')}</SectionTitle>
        {today ? (
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5'>
            <MetricCard
              label={t('newsCollected')}
              value={formatCount(today.newsCollected, dateLocale)}
            />
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
              label={t('pipelineDuration')}
              value={formatPipelineDuration(today.pipelineDuration)}
            />
            <MetricCard
              label={t('pipelineErrors')}
              value={today.pipelineErrors}
            />
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
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          <MetricCard
            label={t('avgNewsPerDay')}
            value={formatCount(Math.round(lastWeek.avgNewsPerDay), dateLocale)}
          />
          <MetricCard
            label={t('articlesGenerated')}
            value={lastWeek.totalArticlesGenerated}
            hint={t('daysWithData', { count: lastWeek.totalDays })}
          />
          <MetricCard
            label={t('successRate')}
            value={formatPercent(lastWeek.pipelineSuccessRate)}
          />
          <MetricCard
            label={t('avgDuration')}
            value={formatPipelineDuration(lastWeek.avgPipelineDuration)}
          />
        </div>
      </section>

      {/* Distribuição por categoria */}
      {Object.keys(lastWeek.newsByCategory).length > 0 && (
        <section>
          <SectionTitle>{t('newsByCategory')}</SectionTitle>
          <CategoryBars data={lastWeek.newsByCategory} labels={categoryLabels} />
        </section>
      )}

      {/* Uso de IA */}
      {Object.keys(lastWeek.aiProviderUsage).length > 0 && (
        <section>
          <SectionTitle>{t('aiUsage')}</SectionTitle>
          <CategoryBars data={lastWeek.aiProviderUsage} labels={PROVIDER_LABELS} />
        </section>
      )}

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
    </div>
  );
}
