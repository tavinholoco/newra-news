'use client';

import { useEffect, useState } from 'react';
import { Inter, Newsreader } from 'next/font/google';
import '@/styles/globals.css';
import { cn } from '@/lib/utils';
import { applyStoredTheme } from '@/lib/theme';
import { DEFAULT_LOCALE, localeFromPathname, type Locale } from '@/lib/i18n';
import { ErrorState } from '@/components/errors/error-state';
import ptBR from '@/messages/pt-BR.json';
import en from '@/messages/en.json';

/**
 * O boundary raiz — o que segura um crash **no layout de idioma**, onde o
 * `[locale]/error.tsx` não alcança (§11.2 do plano de observabilidade, Fase
 * 7b). Sem ele, esse crash mostrava o padrão do Next, sem estilo.
 *
 * **É a exceção sancionada à regra do `CLAUDE.md`.** `error.tsx` na raiz é
 * proibido porque o boundary cairia fora do `<html>`; o `global-error.tsx`
 * renderiza o próprio `<html>`/`<body>`, e é por isso que existe. **O
 * modelo é o `app/not-found.tsx`**, que já pagou a lição: renderizando fora
 * de todo layout, precisa do próprio `globals.css` e das próprias fontes —
 * a ausência disso mandou uma página em Times New Roman para produção.
 *
 * **Duas coisas do modelo mudam de lado, e as duas são armadilhas do plano:**
 *
 * - **O tema não vem do `<ThemeInit />` (armadilha 40).** Ele é um `<script>`
 *   inline, e funciona no `not-found.tsx` porque aquele é server component —
 *   o navegador executa o script ao parsear o HTML. Este é client component,
 *   e um `<script>` que o React insere **não executa** (é de propósito, no
 *   React DOM). Copiá-lo deixaria a tela de crash branca no tema escuro, e
 *   uma guarda que procurasse `<ThemeInit />` passaria verde. O tema é
 *   `applyStoredTheme()` num `useEffect` — o leitor de `lib/theme.ts`.
 * - **As strings saem dos JSONs lidos direto, sem provider (armadilha 9).**
 *   `useTranslations` sem provider lança dentro do boundary — falha dupla,
 *   nada renderiza — e `getMessages()` é server-only. O inventário pedia
 *   "string fixa neutra em dois idiomas"; uma cópia fixa das quatro frases
 *   derivaria dos JSONs em silêncio na primeira edição, e importá-los custa
 *   o que toda página já carrega (o `NextIntlClientProvider` manda o JSON
 *   inteiro ao cliente). O idioma sai de `window.location.pathname`
 *   (`localePrefix: 'always'` o garante), não de
 *   `document.documentElement.lang`: no instante do render, o `<html>` do
 *   documento é o que está sendo substituído. Lido num efeito, para o
 *   primeiro render não depender de `window`.
 *
 * A casca é a mesma dos quatro `error.tsx` (`ErrorState`): é ela que desenha
 * o `digest` e reporta uma vez por montagem pela porta anônima da 7c.
 */

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: false,
});

const MESSAGES: Record<Locale, typeof ptBR> = { 'pt-BR': ptBR, en };

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    applyStoredTheme();
    setLocale(localeFromPathname(window.location.pathname));
  }, []);

  const messages = MESSAGES[locale];

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(inter.variable, newsreader.variable)}
    >
      <body className={cn('flex min-h-screen flex-col bg-bg font-sans antialiased', inter.className)}>
        <main className='flex flex-1 flex-col justify-center'>
          <ErrorState
            title={messages.errors.genericTitle}
            description={messages.errors.genericDesc}
            retryLabel={messages.common.retry}
            digestLabel={messages.errors.digestLabel}
            error={error}
            reset={reset}
          />
        </main>
      </body>
    </html>
  );
}
