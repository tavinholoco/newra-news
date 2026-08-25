'use client';

import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { ArticleMeta } from '@/components/editorial/article-meta';
import { StoryImage } from '@/components/editorial/story-image';
import type { HeadingLevel } from '@/components/editorial/heading-level';
import { cn } from '@/lib/utils';
import type { EventSource } from '@newranews/types';
import { track } from '@/lib/analytics';

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
 * O card editorial vertical: imagem, categoria, manchete, dek e metadata (§11).
 *
 * **É client component de propósito.** Precisa de `useTranslations` para o
 * rótulo da categoria, e um server component assíncrono não pode ser
 * renderizado de dentro de um client component — o que quebraria o reuso na
 * listagem CSR de `/news` (Fase 4). Continua renderizando no servidor: a Home
 * é SSG/ISR.
 *
 * **Sem foto, ele vira um card de texto — e isso vale para um quarto do
 * acervo.** Medido em 25/08/2026 sobre as 6.669 linhas de produção: **1.703
 * notícias (25,5%) não têm imagem em lugar nenhum do feed**. A Folha, a
 * TechCrunch e a ESPN simplesmente não mandam uma, e as 107 que estavam
 * escondidas dentro do corpo HTML já foram recuperadas pela ingestão — o resto
 * não existe.
 *
 * Até aqui essas 1.703 recebiam a caixa de imagem com o placeholder de marca:
 * um retângulo laranja com um "N", repetido a cada quatro cards da grade. O
 * placeholder continua existindo, mas para o que ele sempre foi bom — a foto
 * que **existe e não carrega** (o `fallback` do `SafeImage`). Anunciar ausência
 * de foto com um bloco de cor é gastar o elemento mais pesado da composição
 * para não dizer nada.
 *
 * O que entra no lugar não é "o mesmo card sem a imagem": a manchete cresce, o
 * dek ganha linhas, e um filete da cor da categoria segura a coluna. A célula
 * continua cheia, então a grade mantém o ritmo — que era a única coisa que o
 * retângulo laranja resolvia.
 */
export function StoryCard({
  story,
  headingLevel: Heading = 'h3',
  size = 'default',
  showDek = true,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 384px',
  priority = false,
  source,
  position,
  className,
}: StoryCardProps) {
  const t = useTranslations('categories');
  const isLead = size === 'lead';
  const hasImage = Boolean(story.imageUrl);


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
    <article
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-lg bg-card ring-1 ring-line',
        className,
      )}
    >
      <Link
        href={`/news/${story.id}`}
        onClick={handleOpen}
        className='flex h-full flex-col'
      >
        {hasImage ? (
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
        ) : null}

        <div
          className={cn(
            'flex flex-1 flex-col gap-2 p-4',
            // O filete é o que dá coluna ao card de texto. Vertical e à
            // esquerda, na cor da categoria: é o mesmo gesto do
            // `section-heading`, e não pede altura como a caixa de imagem
            // pediria.
            !hasImage && 'gap-3 border-l-2 border-brand-accent pl-4',
          )}
        >
          {/* Sem foto, a categoria não tem onde flutuar — e vira a primeira
              linha do card, que é o lugar dela numa peça só de texto. */}
          {hasImage ? null : (
            <Badge className='self-start'>{t(story.category)}</Badge>
          )}

          {/* Sem `leading-snug`: `text-h3`/`text-h4` já trazem a entrelinha do
              papel (1,3 e 1,35). Um `leading-*` aqui brigaria com o token — e
              perderia, porque o `cn` sabe que a escala nomeada é font-size. */}
          <Heading
            className={cn(
              'font-display font-bold text-ink transition-colors duration-base group-hover:text-link',
              // O espaço que a foto ocuparia vai para o texto: a manchete sobe
              // um degrau da escala e ganha uma linha antes de truncar.
              isLead || !hasImage ? 'text-h3' : 'text-h4',
              hasImage ? 'line-clamp-3' : 'line-clamp-4',
            )}
          >
            {story.title}
          </Heading>

          {showDek && story.dek ? (
            <p
              className={cn(
                'text-ink-secondary',
                isLead || !hasImage ? 'text-body' : 'text-body-sm',
                hasImage
                  ? isLead
                    ? 'line-clamp-3'
                    : 'line-clamp-2'
                  : 'line-clamp-5',
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
