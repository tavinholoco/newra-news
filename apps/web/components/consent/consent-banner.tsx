'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { readConsent, writeConsent } from '@/lib/analytics/consent';
import { hasThirdPartyAds } from '@/lib/ads';

/**
 * O pedido de consentimento — **e por que ele quase nunca aparece**.
 *
 * Quem exige consentimento prévio não é "ter anúncio": é carregar script de
 * terceiro que grava cookie e cruza comportamento entre sites. Enquanto o
 * inventário for de casa, não há terceiro, não há cookie, e perguntar seria
 * interromper a leitura de toda página sem portar decisão nenhuma — a mesma
 * armadilha do slot que desenha caixa vazia sem inventário.
 *
 * Por isso ele só monta quando **há rede configurada** e a pessoa **ainda não
 * decidiu**. Hoje a primeira condição é falsa e o banner não existe na tela; no
 * dia em que existir conta de rede, ele aparece sem ninguém escrever uma linha.
 *
 * A medição anônima de primeira parte segue por legítimo interesse e **não**
 * depende desta resposta — mas um `denied` aqui também a desliga, porque quem
 * recusou recusou.
 */
export function ConsentBanner() {
  const t = useTranslations('consent');
  // `null` = ainda não decidido no cliente. Começa fechado e só abre depois do
  // efeito: ler `localStorage` no render daria HTML diferente no servidor e no
  // cliente, que é a divergência de hidratação que a Fase 5 já pagou uma vez.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasThirdPartyAds()) return;
    if (readConsent() !== 'unset') return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function decide(decision: 'granted' | 'denied') {
    writeConsent(decision);
    setVisible(false);
  }

  return (
    // `role='dialog'` e não `alertdialog`: ele não interrompe uma tarefa em
    // curso, e `alertdialog` move o foco à força — o que tiraria do lugar quem
    // está lendo.
    <div
      role='dialog'
      aria-modal='false'
      aria-labelledby='consent-title'
      className='fixed inset-x-0 bottom-0 z-modal border-t border-line-strong bg-surface-raised px-gutter py-4 shadow-modal'
    >
      <div className='mx-auto flex max-w-wide flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div className='max-w-prose'>
          <p id='consent-title' className='font-display text-h4 font-bold text-ink'>
            {t('title')}
          </p>
          <p className='mt-1 text-body-sm text-ink-secondary'>
            {t('body')}{' '}
            <Link href='/about' className='text-link hover:text-link-hover'>
              {t('learnMore')}
            </Link>
          </p>
        </div>

        {/* Recusar vem primeiro na ordem de tabulação e tem o mesmo peso
            visual: botão de recusa escondido ou apagado é consentimento
            obtido por desenho, que não é consentimento. */}
        <div className='flex shrink-0 gap-2'>
          <Button variant='outline' onClick={() => decide('denied')}>
            {t('decline')}
          </Button>
          <Button onClick={() => decide('granted')}>{t('accept')}</Button>
        </div>
      </div>
    </div>
  );
}
