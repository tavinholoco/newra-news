'use client';

import { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  AD_FORMAT_HEIGHT,
  AD_MOBILE_FORMAT,
  hasAdInventory,
  hasThirdPartyAds,
  type AdFormat,
  type AdPlacement,
} from '@/lib/ads';
import { track } from '@/lib/analytics';
import { isThirdPartyAllowed } from '@/lib/analytics/consent';
import { useInView } from '@/lib/use-in-view';
import { cn } from '@/lib/utils';

interface AdSlotProps {
  placement: AdPlacement;
  format: AdFormat;
  className?: string;
}

/** Metade visível, por um segundo — a definição de impressão da §5. */
const VIEWABLE_RATIO = 0.5;
const VIEWABLE_DWELL_MS = 1_000;

/**
 * Espaço de anúncio reservado (§22 do plano, §8 dos slots).
 *
 * Três regras, e as duas primeiras continuam sendo sobre CLS:
 *
 * 1. **Sem inventário não renderiza nada** — nem caixa vazia, nem a palavra
 *    "Publicidade".
 * 2. **Com inventário, a altura é reservada antes de o criativo chegar.** É a
 *    diferença entre um anúncio que aparece e um que empurra a página inteira
 *    para baixo depois que o leitor já começou a ler.
 * 3. **Terceiro só entra com consentimento expresso.** Enquanto não houver rede
 *    configurada, o que preenche o espaço é **inventário de casa** — a
 *    newsletter, que é produto nosso, não grava cookie e não fala com ninguém.
 *
 * A altura vai em `style` e não em classe porque é dado — vem de
 * `AD_FORMAT_HEIGHT`, indexado pelo formato. Uma classe `min-h-[90px]` teria
 * de existir literal no código para o Tailwind emitir a regra, o que
 * significaria repetir a tabela de alturas em dois lugares.
 */
export function AdSlot({ placement, format, className }: AdSlotProps) {
  const t = useTranslations('ads');
  const ref = useRef<HTMLElement>(null);

  const hasInventory = hasAdInventory(placement);

  // **A ordem importa.** Rede configurada sem consentimento não renderiza nada:
  // não é caso de cair no criativo de casa, porque a posição foi vendida.
  const thirdParty = hasThirdPartyAds();
  const blockedByConsent = thirdParty && !isThirdPartyAllowed();

  const onSeen = useCallback(() => {
    track('ad_view', { placement, format });
  }, [placement, format]);

  useInView(ref, {
    threshold: VIEWABLE_RATIO,
    dwellMs: VIEWABLE_DWELL_MS,
    onSeen,
    enabled: hasInventory && !blockedByConsent,
  });

  if (!hasInventory || blockedByConsent) return null;

  // O leaderboard vira mobile-banner abaixo de `md`. Reservar o maior dos dois
  // evita uma media query e, principalmente, evita o salto de 90 para 100px.
  const mobileFormat = AD_MOBILE_FORMAT[format] ?? format;
  const minHeight = Math.max(
    AD_FORMAT_HEIGHT[format],
    AD_FORMAT_HEIGHT[mobileFormat],
  );

  return (
    <aside
      ref={ref}
      aria-label={thirdParty ? t('label') : t('houseLabel')}
      data-ad-placement={placement}
      data-ad-format={format}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-md bg-surface py-2',
        className,
      )}
      style={{ minHeight }}
    >
      <span className='text-overline uppercase text-ink-muted'>
        {thirdParty ? t('label') : t('houseLabel')}
      </span>

      {/* O criativo de casa. Quando houver rede, é aqui que o script dela
          entra — e o espaço já está do tamanho certo desde a Fase 3. */}
      {thirdParty ? null : (
        <Link
          href='/newsletter'
          onClick={() => track('ad_click', { placement, format })}
          className='inline-flex items-center gap-1.5 text-body-sm font-semibold text-link transition-colors duration-fast hover:text-link-hover'
        >
          {t('houseCta')}
          <ArrowRight className='size-4' aria-hidden='true' />
        </Link>
      )}
    </aside>
  );
}
