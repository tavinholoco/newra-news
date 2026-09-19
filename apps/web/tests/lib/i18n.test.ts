import { describe, it, expect } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, localeFromPathname } from '@/lib/i18n';

describe('localeFromPathname', () => {
  /**
   * O leitor de idioma do `global-error.tsx` (Fase 7b do plano de
   * observabilidade). O boundary raiz não tem provider do next-intl
   * (armadilha 9) e não pode ler `document.documentElement.lang` — no instante
   * do render, o `<html>` do documento é o que está sendo **substituído**. O
   * que resta é o pathname, e `localePrefix: 'always'` garante que ele começa
   * pelo idioma.
   */
  it('reads the prefix of every supported locale', () => {
    for (const locale of LOCALES) {
      expect(localeFromPathname(`/${locale}`)).toBe(locale);
      expect(localeFromPathname(`/${locale}/news/abc`)).toBe(locale);
    }
  });

  it('falls back to the default locale when there is no prefix', () => {
    expect(localeFromPathname('/')).toBe(DEFAULT_LOCALE);
    expect(localeFromPathname('/news')).toBe(DEFAULT_LOCALE);
    expect(localeFromPathname('')).toBe(DEFAULT_LOCALE);
  });

  it('does not confuse a segment that merely starts with a locale', () => {
    // `/english` não é `/en`; `/pt-BRasil` não é `/pt-BR`.
    expect(localeFromPathname('/english')).toBe(DEFAULT_LOCALE);
    expect(localeFromPathname('/pt-BRasil')).toBe(DEFAULT_LOCALE);
  });
});
