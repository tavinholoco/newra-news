'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { FavoriteArticle } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import type { HeadingLevel } from '@/components/editorial/heading-level';
import { formatArticleDate, toDateSlug } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface BriefingCardCompactProps {
  briefing: FavoriteArticle;
  headingLevel?: HeadingLevel;
  className?: string;
}

/**
 * O briefing do dia na mesma forma que o `story-card-compact` dá à notícia:
 * chapéu, manchete e metadata, sem imagem.
 *
 * Existe porque a lista de salvos é **uma só** e mistura os dois tipos — e os
 * dois precisam parecer da mesma família sem parecer a mesma coisa. O que os
 * separa é o chapéu ("Briefing") e o destino: aqui é `/article/[date]`, não
 * `/news/[id]`.
 */
export function BriefingCardCompact({
  briefing,
  headingLevel: Heading = 'h3',
  className,
}: BriefingCardCompactProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  return (
    <article className={cn('group', className)}>
      <Link href={`/article/${toDateSlug(briefing.date)}`} className='block'>
        <p className='text-overline uppercase text-link'>{t('briefKicker')}</p>

        <Heading className='mt-1 font-display text-body font-bold leading-snug text-ink transition-colors duration-base line-clamp-3 group-hover:text-link'>
          {briefing.title}
        </Heading>

        <p className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted'>
          <span>
            {formatArticleDate(briefing.date, toDateFormatLocale(locale))}
          </span>
          <span>{tCommon('sourcesConsulted', { count: briefing.newsCount })}</span>
        </p>
      </Link>
    </article>
  );
}
