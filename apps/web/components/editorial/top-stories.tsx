'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { SectionHeading } from '@/components/editorial/section-heading';
import { StoryCardHorizontal } from '@/components/editorial/story-card-horizontal';

interface TopStoriesProps {
  stories: EditorialStory[];
  className?: string;
}

/**
 * A coluna de "principais notícias" ao lado do hero (§6.1).
 *
 * As matérias vêm de `/api/home`, que já garante que nenhuma delas é o hero —
 * a precedência entre blocos é do servidor, não desta tela.
 *
 * Devolve `null` com lista vazia: seção com título e nada dentro é pior que
 * seção nenhuma (nota da §2 do sitemap).
 */
export function TopStories({ stories, className }: TopStoriesProps) {
  const t = useTranslations('home');
  const headingId = useId();

  if (stories.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={className}>
      <SectionHeading id={headingId} title={t('topStories')} />

      {/* `divide-y` e não `border-b` no item: a divisória some sozinha no
          último, sem depender de `last:` em toda variação de lista. */}
      <ol className='flex flex-col divide-y divide-line'>
        {stories.map((story, index) => (
          <li key={story.id} className='py-4 first:pt-0 last:pb-0'>
            <StoryCardHorizontal
              story={story}
              source='top-stories'
              position={index}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
