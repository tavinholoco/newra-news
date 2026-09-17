import { describe, it, expect } from 'vitest';
import { UNMATCHED_ROUTE } from '../../src/utils/request-route';
import { WEB_ROUTE_PATTERNS, webRoutePatternOf } from '../../src/utils/web-route';
import { webPageRoutes } from '../helpers/web-routes';

/**
 * **O `route` de um erro do cliente é um padrão de página, e o conjunto de
 * padrões é o `app/[locale]` do web — derivado, nunca digitado.**
 *
 * O `route` é peça do fingerprint do `ErrorEvent` (§8), e o fingerprint só dá
 * teto à tabela enquanto cada peça for de conjunto finito. O cliente só tem
 * `window.location.pathname` — `/pt-BR/news/3f2a…`, uma linha por notícia —,
 * e o App Router não expõe o padrão casado a um client component. Quem
 * normaliza é a API, e o que esta guarda cobra é que o conjunto de saída seja
 * **exatamente** o das páginas que existem: página nova no web reprova aqui
 * até a lista acompanhar, e página removida também — senão o normalizador
 * inventaria um balde para uma rota que ninguém mais renderiza.
 *
 * O balde de tudo o que não casa é o mesmo `unmatched` do `routePatternOf`,
 * importado e não digitado (a guarda de `request-route.test.ts` reprova o
 * literal solto).
 */

const NEWS_ID = '3f2a9c1e-7b4d-4e8a-9c2b-1d5e6f7a8b9c';

describe('o conjunto de padrões é derivado das páginas do web', () => {
  it('has exactly one pattern per page.tsx under app/[locale], prefixed by the locale placeholder', () => {
    const fromTree = webPageRoutes().map((route) => (route === '/' ? '/[locale]' : `/[locale]${route}`));

    expect([...WEB_ROUTE_PATTERNS].sort()).toEqual(fromTree.sort());
  });

  it('finds pages at all — an empty tree would make the comparison vacuous', () => {
    expect(webPageRoutes()).toContain('/news/[id]');
    expect(webPageRoutes()).toContain('/article/[date]');
    expect(WEB_ROUTE_PATTERNS.length).toBeGreaterThan(10);
  });
});

describe('webRoutePatternOf — do pathname cru ao padrão', () => {
  it('normalizes the home, in both locales, to the same pattern', () => {
    expect(webRoutePatternOf('/pt-BR')).toBe('/[locale]');
    expect(webRoutePatternOf('/en')).toBe('/[locale]');
    expect(webRoutePatternOf('/en/')).toBe('/[locale]');
  });

  it('replaces a UUID segment by [id] and a calendar date by [date]', () => {
    expect(webRoutePatternOf(`/pt-BR/news/${NEWS_ID}`)).toBe('/[locale]/news/[id]');
    expect(webRoutePatternOf(`/en/news/${NEWS_ID.toUpperCase()}`)).toBe('/[locale]/news/[id]');
    expect(webRoutePatternOf('/pt-BR/article/2026-09-16')).toBe('/[locale]/article/[date]');
  });

  it('keeps a literal segment literal', () => {
    expect(webRoutePatternOf('/pt-BR/admin/security')).toBe('/[locale]/admin/security');
    expect(webRoutePatternOf('/en/account/preferences')).toBe('/[locale]/account/preferences');
    expect(webRoutePatternOf('/pt-BR/newsletter/unsubscribe')).toBe('/[locale]/newsletter/unsubscribe');
  });

  it('sends what does not match any page to the unmatched bucket', () => {
    // Uma linha por notícia é o que o teto da tabela não pode ter: um segmento
    // dinâmico que não é UUID nem data não vira padrão, vira o balde.
    expect(webRoutePatternOf('/pt-BR/news/minha-noticia')).toBe(UNMATCHED_ROUTE);
    expect(webRoutePatternOf(`/pt-BR/article/${NEWS_ID}`)).toBe(UNMATCHED_ROUTE);
    expect(webRoutePatternOf('/pt-BR/nao-existe')).toBe(UNMATCHED_ROUTE);
    expect(webRoutePatternOf('/pt-BR/news/2026-09-16/extra')).toBe(UNMATCHED_ROUTE);
  });

  it('requires the locale prefix — the middleware always adds one', () => {
    // `localePrefix: 'always'` em `apps/web/i18n/routing.ts`: toda página
    // renderizada tem o prefixo. Um caminho sem ele não veio de uma página.
    expect(webRoutePatternOf('/news')).toBe(UNMATCHED_ROUTE);
    expect(webRoutePatternOf('/')).toBe(UNMATCHED_ROUTE);
    expect(webRoutePatternOf('')).toBe(UNMATCHED_ROUTE);
    expect(webRoutePatternOf('/[locale]/news')).toBe(UNMATCHED_ROUTE);
  });

  it('never returns anything outside the finite set', () => {
    // A propriedade que o fingerprint precisa, sobre entradas escolhidas para
    // tentar escapar: o que sai é um padrão do conjunto ou o balde, nunca o
    // que o cliente mandou.
    const hostile = [
      '/pt-BR/news/[id]',
      '/pt-BR/news/%2e%2e/admin',
      '/pt-BR/news/' + 'a'.repeat(500),
      '/pt-BR//news',
      '/PT-BR/news',
      '/pt-BR/News',
      '/pt-BR/news/' + NEWS_ID + '/',
    ];
    const allowed = new Set<string>([...WEB_ROUTE_PATTERNS, UNMATCHED_ROUTE]);

    for (const path of hostile) {
      expect(allowed.has(webRoutePatternOf(path)), path).toBe(true);
    }
  });
});
