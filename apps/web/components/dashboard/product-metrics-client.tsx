'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useProductMetrics } from '@/lib/queries';
import { formatCalendarDay, formatCount, formatPercent } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { readThroughOf } from '@/lib/reading-depth';
import { fillCalendarDays } from '@/lib/series';
import { MetricCard } from './metric-card';
import { CategoryBars } from './category-bars';
import { SeriesBars } from './series-bars';
import { WindowSelector } from './window-selector';
import { DashboardSkeleton } from './dashboard-skeleton';

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
  const locale = toDateFormatLocale(useLocale());
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
  // A "leitura completa" divide pela tela vista, e é a API quem cruza o par
  // (sessão, conteúdo) — 13.4 do plano de observabilidade. Até 09/10/2026 a
  // tela fazia `scroll90 / opened` aqui: o 90% de qualquer origem, inclusive
  // as nossas ferramentas, sobre os cliques em card.
  const leitura = readThroughOf(readingDepth);

  return (
    <section aria-busy={isFetching} className='flex flex-col gap-8'>
      <WindowSelector
        options={WINDOWS}
        value={days}
        onChange={setDays}
        optionLabel={(janela) => t('windowDays', { days: janela })}
        label={t('windowLabel')}
      />

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
        <SectionTitle>{t('byDayTitle')}</SectionTitle>
        <p className='mb-3 max-w-prose text-sm text-muted-foreground'>{t('byDayHint')}</p>
        {/**
          * `byDay` voltava desde a Fase 8 e nenhum componente o desenhava. É
          * série temporal — barra na ordem da data, nunca rosquinha nem o
          * `CategoryBars`, que reordena por valor (§4.3 do plano de
          * observabilidade). **Todos os dias da janela entram**, com zero onde
          * não houve evento: a API só devolve os dias com linha, e um dia com
          * evento numa janela de 30 virava uma barra de largura inteira.
          */}
        <SeriesBars
          label={t('byDayTitle')}
          points={fillCalendarDays(data.byDay, data.period, (date) => ({
            date,
            sessions: 0,
            events: 0,
          })).map((day) => ({
            key: day.date,
            label: formatCalendarDay(day.date, locale),
            value: day.sessions,
          }))}
        />
      </div>

      <div>
        <SectionTitle>{t('readingTitle')}</SectionTitle>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'>
          <MetricCard
            label={t('readRate')}
            value={leitura.state === 'measured' ? formatPercent(leitura.rate) : '—'}
            hint={
              leitura.state === 'unavailable'
                ? t('readRateUnavailable')
                : leitura.state === 'no-sample'
                  ? t('readRateNoSample')
                  : t('readRateHint')
            }
          />
          <MetricCard
            label={t('viewed')}
            value={leitura.state === 'unavailable' ? '—' : formatCount(leitura.viewed)}
            hint={t('viewedHint')}
          />
          <MetricCard label={t('scroll25')} value={formatCount(readingDepth.scroll25)} />
          <MetricCard label={t('scroll50')} value={formatCount(readingDepth.scroll50)} />
          <MetricCard
            label={t('opened')}
            value={formatCount(readingDepth.opened)}
            hint={t('openedHint')}
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
