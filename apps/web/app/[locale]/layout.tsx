import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Inter, Newsreader } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import '@/styles/globals.css';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ThemeInit } from '@/components/theme/theme-init';
import { Providers } from '../providers';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { routing } from '@/i18n/routing';
import type { Locale } from '@/lib/i18n';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
// Serif editorial das manchetes (§7 de docs/v2/01-design-tokens.md).
// Inter continua na interface: trocar as duas fontes de uma vez dobraria o
// risco de CLS numa fase que já mexe em todos os tokens.
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  // O `next/font` não tem Newsreader na base de métricas e por isso não
  // consegue gerar a face de fallback com `size-adjust` — ele avisa no build.
  // Sem uma stack explícita o fallback cairia na genérica do sistema, e o
  // wordmark do masthead trocaria de largura ao trocar de fonte. Georgia tem
  // largura e altura-x próximas o bastante para o salto não incomodar (§40.3).
  fallback: ['Georgia', 'Times New Roman', 'serif'],
  // Desligado porque o Next não consegue fazê-lo mesmo: mantê-lo ligado só
  // imprime `Failed to find font override values` a cada build, sem gerar
  // ajuste nenhum. A stack acima é o que de fato segura o fallback.
  adjustFontFallback: false,
});

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

// Habilita a geração estática para cada idioma (app/layout.tsx não tem <html>).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: LocaleLayoutProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'site' });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: SITE_NAME,
      template: `%s | ${SITE_NAME}`,
    },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: locale.replace('-', '_'),
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: LocaleLayoutProps) {
  // Garante que o locale da URL é um dos suportados
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  // Habilita renderização estática (lê o locale do param, não do header/cookie)
  setRequestLocale(locale);

  const messages = await getMessages();
  const skipLabel = (await getTranslations({ locale, namespace: 'shell' }))(
    'skipToContent',
  );

  return (
    <html lang={locale} suppressHydrationWarning className={cn(inter.variable, newsreader.variable)}>
      <body
        className={cn(
          // Coluna flex em vez de `min-h-[calc(100vh-4rem)]` no <main>: aquele
          // cálculo codificava a altura do header, que a §10 muda para três
          // linhas. Assim o rodapé continua no fim da viewport em página curta
          // sem ninguém precisar saber quanto o header mede.
          'flex min-h-screen flex-col font-sans antialiased',
          inter.className,
        )}
      >
        <ThemeInit />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            {/* Bypass block (WCAG 2.4.1). O shell tem três linhas e a faixa
                de assuntos: são doze paradas de tabulação antes do conteúdo, e
                em toda página. Visível só no foco — é o padrão, e é o que faz
                ele não ocupar espaço para quem usa mouse.

                A string existia desde a Fase 2; o link, não. */}
            <a
              href='#conteudo'
              // `top` negativo, e não o par `sr-only` / `focus:not-sr-only`:
              // aquele par disputa `position`, `width` e `height` entre duas
              // utilities de mesma especificidade, e quem vence depende da
              // ordem no CSS gerado. Aqui `.focus\:top-4:focus` é classe mais
              // pseudo-classe (0,2,0) contra `.-top-24` (0,1,0), então o foco
              // vence por **especificidade** — que não depende de ordem.
              //
              // `focus:` e não `focus-visible:`: o link fica fora da viewport e
              // não há como clicá-lo, então todo foco que ele recebe é de
              // teclado.
              className='fixed left-4 -top-24 z-overlay rounded-md border border-line-strong bg-surface-raised px-4 py-2 text-body-sm font-semibold text-link focus:top-4 focus:outline-2 focus:outline-offset-2 focus:outline-focus'
            >
              {skipLabel}
            </a>
            <Header />
            <main id='conteudo' className='flex-1'>
              {children}
            </main>
            <Footer />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
