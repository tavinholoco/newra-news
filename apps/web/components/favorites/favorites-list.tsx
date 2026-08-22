'use client';

import { useTranslations } from 'next-intl';
import { Bookmark } from 'lucide-react';
import { useFavorites } from '@/lib/queries';
import { StoryCardCompact } from '@/components/editorial/story-card-compact';
import { BriefingCardCompact } from '@/components/editorial/briefing-card-compact';
import { SaveButton } from '@/components/editorial/save-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { newsToStory } from '@/lib/story';

/**
 * A tela "Salvos" (§28 da Fase 6).
 *
 * É **uma lista só**, notícias e briefings na ordem em que foram salvos — o
 * desenho polimórfico do `Favorite` existe justamente para isso. Cada linha
 * traz o mesmo botão de salvar da tela de origem, aqui no estado preenchido:
 * remover é o gesto que esta tela precisa oferecer, e repeti-lo é mais barato
 * do que ensinar um controle novo.
 *
 * O nível dos headings é `h2` porque a página tem um `h1` próprio e nenhuma
 * seção entre os dois — na Home o mesmo card é `h3`.
 */
export function FavoritesList() {
  const t = useTranslations('favorites');
  const tCommon = useTranslations('common');
  const { data, isLoading, isError, refetch } = useFavorites();

  if (isLoading && !data) {
    return (
      <ul className='divide-y divide-line border-y border-line'>
        {Array.from({ length: 6 }).map((_, index) => (
          <li key={index} className='space-y-2 py-4'>
            <Skeleton className='h-3 w-20' />
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/3' />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div
        role='alert'
        className='rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center'
      >
        <p className='mb-4 text-ink-secondary'>{t('loadError')}</p>
        <Button variant='outline' onClick={() => void refetch()}>
          {tCommon('retry')}
        </Button>
      </div>
    );
  }

  const saved = data?.data ?? [];

  if (saved.length === 0) {
    return (
      <div className='rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center'>
        <Bookmark className='mx-auto mb-3 size-8 text-line-strong' aria-hidden='true' />
        <p className='font-display text-h4 text-ink'>{t('emptyTitle')}</p>
        <p className='mx-auto mt-2 max-w-prose text-body-sm text-ink-secondary'>
          {t('emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <ul className='divide-y divide-line border-y border-line'>
      {saved.map((item) => (
        <li key={item.id} className='flex items-start gap-4 py-4'>
          <div className='min-w-0 flex-1'>
            {item.itemType === 'NEWS' ? (
              <StoryCardCompact story={newsToStory(item.news)} headingLevel='h2' />
            ) : (
              <BriefingCardCompact briefing={item.article} headingLevel='h2' />
            )}
          </div>

          <SaveButton itemId={item.itemId} itemType={item.itemType} className='shrink-0' />
        </li>
      ))}
    </ul>
  );
}
