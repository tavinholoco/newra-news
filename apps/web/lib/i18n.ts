import { routing } from '@/i18n/routing';

// Constantes derivadas da config central de roteamento (i18n/routing.ts) para
// não duplicar a lista de locales em vários lugares.
export const LOCALES = routing.locales;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = routing.defaultLocale;

export function isSupportedLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Locale BCP-47 → locale de formatação de datas/números (Intl). */
export function toDateFormatLocale(locale: string): string {
  return locale === 'en' ? 'en-US' : 'pt-BR';
}
