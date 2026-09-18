'use client';

import { Button } from '@/components/ui/button';
import { useReportClientError } from '@/lib/report-client-error';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title: string;
  description: string;
  retryLabel: string;
  /** O rótulo do `digest` — "Referência do erro". Só aparece quando há digest. */
  digestLabel: string;
  /** O que o Next entrega ao boundary: `digest` quando o erro foi de servidor. */
  error: Error & { digest?: string };
  reset: () => void;
  /**
   * `page` (padrão) traz o próprio `container-editorial`: o `<main>` do
   * layout de idioma é só `flex-1`. `inset` é para o boundary que já está
   * dentro de uma casca com contêiner — o `admin/metrics/error.tsx`, sob o
   * `admin/layout.tsx` —, onde um segundo contêiner dobraria o gutter.
   */
  layout?: 'page' | 'inset';
}

/**
 * A casca única dos error boundaries — os quatro `error.tsx` e o
 * `global-error.tsx` (§11.2 do plano de observabilidade, Fase 7b).
 *
 * **Tudo por prop, e sem next-intl.** Os quatro `error.tsx` eram o mesmo
 * componente de 26 linhas com chaves diferentes; extraí-lo é o óbvio, mas o
 * quinto boundary é o raiz, que renderiza **fora** do provider do idioma —
 * `useTranslations` ali lança dentro do boundary (armadilha 9), e um
 * componente que traduz por conta própria não serviria para ele. Cada
 * `error.tsx` chama o próprio `t('…')` e passa o texto; as chaves ficam
 * literais nos arquivos, como o `i18n-messages` cobra.
 *
 * **O `digest` em texto pequeno, ao lado do botão** — o mesmo papel que o
 * `requestId` cumpre no corpo do 500 da API: o que alguém copia para o
 * relato, e o que localiza o stack no log do servidor. O Next só o põe
 * quando o erro foi de servidor; um render que morreu no cliente chega sem
 * ele, e a linha não aparece. Para o erro de servidor ele é tudo — a
 * `message` é a frase genérica do Next —, por isso é selecionável.
 *
 * **E é ela que reporta**, uma vez por montagem, pela porta anônima da 7c.
 * Um boundary que a contornasse nasceria sem o digest e sem o relato — a
 * `state-matrix` cobra que os cinco passem por aqui.
 *
 * `container-editorial` e não o `mx-auto max-w-7xl` da V1 que os quatro
 * carregavam (armadilha 11): o `<main>` do layout de idioma é só `flex-1`, e
 * quem dá contêiner é a própria tela — exceto sob o `admin/layout.tsx`, que
 * já o dá, e aí o boundary pede `layout='inset'`.
 */
export function ErrorState({
  title,
  description,
  retryLabel,
  digestLabel,
  error,
  reset,
  layout = 'page',
}: ErrorStateProps) {
  useReportClientError(error);

  const digest = typeof error.digest === 'string' && error.digest.length > 0 ? error.digest : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-section text-center',
        layout === 'page' && 'container-editorial',
      )}
    >
      <h1 className='font-display text-h2 font-bold text-ink'>{title}</h1>
      <p className='max-w-prose text-body text-ink-secondary'>{description}</p>
      <Button onClick={reset}>{retryLabel}</Button>
      {digest ? (
        <p className='text-meta text-ink-muted'>
          {digestLabel} <code className='select-all font-mono text-ink-secondary'>{digest}</code>
        </p>
      ) : null}
    </div>
  );
}
