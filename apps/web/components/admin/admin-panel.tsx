'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Play, Trash2 } from 'lucide-react';
import { useDeleteNews, useNewsList, useRunPipeline } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toDateFormatLocale } from '@/lib/i18n';
import type { RunPipelineResult } from '@newranews/types';

/**
 * O que o disparo fez, dito com as palavras do que aconteceu.
 *
 * **Os três desfechos eram a mesma frase verde**, porque a rota respondia
 * `200 { status: 'started' }` mesmo quando o `triggerPipeline` não disparava
 * nada — ele é idempotente por dia. Em 25/08/2026 o botão foi clicado às ~16:25
 * UTC, o painel disse "disparado com sucesso", e o run das 11:00 já tinha
 * fechado: nada rodou, e a tela não deu nenhum sinal disso.
 *
 * A hora sai do `startedAt` do run **referido** — o que nasceu agora, ou o que
 * já existia —, e é o dado que responde à pergunta seguinte de quem clicou:
 * "então quando foi?".
 *
 * Formatada no cliente, e é seguro: este texto só existe depois do clique, num
 * componente que já é `'use client'`. Não há HTML de servidor com que divergir.
 */
function TriggerOutcome({ result }: { result: RunPipelineResult }) {
  const t = useTranslations('admin');
  const locale = useLocale();

  const outcome = result.data?.outcome;
  const startedAt = result.data?.startedAt;

  // Sem desfecho legível, a mensagem antiga é o que resta — e ela é a certa
  // para o único caso em que isso acontece: uma resposta que não conhecemos.
  if (!outcome || !startedAt) {
    return (
      <p role='status' className='mt-4 text-sm text-success'>
        {t('runSuccess')}
      </p>
    );
  }

  const time = new Date(startedAt).toLocaleTimeString(
    toDateFormatLocale(locale),
    { hour: '2-digit', minute: '2-digit' },
  );

  if (outcome === 'started') {
    return (
      <p role='status' className='mt-4 text-sm text-success'>
        {t('runSuccess')}
      </p>
    );
  }

  // Não é erro — o servidor fez o certo. É informação, e a cor diz isso: o
  // verde afirmaria que algo rodou.
  return (
    <p role='status' className='mt-4 text-sm text-ink-secondary'>
      {outcome === 'already-running'
        ? t('runAlreadyRunning', { time })
        : t('runAlreadyRanToday', { time })}
    </p>
  );
}

export function AdminPanel() {
  const t = useTranslations('admin');

  const runPipeline = useRunPipeline();
  const deleteNews = useDeleteNews();
  const newsQuery = useNewsList({ page: 1, limit: 20 });

  return (
    <div className='space-y-10'>
      <section className='rounded-lg border border-border bg-card p-6'>
        <h2 className='font-display mb-1 text-lg font-semibold text-foreground'>
          {t('runPipeline')}
        </h2>
        <p className='mb-4 text-sm text-muted-foreground'>{t('runPipelineHint')}</p>

        <Button
          onClick={() => runPipeline.mutate()}
          disabled={runPipeline.isPending}
        >
          {runPipeline.isPending ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Play className='mr-2 h-4 w-4' />
          )}
          {runPipeline.isPending ? t('running') : t('runPipelineButton')}
        </Button>

        {runPipeline.isSuccess && (
          <TriggerOutcome result={runPipeline.data} />
        )}
        {runPipeline.isError && (
          <p role='alert' className='mt-4 text-sm text-destructive'>
            {runPipeline.error?.message ?? t('runError')}
          </p>
        )}
      </section>

      <section>
        <h2 className='font-display mb-4 text-lg font-semibold text-foreground'>
          {t('newsListTitle')}
        </h2>

        {newsQuery.isLoading && !newsQuery.data ? (
          <div className='space-y-3'>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className='h-12 w-full' />
            ))}
          </div>
        ) : newsQuery.isError ? (
          <p role='alert' className='text-sm text-destructive'>
            {t('loadError')}
          </p>
        ) : (newsQuery.data?.data.length ?? 0) === 0 ? (
          <p className='text-sm text-muted-foreground'>{t('empty')}</p>
        ) : (
          <ul className='divide-y divide-border overflow-hidden rounded-lg border border-border bg-card'>
            {newsQuery.data?.data.map((news) => (
              <li
                key={news.id}
                className='flex items-center gap-4 px-4 py-3'
              >
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-medium text-foreground'>
                    {news.title}
                  </p>
                  <p className='truncate text-xs text-muted-foreground'>
                    {news.source} · {new Date(news.publishedAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => deleteNews.mutate(news.id)}
                  disabled={deleteNews.isPending}
                  aria-label={`${t('delete')}: ${news.title}`}
                >
                  {deleteNews.isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Trash2 className='h-4 w-4' />
                  )}
                  <span className='sr-only'>{t('delete')}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        {deleteNews.isError && (
          <p role='alert' className='mt-2 text-sm text-destructive'>
            {t('deleteError')}
          </p>
        )}
        <p className='mt-2 text-xs text-muted-foreground'>
          {t('totalNews', { count: newsQuery.data?.meta.total ?? 0 })}
        </p>
      </section>
    </div>
  );
}
