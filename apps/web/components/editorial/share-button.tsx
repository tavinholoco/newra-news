'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  title: string;
  /** Texto de apoio no compartilhamento nativo. */
  text?: string;
  className?: string;
}

/** Quanto tempo o "copiado" fica visível. */
const FEEDBACK_MS = 2000;

/**
 * Compartilhar (§8), com o compartilhamento nativo quando existe.
 *
 * **Uma ação, dois caminhos, um rótulo só.** No celular `navigator.share` abre a
 * folha do sistema; no desktop, onde ela quase nunca existe, o clique copia a
 * URL. Dois botões lado a lado ("compartilhar" e "copiar link") ofereceriam ao
 * leitor uma escolha que ele não tem como fazer — ele não sabe qual dos dois o
 * navegador dele suporta.
 *
 * O rótulo **não** muda entre os dois caminhos: `navigator.share` só existe
 * depois da hidratação, e trocar o texto do botão a partir dele produziria
 * markup diferente no servidor e no cliente. O que muda é a confirmação,
 * depois do clique.
 *
 * A URL sai de `window.location` e não de uma prop: a rota já sabe onde está, e
 * passar a URL montada à mão duplicaria a construção do link canônico em cada
 * página que usa o botão.
 */
export function ShareButton({ title, text, className }: ShareButtonProps) {
  const t = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Sem isto, sair da página durante os 2s agenda um `setState` em componente
  // desmontado.
  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Cancelar a folha de compartilhamento rejeita a promessa. Não é erro,
        // e cair na cópia depois de um cancelamento deliberado seria pior que
        // não fazer nada.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), FEEDBACK_MS);
    } catch {
      // `clipboard` exige contexto seguro e permissão. Sem ela o botão não
      // finge ter funcionado.
    }
  }

  return (
    <button
      type='button'
      onClick={handleShare}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-body-sm font-medium text-ink-secondary transition-colors duration-fast hover:border-line-strong hover:text-link',
        className,
      )}
    >
      {copied ? (
        <Check className='size-4 shrink-0' aria-hidden='true' />
      ) : (
        <Share2 className='size-4 shrink-0' aria-hidden='true' />
      )}
      {/* `aria-live`: quem não vê o ícone trocar precisa ouvir que copiou. */}
      <span aria-live='polite'>{copied ? t('linkCopied') : t('share')}</span>
    </button>
  );
}
