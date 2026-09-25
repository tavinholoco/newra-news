'use client';

import { useEffect, useState } from 'react';
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
 * de todo layout, precisa do próprio estilo — a ausência disso mandou uma
 * página em Times New Roman para produção.
 *
 * **O estilo daqui é inline, e não o `globals.css`.** A primeira versão
 * importava o `globals.css` e as fontes do `next/font`, como o `not-found`, e
 * a guarda conferia o `import`. Em build de produção a tela saía **sem folha
 * de estilo nenhuma** — Times New Roman, botão do navegador, fundo branco com
 * a classe `dark` aplicada (ensaio de aceitação, Fase 12 do plano, A5.12): o
 * Next prende o chunk do CSS ao layout raiz, que este boundary **substitui**,
 * e o `import` repetido é deduplicado — a mesma causa que o comentário da
 * `state-matrix` registra para a 404. O `not-found` funciona porque renderiza
 * **dentro** do layout raiz; este, não. Daí o `<style>` próprio, por
 * elemento (as utilities da casca não têm CSS aqui), com os valores
 * **resolvidos** dos tokens em {@link THEME} — e a guarda os compara com o
 * `styles/tokens.css`, para esta tela não virar um segundo lugar onde a cor
 * é decidida. Fonte do sistema: a do `next/font` também não carregava.
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

/**
 * Os tokens semânticos da camada 2 que esta tela usa, **resolvidos** a partir
 * do `styles/tokens.css` (`--bg`, `--ink`, `--ink-secondary`, `--ink-muted`,
 * `--brand-solid`, `--on-brand`), no claro e no `.dark`. A guarda em
 * `tests/lib/state-matrix.test.ts` resolve os mesmos nomes do arquivo e cobra
 * a igualdade.
 */
const THEME = {
  light: {
    bg: '#faf9f7',
    ink: '#111315',
    inkSecondary: '#34383d',
    inkMuted: '#697178',
    brandSolid: '#a83e1c',
    onBrand: '#ffffff',
  },
  dark: {
    bg: '#0f1113',
    ink: '#f3f1ee',
    inkSecondary: '#c4cad0',
    inkMuted: '#a8afb5',
    brandSolid: '#a83e1c',
    onBrand: '#ffffff',
  },
} as const;

const { light, dark } = THEME;
const GLOBAL_ERROR_CSS = [
  `html{color-scheme:light}html.dark{color-scheme:dark}`,
  `body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:${light.bg};color:${light.ink};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}`,
  `html.dark body{background:${dark.bg};color:${dark.ink}}`,
  `main{flex:1;display:flex;align-items:center;justify-content:center;padding:3rem 1rem}`,
  `main>div{display:flex;flex-direction:column;align-items:center;gap:1rem;text-align:center}`,
  `h1{margin:0;font-family:Georgia,'Times New Roman',serif;font-size:1.75rem;font-weight:700}`,
  `p{margin:0;max-width:68ch;line-height:1.5;color:${light.inkSecondary}}html.dark p{color:${dark.inkSecondary}}`,
  `p:last-child{font-size:.8125rem;color:${light.inkMuted}}html.dark p:last-child{color:${dark.inkMuted}}`,
  `code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;user-select:all}`,
  `button{font:inherit;font-weight:500;background:${light.brandSolid};color:${light.onBrand};border:0;border-radius:8px;padding:.5rem 1.25rem;cursor:pointer}`,
  `html.dark button{background:${dark.brandSolid};color:${dark.onBrand}}`,
  `button:focus-visible{outline:2px solid currentColor;outline-offset:2px}`,
].join('');

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
    <html lang={locale} suppressHydrationWarning>
      <head>
        <style>{GLOBAL_ERROR_CSS}</style>
      </head>
      <body>
        <main>
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
