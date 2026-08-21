'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { HomeCategorySection } from '@newranews/types';
import { SectionHeading } from '@/components/editorial/section-heading';
import { StoryCard } from '@/components/editorial/story-card';
import { StoryCardHorizontal } from '@/components/editorial/story-card-horizontal';

interface CategorySectionProps {
  section: HomeCategorySection;
  className?: string;
}

/**
 * Uma faixa por categoria: lead com imagem, o resto em lista (§6.1).
 *
 * O "ver tudo" aponta para `/news?category=X` — a mesma URL que a
 * `editorial-nav` da Fase 2 passou a usar. A categoria é estado de URL desde
 * então, então o leitor pode compartilhar e o buscador pode indexar; duplicar
 * isso como estado local aqui reabriria o problema que a Fase 2 fechou.
 */
export function CategorySection({ section, className }: CategorySectionProps) {
  const t = useTranslations('categories');
  const tHome = useTranslations('home');
  const headingId = useId();

  const [lead, ...rest] = section.stories;
  if (!lead) return null;

  const categoryLabel = t(section.category);

  return (
    <section aria-labelledby={headingId} className={className}>
      <SectionHeading
        id={headingId}
        title={categoryLabel}
        href={`/news?category=${section.category}`}
        linkLabel={tHome('categoryViewAll', { category: categoryLabel })}
      />

      <div className='grid gap-block md:grid-cols-2'>
        <StoryCard
          story={lead}
          size='lead'
          sizes='(max-width: 768px) 100vw, 50vw'
        />

        {rest.length > 0 ? (
          <ol className='flex flex-col divide-y divide-line'>
            {rest.map((story) => (
              <li key={story.id} className='py-4 first:pt-0 last:pb-0'>
                <StoryCardHorizontal story={story} />
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
