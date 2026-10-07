import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { DAILY_REVALIDATION_PATHS, dailyPages } from '@/lib/daily-revalidation';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n';
import {
  CRON_MAX_DURATION_MS,
  CRON_RESPONSE_MARGIN_MS,
  DAILY_PAGES_FLOOR_MS,
  DAILY_PAGES_PAUSE_MS,
  DAILY_PAGES_TIMEOUT_MS,
  VERCEL_FUNCTION_MAX_MS,
} from '@/lib/timeouts';

/**
 * **A ISR deixou de acordar a API do Render a cada hora (01/10/2026).**
 *
 * Toda regeneração de uma página guardada chama a API, e a API dorme com
 * ~15 min sem tráfego no plano free. O conteúdo muda **uma vez por dia**, no
 * pipeline; o que o mantém fresco é o cron diário invalidando o conjunto de
 * `lib/daily-revalidation.ts` quando o run fecha (e pedindo as páginas — 13.12), e o `revalidate` de
 * cada arquivo é só a rede de segurança. As quatro guardas abaixo são o que impede a próxima página nova
 * de nascer com `revalidate = 3600` copiado da vizinha — que é como as horas
 * de setembro foram gastas sem ninguém escrever um keep-alive.
 */

const WEB_DIR = join(__dirname, '../..');
const APP_DIR = join(WEB_DIR, 'app');

/** O piso: nenhuma página guardada regenera mais de uma vez por dia sozinha. */
const MIN_REVALIDATE_SECONDS = 86_400;

function collectSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectSources(full);
    return /\.tsx?$/.test(full) ? [full] : [];
  });
}

function relativePath(file: string): string {
  return file.replace(/\\/g, '/').split('/apps/web/')[1] ?? file;
}

const REVALIDATE = /export const revalidate\s*=\s*([^;\n]+)/;

describe('a ISR não acorda a API mais de uma vez por dia', () => {
  it('declares every revalidate under app/ as at least one day', () => {
    const declared = collectSources(APP_DIR)
      .map((file) => ({ file: relativePath(file), match: REVALIDATE.exec(readFileSync(file, 'utf8')) }))
      .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null);

    // Um matcher que não acha nada aprovaria tudo.
    expect(declared.length).toBeGreaterThanOrEqual(7);

    const tooOften = declared
      .map(({ file, match }) => ({ file, seconds: Number((match[1] as string).replace(/_/g, '')) }))
      .filter(({ seconds }) => !(seconds >= MIN_REVALIDATE_SECONDS));

    expect(tooOften).toEqual([]);
  });

  it('points every revalidated path at a route that exists', () => {
    const missing = DAILY_REVALIDATION_PATHS.filter(([path, type]) => {
      if (type === 'page') return !existsSync(join(APP_DIR, path, 'page.tsx'));
      if (path === '/sitemap.xml') return !existsSync(join(APP_DIR, 'sitemap.ts'));
      return !existsSync(join(APP_DIR, path, 'route.ts'));
    }).map(([path]) => path);

    expect(missing).toEqual([]);
  });

  it('leaves the news detail out, and never invalidates the whole layout', () => {
    // A `/news/[id]` são milhares de páginas que os robôs percorrem o dia todo;
    // invalidá-las por dia era uma acordada da API por página tocada. O
    // `'layout'` sob `/[locale]` as levava junto — era o que o cron fazia.
    const paths = DAILY_REVALIDATION_PATHS.map(([path]) => path);
    expect(paths).not.toContain('/[locale]/news/[id]');
    expect(DAILY_REVALIDATION_PATHS.some(([, type]) => type === 'layout')).toBe(false);
  });

  it('keeps a single cron in vercel.json — the Hobby plan refused the second one', () => {
    // Em 01/10/2026 um segundo cron (`/api/cron/refresh`, 13:00) derrubou o
    // deploy do preview em 22 s, antes do build: o Hobby limita os crons. Quem
    // conserta a página regenerada no meio do run é a espera do próprio cron
    // (`settleRun` em `app/api/cron/daily-news/route.ts`).
    const { crons } = JSON.parse(readFileSync(join(WEB_DIR, 'vercel.json'), 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(crons.map((cron) => cron.path)).toEqual(['/api/cron/daily-news']);
  });
});

/**
 * **A premissa que decide onde a invalidação mora (13.12, 07/10/2026).**
 *
 * No Next 14, `revalidatePath` dentro de um route handler **não invalida nada
 * na hora**: só anota a tag em `store.revalidatedTags`. Quem a aplica é o
 * próprio Next, **depois que o handler retorna**, no `waitUntil` da invocação.
 * Duas consequências, as duas lidas no código do Next antes de escrever o cron:
 *
 * 1. as duas chamadas que o cron fazia (no aceite e no `SUCCESS`) eram **uma
 *    invalidação só**, no fim — a tag repetida nem entra de novo na lista;
 * 2. pedir as páginas **dentro** da mesma invocação, depois de um
 *    `revalidatePath`, leria o cache antigo — e a anotação, aplicada no fim,
 *    desfaria o que o pedido tivesse regenerado.
 *
 * Por isso o cron invalida por **outra invocação**
 * (`/api/cron/daily-news/revalidate`) e pede as páginas depois. Se uma versão
 * nova do Next mudar isto (o 15 move estes arquivos), esta guarda reprova e a
 * decisão tem de ser revista — o mesmo tratamento do `signal` da revalidação
 * em `lib/timeouts.ts`.
 */
describe('a premissa do Next: a tag anotada num route handler só vale quando ele retorna', () => {
  const nextRequire = createRequire(join(WEB_DIR, 'package.json'));
  const read = (specifier: string) => readFileSync(nextRequire.resolve(specifier), 'utf8');

  it('only records the tag in revalidatePath — nothing is invalidated on the spot', () => {
    const source = read('next/dist/server/web/spec-extension/revalidate.js');
    const body = source.slice(source.indexOf('function revalidate(tag, expression)'));

    expect(body).toContain('store.revalidatedTags.push(tag)');
    expect(body).not.toMatch(/incrementalCache\s*\.\s*revalidateTag/);
  });

  it('applies the recorded tags after the handler resolves', () => {
    const source = read('next/dist/server/future/route-modules/app-route/module.js');
    const handlerCall = source.indexOf('const res = await handler(');
    const flush = source.indexOf('revalidateTag(staticGenerationStore.revalidatedTags');

    expect(handlerCall).toBeGreaterThan(-1);
    expect(flush).toBeGreaterThan(handlerCall);
  });
});

/**
 * **O que o cron pede depois de invalidar, e como sabe que a página traz o run
 * do dia** (13.12). Em 07/10/2026 a Home `/pt-BR` passou a tarde com o briefing
 * da véspera: a invalidação aconteceu, uma regeneração falhou depois dela, e a
 * Vercel manteve o documento anterior até o `revalidate` de um dia vencer.
 */
describe('as páginas do conjunto do dia', () => {
  const RUN_DATE = '2026-10-07';
  const pages = dailyPages(RUN_DATE);

  it('requests at least one page for every invalidated path, and nothing outside the set', () => {
    // As duas direções: um padrão novo no conjunto sem página pedida ficaria
    // à mercê do primeiro robô; uma página pedida fora do conjunto nunca foi
    // invalidada pelo cron, e pedi-la só gastaria a API.
    const set = DAILY_REVALIDATION_PATHS.map(([path]) => path);
    expect([...new Set(pages.map((page) => page.pattern))].sort()).toEqual([...set].sort());
  });

  it('requests every locale of a localized path', () => {
    for (const [path] of DAILY_REVALIDATION_PATHS.filter(([p]) => p.startsWith('/[locale]'))) {
      const urls = pages.filter((page) => page.pattern === path).map((page) => page.url);
      expect(urls).toHaveLength(LOCALES.length);
      for (const locale of LOCALES) {
        expect(urls.some((url) => url.startsWith(`/${locale}`))).toBe(true);
      }
    }
  });

  it('starts with the Home — the page most read, and the one that stayed old on 07/10', () => {
    expect(pages.slice(0, LOCALES.length).map((page) => page.url)).toEqual(
      LOCALES.map((locale) => `/${locale}`),
    );
  });

  it('asks the page of the briefing of the run day, not of any day', () => {
    expect(pages.map((page) => page.url)).toContain(`/${DEFAULT_LOCALE}/article/${RUN_DATE}`);
  });

  /**
   * As marcas, contra o que o HTML de cada página carrega de verdade. O payload
   * RSC vai dentro de `self.__next_f.push([1,"…"])`, com as aspas escapadas —
   * a marca da `/news` tem de casar nas duas formas.
   */
  const marker = (url: string) => {
    const page = pages.find((entry) => entry.url === url);
    if (!page) throw new Error(`no daily page ${url}`);
    return page.marker;
  };

  it('recognizes the briefing link of the day on the Home and on the history', () => {
    for (const url of [`/${DEFAULT_LOCALE}`, `/${DEFAULT_LOCALE}/article`]) {
      expect(marker(url).test(`<a href="/${DEFAULT_LOCALE}/article/${RUN_DATE}">`)).toBe(true);
      // O documento da véspera linka o briefing da véspera.
      expect(marker(url).test(`<a href="/${DEFAULT_LOCALE}/article/2026-10-06">`)).toBe(false);
      // E o link de outro idioma não serve.
      expect(marker(url).test(`<a href="/en/article/${RUN_DATE}">`)).toBe(false);
    }
  });

  it('tells the briefing page of the day from the not-found it may have been cached as', () => {
    const url = `/${DEFAULT_LOCALE}/article/${RUN_DATE}`;
    // O parâmetro da rota está em todo payload da página — inclusive no da
    // "não encontrada" que um pedido antes do run deixa guardada (a forma
    // abaixo é a do HTML real dela, medido com `next start` em 07/10/2026).
    // Só o JSON-LD do briefing (`@id` com `#article`) existe quando o briefing
    // existe.
    const notFound = `[\\"date\\",\\"${RUN_DATE}\\",\\"d\\"] [\\"\\",\\"pt-BR\\",\\"article\\",\\"${RUN_DATE}\\"]`;
    expect(marker(url).test(notFound)).toBe(false);
    expect(
      marker(url).test(`"@id":"https://x.test/${DEFAULT_LOCALE}/article/${RUN_DATE}#article"`),
    ).toBe(true);
  });

  it('recognizes a news item collected by the run of the day on /news, escaped or not', () => {
    const url = `/${DEFAULT_LOCALE}/news`;
    expect(marker(url).test(`"createdAt":"${RUN_DATE}T11:00:11.123Z"`)).toBe(true);
    expect(marker(url).test(`\\"createdAt\\":\\"${RUN_DATE}T11:00:11.123Z\\"`)).toBe(true);
    // A data do veículo não é a do pipeline: uma matéria publicada hoje e
    // coletada ontem não prova o run de hoje.
    expect(marker(url).test(`\\"publishedAt\\":\\"${RUN_DATE}T01:00:00.000Z\\"`)).toBe(false);
    expect(marker(url).test(`\\"createdAt\\":\\"2026-10-06T11:31:38.000Z\\"`)).toBe(false);
  });

  it('recognizes the briefing of the day in both sitemaps', () => {
    for (const url of ['/sitemap.xml', '/news-sitemap.xml']) {
      expect(
        marker(url).test(`<loc>https://x.test/${DEFAULT_LOCALE}/article/${RUN_DATE}</loc>`),
      ).toBe(true);
      expect(
        marker(url).test(`<loc>https://x.test/${DEFAULT_LOCALE}/article/2026-10-06</loc>`),
      ).toBe(false);
    }
  });
});

describe('o prazo do cron', () => {
  it('declares in the route the maxDuration the timeouts count on', () => {
    // Literal por exigência do Next; a constante é o que o código lê.
    const route = readFileSync(join(APP_DIR, 'api/cron/daily-news/route.ts'), 'utf8');
    const declared = /export const maxDuration\s*=\s*(\d+)\s*;/.exec(route);

    expect(declared).not.toBeNull();
    expect(Number(declared?.[1]) * 1000).toBe(CRON_MAX_DURATION_MS);
    expect(CRON_MAX_DURATION_MS).toBeLessThanOrEqual(VERCEL_FUNCTION_MAX_MS);
  });

  it('leaves room for at least one page request after the reserved margin', () => {
    // Sanidade dos números: uma rodada precisa caber em pausa + piso, e o piso
    // não pode passar do prazo de um pedido.
    expect(DAILY_PAGES_FLOOR_MS).toBeLessThanOrEqual(DAILY_PAGES_TIMEOUT_MS);
    expect(CRON_RESPONSE_MARGIN_MS + DAILY_PAGES_PAUSE_MS + DAILY_PAGES_FLOOR_MS).toBeLessThan(
      CRON_MAX_DURATION_MS,
    );
  });
});
