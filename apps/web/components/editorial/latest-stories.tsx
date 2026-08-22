'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { SectionHeading } from '@/components/editorial/section-heading';
import { StoryCard } from '@/components/editorial/story-card';

interface LatestStoriesProps {
  stories: EditorialStory[];
  className?: string;
}

/**
 * A grade cronológica de "mais notícias" (§6.1).
 *
 * É o que sobra depois de hero, top stories, trending e categorias — a
 * precedência de `/api/home` garante que nada aqui já apareceu acima. Duas
 * colunas e não três: a grade divide a largura com o ranking de "em alta", e
 * três colunas nessa faixa deixariam a manchete com quatro palavras por linha.
 */
export function LatestStories({ stories, className }: LatestStoriesProps) {
  const t = useTranslations('home');
  const headingId = useId();

  if (stories.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={className}>
      <SectionHeading
        id={headingId}
        title={t('latestNews')}
        href='/news'
        linkLabel={t('viewAll')}
      />

      <div className='grid gap-block sm:grid-cols-2'>
        {stories.map((story, index) => (
          <StoryCard
            key={story.id}
            story={story}
            source='latest'
            position={index}
          />
        ))}
      </div>
    </section>
  );
}
