'use client';

import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { ArticleMeta } from '@/components/editorial/article-meta';
import { StoryImage } from '@/components/editorial/story-image';
import type { HeadingLevel } from '@/components/editorial/heading-level';
import { cn } from '@/lib/utils';

interface StoryCardProps {
  story: EditorialStory;
  /** Ver `HeadingLevel`: quem posiciona o card decide o nível. */
  headingLevel?: HeadingLevel;
  /** `lead` é o card maior que abre uma seção; `default` é o do grid. */
  size?: 'default' | 'lead';
  /** Esconde o dek onde a coluna é estreita demais para três linhas de resumo. */
  showDek?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * O card editorial vertical: imagem, categoria, manchete, dek e metadata (§11).
 *
 * **É client component de propósito.** Precisa de `useTranslations` para o
 * rótulo da categoria, e um server component assíncrono não pode ser
 * renderizado de dentro de um client component — o que quebraria o reuso na
 * listagem CSR de `/news` (Fase 4). Continua renderizando no servidor: a Home
 * é SSG/ISR.
 */
export function StoryCard({
  story,
  headingLevel: Heading = 'h3',
  size = 'default',
  showDek = true,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority = false,
  className,
}: StoryCardProps) {
  const t = useTranslations('categories');
  const isLead = size === 'lead';

  return (
    <article
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-lg bg-card ring-1 ring-line',
        className,
      )}
    >
      <Link href={`/news/${story.id}`} className='flex h-full flex-col'>
        <div className='relative'>
          <StoryImage
            src={story.imageUrl}
            alt={story.title}
            sizes={sizes}
            priority={priority}
            placeholderSize={isLead ? 'lg' : 'md'}
          />
          <div className='absolute left-3 top-3'>
            <Badge>{t(story.category)}</Badge>
          </div>
        </div>

        <div className='flex flex-1 flex-col gap-2 p-4'>
          {/* Sem `leading-snug`: `text-h3`/`text-h4` já trazem a entrelinha do
              papel (1,3 e 1,35). Um `leading-*` aqui brigaria com o token — e
              perderia, porque o `cn` sabe que a escala nomeada é font-size. */}
          <Heading
            className={cn(
              'font-display font-bold text-ink transition-colors duration-base group-hover:text-link',
              isLead ? 'text-h3 line-clamp-3' : 'text-h4 line-clamp-3',
            )}
          >
            {story.title}
          </Heading>

          {showDek && story.dek ? (
            <p
              className={cn(
                'text-ink-secondary',
                isLead ? 'text-body line-clamp-3' : 'text-body-sm line-clamp-2',
              )}
            >
              {story.dek}
            </p>
          ) : null}

          {/* Sem `sourceHref`: o card inteiro já é um link — âncora aninhada. */}
          <ArticleMeta
            source={story.source}
            publishedAt={story.publishedAt}
            readingTimeMinutes={story.readingTimeMinutes ?? undefined}
            className='mt-auto pt-2'
          />
        </div>
      </Link>
    </article>
  );
}
