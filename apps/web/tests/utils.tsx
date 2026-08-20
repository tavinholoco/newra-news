import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { Locale } from '@/lib/i18n';
import ptBR from '@/messages/pt-BR.json';
import en from '@/messages/en.json';

const messages: Record<Locale, typeof ptBR> = {
  'pt-BR': ptBR,
  en,
};

/**
 * Render com o provider do next-intl (locale + mensagens reais dos JSONs).
 *
 * O provider entra pela opção `wrapper` e não como JSX ao redor: assim o
 * `rerender` devolvido também o aplica. Passando `<Provider>{ui}</Provider>`
 * direto, um `rerender(ui)` renderiza o componente **sem** contexto e quebra
 * com "the context from NextIntlClientProvider was not found" — o que esconde
 * o que o teste queria observar.
 */
export function renderWithIntl(
  ui: React.ReactElement,
  locale: Locale = 'pt-BR',
): ReturnType<typeof render> {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        {children}
      </NextIntlClientProvider>
    ),
  });
}
