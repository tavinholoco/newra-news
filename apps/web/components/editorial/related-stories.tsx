'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { SectionHeading } from '@/components/editorial/section-heading';
import { StoryCard } from '@/components/editorial/story-card';

interface RelatedStoriesProps {
  stories: EditorialStory[];
}

/**
 * "Leia também" ao fim da notícia (§9).
 *
 * A escolha vem do servidor (`GET /api/news/:id/related`): mesma categoria em
 * ±72h, com dois níveis de fallback. Sem embeddings nesta fase — o acervo é de
 * notícia diária e a categoria já é sinal forte, como a §9 admite.
 *
 * Devolve `null` com lista vazia. O endpoint devolve vazio quando a matéria é a
 * única da categoria num acervo recém-limpo, e é estado normal; o cliente HTTP
 * também devolve vazio em falha, de propósito, para o bloco do rodapé não
 * derrubar a página.
 *
 * `h3` nos cards, abaixo do `h2` da seção — o mesmo contrato de nível que a Home
 * usa.
 */
export function RelatedStories({ stories }: RelatedStoriesProps) {
  const t = useTranslations('news');
  const headingId = useId();

  if (stories.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId} title={t('relatedTitle')} />

      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'>
        {stories.map((story, index) => (
          <StoryCard
            source='related'
            position={index}
            key={story.id}
            story={story}
            headingLevel='h3'
            showDek={false}
            sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 25vw, 288px'
          />
        ))}
      </div>
    </section>
  );
}
