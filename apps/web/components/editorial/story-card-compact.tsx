'use client';

import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { ArticleMeta } from '@/components/editorial/article-meta';
import type { HeadingLevel } from '@/components/editorial/heading-level';
import { cn } from '@/lib/utils';
import type { EventSource } from '@newranews/types';
import { track } from '@/lib/analytics';

interface StoryCardCompactProps {
  story: EditorialStory;
  headingLevel?: HeadingLevel;
  /** Numeral do ranking. Decorativo: a posição real vem da ordem do `<ol>`. */
  rank?: number;
  /**
   * De onde este card foi renderizado. **Obrigatório de propósito**: é o que
   * separa o CTR do hero do CTR do rodapé, e prop opcional aqui viraria uso
   * novo sem atribuição nenhuma, descoberto só na hora de ler a métrica.
   */
  source: EventSource;
  /** Posição na lista, base 0. */
  position: number;
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
  source,
  position,
  className,
}: StoryCardCompactProps) {
  const t = useTranslations('categories');


  // O evento sai no clique, **antes** da navegação. É por isso que `track()`
  // enfileira e descarrega com `sendBeacon`: um `fetch` comum morreria no meio
  // da troca de página, e o clique que leva a pessoa embora é justamente o mais
  // interessante de medir.
  function handleOpen() {
    track('story_open', {
      storyId: story.id,
      category: story.category,
      position,
      source,
    });
  }

  return (
    <article className={cn('group', className)}>
      <Link
        href={`/news/${story.id}`}
        onClick={handleOpen}
        className='flex items-start gap-3'
      >
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
