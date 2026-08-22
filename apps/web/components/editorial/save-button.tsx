'use client';

import { signIn, useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Bookmark } from 'lucide-react';
import type { FavoriteItemType } from '@newranews/types';
import { cn } from '@/lib/utils';
import { useIsFavorite, useToggleFavorite } from '@/lib/queries';
import { track } from '@/lib/analytics';
import type { Category, EventSource } from '@newranews/types';

interface SaveButtonProps {
  itemId: string;
  /** `NEWS` (padrão) ou `ARTICLE` — o briefing do dia também se salva. */
  itemType?: FavoriteItemType;
  /** De onde o gesto partiu — vai no `favorite_add`. */
  origin: EventSource;
  /**
   * A categoria da matéria. **Só existe para `NEWS`**, e por isso é opcional:
   * um briefing não tem categoria, e o payload de `favorite_add` exige uma.
   * Sem ela o evento não sai — salvar briefing fica sem medição até o catálogo
   * ganhar um evento próprio, o que é escopo de outra entrega.
   */
  category?: Category;
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
  origin,
  category,
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

    // **Só quando salva**, nunca quando remove: o catálogo tem `favorite_add` e
    // não tem o par oposto. Medir remoção com o mesmo evento inflaria "saves por
    // usuário" contando o desfazer como interação positiva.
    if (!isSaved && itemType === 'NEWS' && category) {
      track('favorite_add', { storyId: itemId, category, origin });
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
