'use client';

import { useTranslations } from 'next-intl';
import {
  AD_FORMAT_HEIGHT,
  AD_MOBILE_FORMAT,
  hasAdInventory,
  type AdFormat,
  type AdPlacement,
} from '@/lib/ads';
import { cn } from '@/lib/utils';

interface AdSlotProps {
  placement: AdPlacement;
  format: AdFormat;
  className?: string;
}

/**
 * Espaço de anúncio reservado (§22 do plano, §8 dos slots).
 *
 * Duas regras, e as duas são sobre CLS:
 *
 * 1. **Sem inventário não renderiza nada** — nem caixa vazia, nem a palavra
 *    "Publicidade". Hoje é sempre esse o caso, e o slot custa zero pixel.
 * 2. **Com inventário, a altura é reservada antes de o criativo chegar.** É a
 *    diferença entre um anúncio que aparece e um que empurra a página inteira
 *    para baixo depois que o leitor já começou a ler.
 *
 * A altura vai em `style` e não em classe porque é dado — vem de
 * `AD_FORMAT_HEIGHT`, indexado pelo formato. Uma classe `min-h-[90px]` teria
 * de existir literal no código para o Tailwind emitir a regra, o que
 * significaria repetir a tabela de alturas em dois lugares.
 *
 * `ad_view`/`ad_click` (§5 dos slots) entram junto com o `track()` da Fase 8 —
 * medir impressão sem ter onde gravar o evento seria código morto.
 */
export function AdSlot({ placement, format, className }: AdSlotProps) {
  const t = useTranslations('ads');

  if (!hasAdInventory(placement)) return null;

  // O leaderboard vira mobile-banner abaixo de `md`. Reservar o maior dos dois
  // evita uma media query e, principalmente, evita o salto de 90 para 100px.
  const mobileFormat = AD_MOBILE_FORMAT[format] ?? format;
  const minHeight = Math.max(
    AD_FORMAT_HEIGHT[format],
    AD_FORMAT_HEIGHT[mobileFormat],
  );

  return (
    <aside
      aria-label={t('label')}
      data-ad-placement={placement}
      data-ad-format={format}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-md bg-surface py-2',
        className,
      )}
      style={{ minHeight }}
    >
      <span className='text-overline uppercase text-ink-muted'>
        {t('label')}
      </span>
    </aside>
  );
}
