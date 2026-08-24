'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { HomeCategorySection } from '@newranews/types';
import { SectionHeading } from '@/components/editorial/section-heading';
import { StoryCard } from '@/components/editorial/story-card';
import { StoryCardHorizontal } from '@/components/editorial/story-card-horizontal';
import { cn } from '@/lib/utils';

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

      {/* Duas colunas só quando há o que pôr na segunda. Uma categoria com uma
          matéria só — acontece, e a baseline de 21/08 flagrou "Esportes" assim
          — deixava metade da faixa em branco, o que lê como bloco quebrado e
          não como categoria magra. Sozinho, o lead ocupa a largura toda. */}
      <div className={cn('grid gap-block', rest.length > 0 && 'md:grid-cols-2')}>
        <StoryCard
          source='category-section'
          position={0}
          story={lead}
          size='lead'
          sizes={
            rest.length > 0
              ? '(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 608px'
              : '(max-width: 1280px) 100vw, 1216px'
          }
        />

        {rest.length > 0 ? (
          <ol className='flex flex-col divide-y divide-line'>
            {rest.map((story, index) => (
              <li key={story.id} className='py-4 first:pt-0 last:pb-0'>
                <StoryCardHorizontal
                  story={story}
                  source='category-section'
                  position={index + 1}
                />
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
