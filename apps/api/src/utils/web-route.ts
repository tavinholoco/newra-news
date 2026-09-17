import { UNMATCHED_ROUTE } from './request-route';

/**
 * **O padrão da página do web (`/[locale]/news/[id]`), nunca o pathname cru.**
 *
 * É o `route` do `ErrorEvent` de `origin: WEB` (Fase 7c, §11.3 do plano), e a
 * mesma regra do `routePatternOf` vale aqui pelo mesmo motivo: o `route` é
 * peça do fingerprint, e o fingerprint só dá teto à tabela enquanto cada peça
 * for de conjunto finito. Um client component só tem
 * `window.location.pathname` — uma linha por notícia —, e o App Router não
 * expõe o padrão casado. Então o cliente manda o caminho cru e a API
 * normaliza.
 *
 * **A lista abaixo é o `app/[locale]` do web, e tem guarda derivada da
 * árvore** (`tests/utils/web-route.test.ts` lê toda `page.tsx` e cobra
 * igualdade nas duas direções). Ela é digitada aqui porque em produção a API
 * não tem os arquivos do web à mão; o que impede a cópia de apodrecer é a
 * guarda, não a disciplina.
 *
 * O prefixo de idioma vira `[locale]` sempre: a página é a mesma nos dois, e
 * o idioma continua legível no `path` cru que viaja no `context`.
 */
export const WEB_ROUTE_PATTERNS: readonly string[] = [
  '/[locale]',
  '/[locale]/about',
  '/[locale]/account',
  '/[locale]/account/newsletter',
  '/[locale]/account/preferences',
  '/[locale]/admin',
  '/[locale]/admin/metrics',
  '/[locale]/admin/security',
  '/[locale]/article',
  '/[locale]/article/[date]',
  '/[locale]/favorites',
  '/[locale]/news',
  '/[locale]/news/[id]',
  '/[locale]/newsletter',
  '/[locale]/newsletter/unsubscribe',
  '/[locale]/signin',
];

const KNOWN_PATTERNS = new Set(WEB_ROUTE_PATTERNS);

/**
 * A forma de um segmento de idioma (`pt-BR`, `en`), e não a lista deles.
 *
 * A lista mora em `apps/web/i18n/routing.ts`; copiá-la seria um segundo lugar
 * para lembrar de mudar. Como o segmento vira `[locale]` de qualquer forma, o
 * que importa é só que ele **tenha** a forma — um idioma inventado cai num
 * padrão do conjunto ou no balde, nunca em algo novo.
 */
const LOCALE_SEGMENT = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_SEGMENT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Do pathname cru ao padrão da página — ou {@link UNMATCHED_ROUTE}.
 *
 * Três substituições por **forma** (idioma, UUID, data de calendário) e uma
 * pergunta ao conjunto. O que não casa vai para o mesmo balde do
 * `routePatternOf`: `/pt-BR/news/minha-noticia` não é uma página e não ganha
 * linha própria. `localePrefix: 'always'` no web garante que toda página
 * renderizada tem o prefixo, então um caminho sem ele não veio de uma página.
 */
export function webRoutePatternOf(path: string): string {
  const [locale, ...rest] = path.split('/').filter((segment) => segment.length > 0);
  if (!locale || !LOCALE_SEGMENT.test(locale)) return UNMATCHED_ROUTE;

  const candidate = ['/[locale]', ...rest.map(placeholderFor)].join('/');
  return KNOWN_PATTERNS.has(candidate) ? candidate : UNMATCHED_ROUTE;
}

function placeholderFor(segment: string): string {
  if (UUID_SEGMENT.test(segment)) return '[id]';
  if (DATE_SEGMENT.test(segment)) return '[date]';
  return segment;
}
