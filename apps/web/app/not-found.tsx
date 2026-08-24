import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Inter, Newsreader } from 'next/font/google';
import { SearchX, ArrowLeft } from 'lucide-react';
import '@/styles/globals.css';
import { cn } from '@/lib/utils';
import { ThemeInit } from '@/components/theme/theme-init';
import { routing } from '@/i18n/routing';

/**
 * O 404 da raiz — **e é ele que todo endereço errado do site alcança**.
 *
 * O comentário que estava aqui dizia o contrário: que as rotas sem locale são
 * redirecionadas pelo middleware, que o 404 localizado de
 * `app/[locale]/not-found.tsx` seria o usado, e que este era "apenas o fallback
 * final (ex.: `/unknown.txt`)". **A revisão 10.3 mediu e é o inverso.** No App
 * Router, um caminho que não casa com arquivo de rota nenhum não "cai dentro"
 * do segmento `[locale]`: o roteador não casa nada e renderiza o `not-found` da
 * **raiz**. `/pt-BR/rota-que-nao-existe` — uma URL *com* locale — chega aqui.
 * O `[locale]/not-found.tsx` só entra quando alguma página daquele segmento
 * chama `notFound()` explicitamente.
 *
 * **E esta página ia ao ar sem uma linha de CSS.** Renderizando fora de
 * qualquer layout, ela precisa do próprio `<html>`/`<body>` — e, junto,
 * do próprio `globals.css`, das próprias fontes e do próprio `ThemeInit`.
 * Faltavam os três: as classes do Tailwind saíam no HTML sem folha de estilo
 * para resolvê-las, e o resultado era a renderização padrão do navegador —
 * Times New Roman, link azul sublinhado, fundo branco mesmo no tema escuro.
 * Conferido em produção: o HTML da 404 não tem `<link rel="stylesheet">`
 * nenhum, enquanto o da Home carrega `_next/static/css/…`.
 *
 * Estava assim desde que a página existe, e **estava na baseline visual
 * versionada** — a captura clara mostrava exatamente isto e ninguém olhou. Foi
 * a captura escura das nove rotas que faltavam (§10.3) que colocou as duas lado
 * a lado.
 */

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  adjustFontFallback: false,
});

export default async function GlobalNotFound() {
  const locale = routing.defaultLocale;
  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: 'notFound' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(inter.variable, newsreader.variable)}
    >
      <body className={cn('flex min-h-screen flex-col bg-bg font-sans antialiased', inter.className)}>
        {/* Sem isto, quem lê no escuro recebe a página branca — e é o único
            lugar do site onde o tema salvo não era aplicado. */}
        <ThemeInit />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className='mx-auto flex min-h-screen max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
            <SearchX className='mb-6 h-16 w-16 text-line-strong' aria-hidden='true' />
            <h1 className='mb-3 font-display text-display font-bold text-ink'>404</h1>
            <p className='mb-2 font-display text-h4 font-semibold text-ink'>
              {t('title')}
            </p>
            <p className='mb-8 text-body text-ink-secondary'>{t('description')}</p>
            <a
              href={`/${locale}`}
              className='flex items-center gap-2 text-body-sm font-medium text-link transition-colors duration-fast hover:text-link-hover'
            >
              <ArrowLeft className='size-4' aria-hidden='true' />
              {tCommon('backToHome')}
            </a>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
