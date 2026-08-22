'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bookmark } from 'lucide-react';
import { useFavorites } from '@/lib/queries';
import { usePathname, useRouter } from '@/i18n/navigation';
import { StoryCardCompact } from '@/components/editorial/story-card-compact';
import { BriefingCardCompact } from '@/components/editorial/briefing-card-compact';
import { SaveButton } from '@/components/editorial/save-button';
import { Pagination } from '@/components/editorial/pagination';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { newsToStory } from '@/lib/story';

const PAGE_SIZE = 20;

/**
 * A tela "Salvos" (§28 da Fase 6).
 *
 * É **uma lista só**, notícias e briefings na ordem em que foram salvos — o
 * desenho polimórfico do `Favorite` existe justamente para isso. Cada linha
 * traz o mesmo botão de salvar da tela de origem, aqui no estado preenchido:
 * remover é o gesto que esta tela precisa oferecer, e repeti-lo é mais barato
 * do que ensinar um controle novo.
 *
 * **Pagina, e a página mora na URL.** A versão anterior pedia 100 itens e
 * desenhava o que viesse: quem passasse disso via a conta anunciar "132
 * salvos" e a lista mostrar 100, sem nada dizendo que havia mais. A rota já
 * paginava; faltava a tela usar.
 *
 * O nível dos headings é `h2` porque a página tem um `h1` próprio e nenhuma
 * seção entre os dois — na Home o mesmo card é `h3`.
 */
export function FavoritesList() {
  const t = useTranslations('favorites');
  const tCommon = useTranslations('common');
  const tPagination = useTranslations('pagination');

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Valor estranho na URL cai na página 1 em silêncio, como no acervo: a query
  // string é editável por qualquer um.
  const parsed = Number.parseInt(searchParams.get('page') ?? '', 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const { data, isLoading, isError, refetch } = useFavorites(
    {},
    { page, limit: PAGE_SIZE },
  );

  const saved = data?.data ?? [];
  const meta = data?.meta;

  // Tirar o último item de uma página interna deixaria o leitor olhando para
  // "você não salvou nada" com dezenas de itens salvos. Volta para a primeira.
  useEffect(() => {
    if (meta && saved.length === 0 && page > 1) {
      router.replace(pathname, { scroll: false });
    }
  }, [meta, saved.length, page, router, pathname]);

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
    <div className='flex flex-col gap-6'>
      <ul className='divide-y divide-line border-y border-line'>
        {saved.map((item, index) => (
          <li key={item.id} className='flex items-start gap-4 py-4'>
            <div className='min-w-0 flex-1'>
              {item.itemType === 'NEWS' ? (
                <StoryCardCompact
                  story={newsToStory(item.news)}
                  headingLevel='h2'
                  source='favorites'
                  position={index}
                />
              ) : (
                <BriefingCardCompact
                  briefing={item.article}
                  headingLevel='h2'
                  source='favorites'
                />
              )}
            </div>

            <SaveButton
              itemId={item.itemId}
              itemType={item.itemType}
              category={item.itemType === 'NEWS' ? item.news.category : undefined}
              origin='favorites'
              className='shrink-0'
            />
          </li>
        ))}
      </ul>

      <Pagination
        page={meta?.page ?? page}
        totalPages={meta?.totalPages ?? 1}
        label={tPagination('label')}
        onChange={(next) =>
          router.push(next > 1 ? `${pathname}?page=${next}` : pathname, {
            scroll: false,
          })
        }
      />
    </div>
  );
}
