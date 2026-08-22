'use client';

import { signIn, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Bookmark } from 'lucide-react';
import type { FavoriteItemType } from '@newranews/types';
import { cn } from '@/lib/utils';
import { useIsFavorite, useToggleFavorite } from '@/lib/queries';

interface SaveButtonProps {
  itemId: string;
  /** `NEWS` (padrão) ou `ARTICLE` — o briefing do dia também se salva. */
  itemType?: FavoriteItemType;
  /** Sobre imagem: fundo escuro translúcido, para o ícone não sumir na foto. */
  overlay?: boolean;
  className?: string;
}

/**
 * Salvar — a peça editorial que substitui o `FavoriteButton` da V1.
 *
 * Duas mudanças além do estilo:
 *
 * - **conhece o tipo do item**, e é o que permite salvar o briefing do dia (a
 *   pendência que a Fase 5 registrou e o `Favorite` polimórfico destravou);
 * - **lê `useIsFavorite`, que consulta só os ids**. A versão anterior baixava
 *   os 100 primeiros salvos com conteúdo e procurava no cliente — do 101º em
 *   diante o ícone mentia.
 *
 * Deslogado não é erro: o clique manda para o sign-in, que volta para cá.
 */
export function SaveButton({
  itemId,
  itemType = 'NEWS',
  overlay,
  className,
}: SaveButtonProps) {
  const { status } = useSession();
  const t = useTranslations('favorites');
  const isSaved = useIsFavorite(itemId, itemType, status === 'authenticated');
  const toggle = useToggleFavorite(itemId, itemType);

  function handleClick() {
    if (status !== 'authenticated') {
      void signIn();
      return;
    }
    toggle.mutate(isSaved);
  }

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={toggle.isPending}
      aria-pressed={isSaved}
      aria-label={isSaved ? t('remove') : t('add')}
      className={cn(
        'inline-flex items-center justify-center rounded-full p-2 transition-colors duration-base ease-standard',
        overlay
          ? 'bg-black/40 text-white backdrop-blur-sm hover:bg-black/60'
          : 'border border-line bg-surface text-ink-muted hover:border-line-strong hover:text-link',
        isSaved && (overlay ? 'bg-brand-solid text-on-brand hover:bg-brand-solid' : 'text-link'),
        toggle.isPending && 'opacity-60',
        className,
      )}
    >
      <Bookmark className={cn('size-4', isSaved && 'fill-current')} aria-hidden='true' />
    </button>
  );
}
