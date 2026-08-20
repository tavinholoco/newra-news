import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { SearchX, ArrowLeft } from 'lucide-react';
import { routing } from '@/i18n/routing';

// Página de 404 no nível raiz: renderiza fora de qualquer layout, então precisa
// de <html>/<body> próprios (padrão do exemplo oficial do next-intl). Na prática
// as rotas sem locale são redirecionadas pelo middleware e o 404 localizado de
// app/[locale]/not-found.tsx é o usado — este é apenas o fallback final
// (ex.: /unknown.txt).
export default async function GlobalNotFound() {
  const locale = routing.defaultLocale;
  const messages = await getMessages({ locale });
  const t = await getTranslations({ locale, namespace: 'notFound' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <div className='mx-auto flex min-h-screen max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
            <SearchX className='mb-6 h-16 w-16 text-line-strong' />
            <h1 className='font-display mb-3 text-6xl font-bold text-foreground'>
              404
            </h1>
            <p className='font-display mb-2 text-xl font-semibold text-foreground'>
              {t('title')}
            </p>
            <p className='mb-8 text-muted-foreground'>{t('description')}</p>
            <a
              href={`/${locale}`}
              className='flex items-center gap-2 text-sm font-medium text-link transition-colors hover:text-link-hover'
            >
              <ArrowLeft className='h-4 w-4' />
              {tCommon('backToHome')}
            </a>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
