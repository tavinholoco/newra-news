import { routing } from '@/i18n/routing';

// Constantes derivadas da config central de roteamento (i18n/routing.ts) para
// não duplicar a lista de locales em vários lugares.
export const LOCALES = routing.locales;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = routing.defaultLocale;

export function isSupportedLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * O idioma pelo primeiro segmento do caminho — `/en/news/…` → `en`.
 *
 * Existe para o `global-error.tsx`, o único lugar que renderiza fora do
 * provider do next-intl (armadilha 9 do plano de observabilidade) e que
 * **não pode** ler `document.documentElement.lang`: no instante do render o
 * `<html>` do documento é o que está sendo substituído. Com
 * `localePrefix: 'always'`, o pathname é determinístico — e é o mesmo dado
 * que o reporter já manda como `path`. Sem prefixo, o padrão.
 */
export function localeFromPathname(pathname: string): Locale {
  const first = pathname.split('/')[1];
  return isSupportedLocale(first) ? first : DEFAULT_LOCALE;
}

/** Locale BCP-47 → locale de formatação de datas/números (Intl). */
export function toDateFormatLocale(locale: string): string {
  return locale === 'en' ? 'en-US' : 'pt-BR';
}
