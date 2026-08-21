'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import type { EditorialStory } from '@newranews/types';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { ArticleMeta } from '@/components/editorial/article-meta';
import { StoryImage } from '@/components/editorial/story-image';
import { cn } from '@/lib/utils';

interface HeroStoryProps {
  story: EditorialStory;
  className?: string;
}

/**
 * A matéria de abertura da Home (§6.2).
 *
 * Não é o `ArticleCard` da V1 com fonte maior: a §2.2 aponta a falta de
 * hierarquia como o problema central da interface antiga, e hierarquia aqui
 * quer dizer que **uma** matéria recebe imagem grande, manchete em escala de
 * display e dek — e as outras, não.
 *
 * A imagem é o LCP da página e carrega com `priority`. O contrato garante que
 * o hero é a mais recente **com** imagem, então o placeholder de marca só
 * aparece se o acervo inteiro estiver sem capa.
 *
 * **Sem indicador "Atualizado"**, que a §6.2 previa como opcional: o
 * `updatedAt` do contrato é o timestamp de escrita da linha (`@updatedAt` do
 * Prisma), não uma revisão editorial — ele muda quando o pipeline reclassifica
 * a categoria. Rotular isso como "atualizado" mentiria em praticamente toda
 * matéria.
 */
export function HeroStory({ story, className }: HeroStoryProps) {
  const t = useTranslations('categories');
  const tHome = useTranslations('home');

  return (
    <article
      aria-label={tHome('leadStory')}
      className={cn('group flex flex-col', className)}
    >
      <Link href={`/news/${story.id}`} className='flex flex-col'>
        <div className='relative overflow-hidden rounded-lg'>
          <StoryImage
            src={story.imageUrl}
            alt={story.title}
            sizes='(max-width: 1024px) 100vw, 66vw'
            priority
            placeholderSize='lg'
          />
          <div className='absolute left-4 top-4'>
            <Badge>{t(story.category)}</Badge>
          </div>
        </div>

        <h2 className='mt-4 font-display text-h1 font-bold text-ink transition-colors duration-base group-hover:text-link'>
          {story.title}
        </h2>

        {/* `line-clamp-3` não é estética, é contenção. O `dek` do contrato é a
            `description` da News, e boa parte dos feeds põe ali a matéria
            inteira — em produção o hero chegou com 1.876 caracteres, e o
            `latest` tem deks de 6.381. Sem o clamp o hero vira uma tela e meia
            de texto corrido, e o parágrafo passa a ser o **elemento de LCP** da
            Home, medido em 2,8–3,9s. Todos os outros cards já clampavam; este
            era o único que não. */}
        {story.dek ? (
          <p className='mt-3 max-w-prose text-body-lg text-ink-secondary line-clamp-3'>
            {story.dek}
          </p>
        ) : null}

        {/* Sem `sourceHref`: o hero inteiro já é um link. */}
        <ArticleMeta
          source={story.source}
          publishedAt={story.publishedAt}
          readingTimeMinutes={story.readingTimeMinutes ?? undefined}
          size='body-sm'
          className='mt-4'
        />

        {/* Afordância visual, não um segundo link: está dentro da mesma âncora. */}
        <span className='mt-4 inline-flex items-center gap-1.5 font-display text-body-sm font-semibold text-link transition-colors duration-base group-hover:text-link-hover'>
          {tHome('readStory')}
          <ArrowRight className='size-4' aria-hidden='true' />
        </span>
      </Link>
    </article>
  );
}
