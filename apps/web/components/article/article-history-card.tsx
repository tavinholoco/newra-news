'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Article } from '@newranews/types';
import { formatArticleDate, toDateSlug } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ArticleHistoryCardProps {
  article: Article;
  /** Marca o briefing do dia corrente. */
  isToday?: boolean;
}

/**
 * Um briefing na lista cronológica (§ ficha de `/article`).
 *
 * **Item de lista, não cartão.** O histórico é uma sequência de datas, e uma
 * grade de cartões brancos com sombra faria cada dia parecer um produto
 * separado — que é o problema de hierarquia que a §2.2 aponta na V1. Aqui a
 * data segura a coluna da esquerda e a manchete corre à direita, separadas por
 * régua, como uma edição.
 */
export function ArticleHistoryCard({
  article,
  isToday = false,
}: ArticleHistoryCardProps) {
  const t = useTranslations('article');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  return (
    <Link
      href={`/article/${toDateSlug(article.date)}`}
      className='group flex flex-col gap-1 py-5 sm:flex-row sm:gap-8'
    >
      <div className='flex shrink-0 items-baseline gap-2 sm:w-40'>
        <time
          dateTime={article.date}
          className='text-meta uppercase tracking-wide text-ink-muted'
        >
          {formatArticleDate(article.date, toDateFormatLocale(locale))}
        </time>
        {isToday ? (
          <span className='rounded-full bg-brand-solid px-2 py-0.5 text-meta font-semibold text-on-brand'>
            {t('todayBadge')}
          </span>
        ) : null}
      </div>

      <div className='min-w-0 flex-1'>
        <h3
          className={cn(
            'font-display text-h4 font-bold text-ink transition-colors duration-base line-clamp-2 group-hover:text-link',
          )}
        >
          {article.title}
        </h3>
        <p className='mt-1.5 text-body-sm text-ink-secondary line-clamp-2'>
          {article.summary}
        </p>
        <p className='mt-2 text-meta text-ink-muted'>
          {tCommon('sources', { count: article.newsCount })}
        </p>
      </div>
    </Link>
  );
}
