'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProductMetrics } from '@/lib/queries';
import { formatCount, formatPercent } from '@/lib/format';
import { MetricCard } from './metric-card';
import { CategoryBars } from './category-bars';
import { DashboardSkeleton } from './dashboard-skeleton';
import { cn } from '@/lib/utils';

/** As janelas oferecidas. 90 é a retenção do evento cru — pedir mais é vazio. */
const WINDOWS = [7, 30, 90] as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className='font-display mb-4 text-xl font-bold text-foreground'>
      {children}
    </h2>
  );
}

/**
 * A tela de métricas de **produto** (Fase 8).
 *
 * O painel ao lado mede o **pipeline** — notícias coletadas, artigo gerado,
 * duração, erros. Sáude de máquina. Esta lê o `ProductEvent`: comportamento de
 * gente. Ela existe porque a camada de analytics gravava e **ninguém lia**.
 *
 * **O bloco de audiência é o que responde "dá para vender patrocínio?".** E ele
 * separa duas coisas que é fácil confundir: `sessions` é volume de visita, não
 * de pessoas — o `sessionId` morre ao fechar a aba, que é justamente o que
 * mantém a medição anônima. Quem mede audiência **recorrente** são os dois
 * números persistentes ao lado: assinante da newsletter e conta criada.
 */
export function ProductMetricsClient() {
  const t = useTranslations('productMetrics');
  const tCategories = useTranslations('categories');
  const [days, setDays] = useState<number>(30);

  const { data, isFetching, isError } = useProductMetrics(days);

  if (isError) {
    return (
      <p role='alert' className='text-sm text-danger'>
        {t('loadError')}
      </p>
    );
  }

  if (!data) return <DashboardSkeleton />;

  const { audience, readingDepth } = data;
  const taxaDeLeitura =
    readingDepth.opened > 0 ? readingDepth.scroll90 / readingDepth.opened : 0;

  return (
    <section aria-busy={isFetching} className='flex flex-col gap-8'>
      <div className='flex flex-wrap items-center gap-2'>
        {WINDOWS.map((janela) => (
          <button
            key={janela}
            type='button'
            onClick={() => setDays(janela)}
            aria-pressed={days === janela}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors duration-fast',
              days === janela
                ? 'border-line-strong bg-surface-accent font-semibold text-link'
                : 'border-line text-ink-secondary hover:text-link',
            )}
          >
            {t('windowDays', { days: janela })}
          </button>
        ))}
      </div>

      <div>
        <SectionTitle>{t('audienceTitle')}</SectionTitle>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          {/* A ordem é deliberada: o número que um patrocinador pede vem
              primeiro, e o de sessões vem por último com a ressalva. */}
          <MetricCard
            label={t('subscribers')}
            value={formatCount(audience.newsletterSubscribers)}
            hint={t('subscribersHint')}
          />
          <MetricCard
            label={t('accounts')}
            value={formatCount(audience.accounts)}
            hint={t('accountsHint')}
          />
          <MetricCard
            label={t('sessions')}
            value={formatCount(audience.sessions)}
            hint={t('sessionsHint')}
          />
        </div>
      </div>

      <div>
        <SectionTitle>{t('readingTitle')}</SectionTitle>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <MetricCard label={t('opened')} value={formatCount(readingDepth.opened)} />
          <MetricCard label={t('scroll25')} value={formatCount(readingDepth.scroll25)} />
          <MetricCard label={t('scroll50')} value={formatCount(readingDepth.scroll50)} />
          <MetricCard
            label={t('readRate')}
            value={formatPercent(taxaDeLeitura)}
            hint={t('readRateHint')}
          />
        </div>
      </div>

      <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
        <div>
          <SectionTitle>{t('bySourceTitle')}</SectionTitle>
          <CategoryBars
            data={Object.fromEntries(
              data.storyOpensBySource.map((i) => [i.source, i.count]),
            )}
          />
        </div>

        <div>
          <SectionTitle>{t('byCategoryTitle')}</SectionTitle>
          <CategoryBars
            data={Object.fromEntries(
              data.categoryViews.map((i) => [i.category, i.count]),
            )}
            labels={Object.fromEntries(
              data.categoryViews.map((i) => [i.category, tCategories(i.category)]),
            )}
          />
        </div>
      </div>

      <div>
        <SectionTitle>{t('eventsTitle')}</SectionTitle>
        <CategoryBars
          data={Object.fromEntries(data.byType.map((i) => [i.type, i.count]))}
        />
      </div>

      <div>
        <SectionTitle>{t('searchGapsTitle')}</SectionTitle>
        <p className='mb-3 max-w-prose text-sm text-muted-foreground'>
          {t('searchGapsHint')}
        </p>
        {data.searchesWithoutResults.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{t('noSearchGaps')}</p>
        ) : (
          <ul className='divide-y divide-line border-y border-line'>
            {data.searchesWithoutResults.map((busca) => (
              <li
                key={busca.query}
                className='flex items-center justify-between gap-4 py-2 text-sm'
              >
                <span className='min-w-0 truncate text-foreground'>
                  {busca.query}
                </span>
                <span className='shrink-0 text-muted-foreground'>
                  {formatCount(busca.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
