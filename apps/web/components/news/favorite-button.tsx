'use client';

import { signIn, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import type { FavoriteItemType } from '@newranews/types';
import { cn } from '@/lib/utils';
import { useIsFavorite, useToggleFavorite } from '@/lib/queries';

interface FavoriteButtonProps {
  itemId: string;
  /** `NEWS` (padrão) ou `ARTICLE` — o briefing do dia também pode ser salvo. */
  itemType?: FavoriteItemType;
  /** Estilo para sobreposição no card de notícia (fundo escuro translúcido). */
  overlay?: boolean;
  className?: string;
}

export function FavoriteButton({
  itemId,
  itemType = 'NEWS',
  overlay,
  className,
}: FavoriteButtonProps) {
  const { status } = useSession();
  const t = useTranslations('favorites');
  const isFavorited = useIsFavorite(itemId, itemType, status === 'authenticated');
  const toggle = useToggleFavorite(itemId, itemType);

  function handleClick() {
    if (status !== 'authenticated') {
      void signIn();
      return;
    }
    toggle.mutate(isFavorited);
  }

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={toggle.isPending}
      aria-pressed={isFavorited}
      aria-label={isFavorited ? t('remove') : t('add')}
      className={cn(
        'inline-flex items-center justify-center rounded-full p-2 transition-all',
        overlay
          ? 'bg-black/40 text-white backdrop-blur-sm hover:bg-black/60'
          : 'border border-border bg-background text-muted-foreground hover:border-brand-solid hover:text-link',
        isFavorited && (overlay ? 'bg-brand-solid text-on-brand hover:bg-brand-solid' : 'text-link'),
        toggle.isPending && 'opacity-60',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', isFavorited && 'fill-current')} />
    </button>
  );
}
