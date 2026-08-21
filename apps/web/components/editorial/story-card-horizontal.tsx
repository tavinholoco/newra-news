'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { ArticleMeta } from '@/components/editorial/article-meta';
import { StoryImage } from '@/components/editorial/story-image';
import { HighlightTerm } from '@/components/editorial/highlight-term';
import type { HeadingLevel } from '@/components/editorial/heading-level';
import { cn } from '@/lib/utils';

interface StoryCardHorizontalProps {
  story: EditorialStory;
  headingLevel?: HeadingLevel;
  /** Omite a miniatura — usado quando a coluna é estreita demais. */
  showImage?: boolean;
  /** Termo buscado, para destacar na manchete (§7). Vazio não destaca nada. */
  highlight?: string;
  /**
   * Controle solto no canto do item — hoje só o favoritar da listagem.
   *
   * Fica **fora** da âncora, como irmão dela: dentro seria botão aninhado em
   * link, e o clique dispararia os dois.
   */
  action?: ReactNode;
  className?: string;
}

/**
 * Miniatura à esquerda, manchete à direita (§11).
 *
 * É o formato das colunas laterais — "principais notícias" e as matérias que
 * seguem o lead de uma seção de categoria. Não tem dek: numa coluna de ~1/3 da
 * largura, três linhas de resumo empurram a próxima manchete para fora da
 * dobra e a lista deixa de ser escaneável, que é a razão de ela existir.
 */
export function StoryCardHorizontal({
  story,
  headingLevel: Heading = 'h3',
  showImage = true,
  highlight = '',
  action,
  className,
}: StoryCardHorizontalProps) {
  const t = useTranslations('categories');

  return (
    <article className={cn('group flex items-start gap-2', className)}>
      <Link
        href={`/news/${story.id}`}
        className='flex min-w-0 flex-1 items-start gap-3'
      >
        {showImage ? (
          <StoryImage
            src={story.imageUrl}
            alt={story.title}
            sizes='96px'
            aspect='photo'
            placeholderSize='sm'
            className='w-24 shrink-0 rounded-md'
          />
        ) : null}

        <div className='min-w-0 flex-1'>
          <p className='text-overline uppercase text-link'>
            {t(story.category)}
          </p>
          <Heading className='mt-1 font-display text-body font-bold leading-snug text-ink transition-colors duration-base line-clamp-3 group-hover:text-link'>
            <HighlightTerm text={story.title} term={highlight} />
          </Heading>
          {/* Sem `sourceHref`: o item inteiro já é um link. */}
          <ArticleMeta
            source={story.source}
            publishedAt={story.publishedAt}
            className='mt-1.5'
          />
        </div>
      </Link>

      {action ? <div className='shrink-0'>{action}</div> : null}
    </article>
  );
}
