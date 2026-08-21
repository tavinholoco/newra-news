'use client';

import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { ArticleMeta } from '@/components/editorial/article-meta';
import type { HeadingLevel } from '@/components/editorial/heading-level';
import { cn } from '@/lib/utils';

interface StoryCardCompactProps {
  story: EditorialStory;
  headingLevel?: HeadingLevel;
  /** Numeral do ranking. Decorativo: a posição real vem da ordem do `<ol>`. */
  rank?: number;
  className?: string;
}

/**
 * Manchete e metadata, sem imagem (§11).
 *
 * É o item de ranking do "Em alta" e de qualquer lista onde a imagem seria
 * ruído. Quando recebe `rank`, o numeral entra como ornamento **aria-hidden**:
 * quem usa leitor de tela já recebe a posição do `<ol>` que envolve a lista, e
 * ouvir "3" antes de cada manchete seria a mesma informação duas vezes.
 */
export function StoryCardCompact({
  story,
  headingLevel: Heading = 'h3',
  rank,
  className,
}: StoryCardCompactProps) {
  const t = useTranslations('categories');

  return (
    <article className={cn('group', className)}>
      <Link href={`/news/${story.id}`} className='flex items-start gap-3'>
        {rank !== undefined ? (
          <span
            aria-hidden='true'
            className='font-display text-h3 font-bold leading-none text-link tabular-nums'
          >
            {rank}
          </span>
        ) : null}

        <div className='min-w-0 flex-1'>
          <p className='text-overline uppercase text-ink-muted'>
            {t(story.category)}
          </p>
          <Heading className='mt-1 font-display text-body font-bold leading-snug text-ink transition-colors duration-base line-clamp-3 group-hover:text-link'>
            {story.title}
          </Heading>
          {/* Sem `sourceHref`: o item inteiro já é um link. */}
          <ArticleMeta source={story.source} publishedAt={story.publishedAt} className='mt-1.5' />
        </div>
      </Link>
    </article>
  );
}
