'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';
import type { EditorialStory } from '@newranews/types';
import { StoryCardCompact } from '@/components/editorial/story-card-compact';
import { cn } from '@/lib/utils';

interface TrendingListProps {
  stories: EditorialStory[];
  className?: string;
}

/**
 * O ranking de "em alta" (§6.1, §18.2).
 *
 * O score é do backend — recência com meia-vida de 12h mais favoritos × 2 —, e
 * esta tela só o exibe na ordem recebida. O numeral é `aria-hidden` no
 * `StoryCardCompact`: a posição já é semântica pelo `<ol>`.
 *
 * **Vazio é resultado válido, não defeito.** `trending` volta vazia quando nada
 * foi publicado nas últimas 24h, e o bloco inteiro sai da página — é a mesma
 * regra das categorias sem matéria.
 */
export function TrendingList({ stories, className }: TrendingListProps) {
  const t = useTranslations('home');
  const headingId = useId();

  if (stories.length === 0) return null;

  return (
    <section
      aria-labelledby={headingId}
      className={cn('rounded-lg bg-surface p-5 ring-1 ring-line', className)}
    >
      <div className='mb-4 flex items-center gap-2 border-b border-line-strong pb-2 text-link'>
        <TrendingUp className='size-4 shrink-0' aria-hidden='true' />
        <h2
          id={headingId}
          className='font-display text-h4 font-bold uppercase tracking-wide'
        >
          {t('trending')}
        </h2>
      </div>

      <ol className='flex flex-col divide-y divide-line'>
        {stories.map((story, index) => (
          <li key={story.id} className='py-3 first:pt-0 last:pb-0'>
            <StoryCardCompact
              story={story}
              rank={index + 1}
              source='trending'
              position={index}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
