'use client';

import type { DashboardMetrics } from '@newranews/types';
import { useDashboardMetrics } from '@/lib/queries';
import {
  CATEGORY_LABELS,
  formatCount,
  formatPercent,
  formatPipelineDuration,
  formatProviderName,
} from '@/lib/format';
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
  const { data, isFetching, isError } = useDashboardMetrics(
    initialData ?? undefined,
  );

  if (isError) {
    return (
      <p className='rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
        Não foi possível carregar as métricas. Tente novamente.
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
        <SectionTitle>Hoje</SectionTitle>
        {today ? (
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5'>
            <MetricCard
              label='Notícias coletadas'
              value={formatCount(today.newsCollected)}
            />
            <MetricCard
              label='Artigo do dia'
              value={today.articleGenerated ? 'Gerado' : 'Pendente'}
              hint={
                today.articleGenerated
                  ? 'Publicado na home e no histórico'
                  : 'O pipeline roda diariamente às 8h (BRT)'
              }
            />
            <MetricCard
              label='IA utilizada'
              value={formatProviderName(today.aiProvider)}
            />
            <MetricCard
              label='Duração do pipeline'
              value={formatPipelineDuration(today.pipelineDuration)}
            />
            <MetricCard
              label='Erros no pipeline'
              value={today.pipelineErrors}
            />
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>
            O pipeline ainda não rodou hoje. Acompanhe após a execução diária
            (8h, horário de Brasília).
          </p>
        )}
      </section>

      {/* Últimos 7 dias */}
      <section>
        <SectionTitle>Últimos 7 dias</SectionTitle>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          <MetricCard
            label='Média de notícias/dia'
            value={formatCount(Math.round(lastWeek.avgNewsPerDay))}
          />
          <MetricCard
            label='Artigos gerados'
            value={lastWeek.totalArticlesGenerated}
            hint={`${lastWeek.totalDays} dias com dados`}
          />
          <MetricCard
            label='Taxa de sucesso'
            value={formatPercent(lastWeek.pipelineSuccessRate)}
          />
          <MetricCard
            label='Duração média'
            value={formatPipelineDuration(lastWeek.avgPipelineDuration)}
          />
        </div>
      </section>

      {/* Distribuição por categoria */}
      {Object.keys(lastWeek.newsByCategory).length > 0 && (
        <section>
          <SectionTitle>Notícias por categoria (7 dias)</SectionTitle>
          <CategoryBars data={lastWeek.newsByCategory} labels={CATEGORY_LABELS} />
        </section>
      )}

      {/* Uso de IA */}
      {Object.keys(lastWeek.aiProviderUsage).length > 0 && (
        <section>
          <SectionTitle>IA utilizada (7 dias)</SectionTitle>
          <CategoryBars data={lastWeek.aiProviderUsage} labels={PROVIDER_LABELS} />
        </section>
      )}

      {/* Últimos 30 dias */}
      <section>
        <SectionTitle>Últimos 30 dias</SectionTitle>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          <MetricCard
            label='Notícias coletadas'
            value={formatCount(lastMonth.totalNewsCollected)}
          />
          <MetricCard
            label='Artigos gerados'
            value={lastMonth.totalArticlesGenerated}
          />
          <MetricCard
            label='Média de notícias/dia'
            value={formatCount(Math.round(lastMonth.avgNewsPerDay))}
          />
          <MetricCard
            label='Dias com falha'
            value={lastMonth.failureDays}
          />
        </div>
      </section>
    </div>
  );
}
