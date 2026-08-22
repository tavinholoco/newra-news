'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Article } from '@newranews/types';
import { toDateFormatLocale } from '@/lib/i18n';
import { ArticleHistoryCard } from './article-history-card';
import { ArticleHistorySkeleton } from './article-history-skeleton';

interface ArticleGridProps {
  articles: Article[];
  isLoading?: boolean;
}

/** Chave de agrupamento: ano-mês, estável e ordenável. */
function monthKey(date: string): string {
  return date.slice(0, 7);
}

/**
 * O dia corrente em UTC, **depois da hidratação**.
 *
 * Ler o relógio durante o render quebra esta tela, e quebra em silêncio: a
 * `/article` é estática, então o HTML guarda o dia do *build* e o cliente
 * compara com o dia de *agora*. Toda meia-noite UTC os dois divergem, o selo
 * "Hoje" aparece num lado só, e o React derruba a hidratação da árvore inteira
 * (erros #418 e #422). Aconteceu em produção: o build correu 23:5x e a medição
 * do Lighthouse 00:04 — best-practices de `/article` caiu de 100 para 96,
 * sozinha entre as cinco rotas.
 *
 * Com o estado começando em `null`, servidor e primeira renderização do cliente
 * concordam (sem selo) e o selo entra no efeito. O custo é ele aparecer um
 * quadro depois; o benefício é a tela não depender de o dia não virar.
 */
function useTodayKey(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  return today;
}

/**
 * O histórico de briefings, agrupado por mês (§ ficha de `/article`).
 *
 * **O agrupamento é o que torna a lista navegável.** Sem ele são 89 datas
 * seguidas e nenhuma âncora; com ele, o leitor localiza "agosto" de relance. O
 * cabeçalho do mês traz a contagem porque a lista é paginada — o mês pode estar
 * partido entre duas páginas, e o número diz quantos há **nesta**.
 *
 * A ordem vem do servidor (`date desc`) e é preservada: agrupar aqui é só
 * inserir cabeçalhos, nunca reordenar.
 */
export function ArticleGrid({ articles, isLoading = false }: ArticleGridProps) {
  const t = useTranslations('article');
  const locale = useLocale();
  // Antes do `if` de carregamento: hook não pode ficar atrás de retorno cedo.
  const today = useTodayKey();

  if (isLoading) return <ArticleHistorySkeleton />;

  if (articles.length === 0) {
    return (
      <div className='flex flex-col items-center rounded-lg border border-dashed border-line-strong px-6 py-16 text-center'>
        <p className='font-display text-h4 font-bold text-ink'>
          {t('emptyTitle')}
        </p>
        <p className='mt-2 text-body-sm text-ink-secondary'>{t('emptyDesc')}</p>
      </div>
    );
  }

  const monthFormatter = new Intl.DateTimeFormat(toDateFormatLocale(locale), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const months = articles.reduce<Array<{ key: string; items: Article[] }>>(
    (groups, article) => {
      const key = monthKey(article.date);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(article);
      else groups.push({ key, items: [article] });
      return groups;
    },
    [],
  );

  return (
    <div className='flex flex-col gap-block'>
      {months.map((month) => (
        <section key={month.key}>
          <div className='flex items-baseline justify-between gap-4 border-b border-line-strong pb-2'>
            <h2 className='font-display text-h3 font-bold uppercase tracking-wide text-ink'>
              {monthFormatter.format(new Date(`${month.key}-01T00:00:00Z`))}
            </h2>
            <span className='shrink-0 text-meta text-ink-muted'>
              {t('monthCount', { count: month.items.length })}
            </span>
          </div>

          <ul className='divide-y divide-line'>
            {month.items.map((article) => (
              <li key={article.id}>
                <ArticleHistoryCard
                  article={article}
                  isToday={article.date.slice(0, 10) === today}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
