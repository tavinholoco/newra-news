import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { Locale } from '@/lib/i18n';
import ptBR from '@/messages/pt-BR.json';
import en from '@/messages/en.json';

const messages: Record<Locale, typeof ptBR> = {
  'pt-BR': ptBR,
  en,
};

/** Render com o provider do next-intl (locale + mensagens reais dos JSONs). */
export function renderWithIntl(
  ui: React.ReactElement,
  locale: Locale = 'pt-BR',
): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}
