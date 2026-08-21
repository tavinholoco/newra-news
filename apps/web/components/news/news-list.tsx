'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { EditorialStory } from '@newranews/types';
import { HeroStory } from '@/components/editorial/hero-story';
import { SectionHeading } from '@/components/editorial/section-heading';
import { StoryCardHorizontal } from '@/components/editorial/story-card-horizontal';

interface NewsListProps {
  stories: EditorialStory[];
  /** Termo buscado, repassado aos cards para o destaque da §7. */
  highlight?: string;
  /**
   * Abre com o hero da categoria. Só na primeira página e sem busca: eleger um
   * "destaque" na página 4 de um resultado é uma escolha arbitrária que a tela
   * apresentaria como editorial.
   */
  showLead?: boolean;
  /**
   * Controle por matéria — na `/news`, o favoritar.
   *
   * É função e não um `ReactNode` fixo porque cada item precisa do seu; e é
   * prop e não import direto para o `NewsList` não passar a depender de sessão
   * e de favoritos, que são assunto da Fase 6.
   */
  renderAction?: (storyId: string) => ReactNode;
}

/** Quantas matérias acompanham o hero na coluna lateral. */
const ASIDE_SIZE = 3;

/**
 * A lista editorial da `/news` (§7): hero da categoria e a lista abaixo.
 *
 * Não desenha card nenhum — compõe os de `components/editorial/`, os mesmos da
 * Home. Era esse o ponto de os cards terem nascido client components na Fase 3.
 *
 * **A hierarquia de heading é a correção obrigatória da ficha da tela.** O grid
 * antigo emitia `h3` sem `h2` antes e `heading-order` reprovava (§3.3 do
 * diagnóstico). Aqui o `h1` é o título da página, o hero é `h2`, o "Últimas" é
 * `h2` e os cards são `h3`.
 */
export function NewsList({
  stories,
  highlight = '',
  showLead = true,
  renderAction,
}: NewsListProps) {
  const t = useTranslations('news');
  const headingId = useId();

  const lead = showLead ? stories[0] : undefined;
  const remaining = lead ? stories.slice(1) : stories;
  const aside = lead ? remaining.slice(0, ASIDE_SIZE) : [];
  const list = lead ? remaining.slice(ASIDE_SIZE) : remaining;

  return (
    <div className='flex flex-col gap-section'>
      {lead ? (
        <div className='grid gap-block lg:grid-cols-3'>
          <HeroStory
            story={lead}
            action={renderAction?.(lead.id)}
            className='lg:col-span-2'
          />

          {/* Sem título próprio: esta coluna é a continuação do bloco de
              abertura, não uma seção nova. Um `h2` "Mais" aqui inventaria uma
              editoria que não existe. */}
          {aside.length > 0 ? (
            <ul className='flex flex-col divide-y divide-line'>
              {aside.map((story) => (
                <li key={story.id} className='py-4 first:pt-0 last:pb-0'>
                  <StoryCardHorizontal
                    story={story}
                    headingLevel='h3'
                    highlight={highlight}
                    action={renderAction?.(story.id)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {list.length > 0 ? (
        <section aria-labelledby={headingId}>
          <SectionHeading id={headingId} title={t('latestLabel')} />
          {/* Régua entre itens em vez de cartão solto: a lista é um bloco só, e
              é isso que a faz parecer acervo em vez de vitrine (§7). */}
          <ul className='grid grid-cols-1 gap-x-8 md:grid-cols-2'>
            {list.map((story) => (
              <li key={story.id} className='border-b border-line py-4'>
                <StoryCardHorizontal
                  story={story}
                  headingLevel='h3'
                  highlight={highlight}
                  action={renderAction?.(story.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
