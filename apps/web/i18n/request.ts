import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import ptBR from '../messages/pt-BR.json';
import en from '../messages/en.json';
import type { Locale } from '@/lib/i18n';

const messages: Record<Locale, typeof ptBR> = {
  'pt-BR': ptBR,
  en,
};

// Com roteamento por prefixo (`/pt`, `/en`), o locale vem do segmento
// `[locale]` da URL (requestLocale) — não do cookie. Isso permite renderização
// estática e ISR por idioma (as páginas chamam setRequestLocale).
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: messages[locale as Locale],
  };
});
