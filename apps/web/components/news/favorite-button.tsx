'use client';

import { signIn, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import type { News } from '@newranews/types';
import { cn } from '@/lib/utils';
import { useIsFavorite, useToggleFavorite } from '@/lib/queries';

interface FavoriteButtonProps {
  newsId: string;
  news?: News;
  /** Estilo para sobreposição no card de notícia (fundo escuro translúcido). */
  overlay?: boolean;
  className?: string;
}

export function FavoriteButton({ newsId, news, overlay, className }: FavoriteButtonProps) {
  const { status } = useSession();
  const t = useTranslations('favorites');
  const isFavorited = useIsFavorite(newsId, status === 'authenticated');
  const toggle = useToggleFavorite(newsId, news);

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
          : 'border border-border bg-background text-muted-foreground hover:border-brand-600 hover:text-brand-600',
        isFavorited && (overlay ? 'bg-brand-600 text-white hover:bg-brand-600' : 'text-brand-600'),
        toggle.isPending && 'opacity-60',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', isFavorited && 'fill-current')} />
    </button>
  );
}
