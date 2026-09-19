import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import requestConfig from '@/i18n/request';
import { STATIC_NOW } from '@/lib/i18n';
import sitemap from '@/app/sitemap';

/**
 * **Uma regeneração da ISR com o mesmo dado tem de sair byte a byte igual.**
 *
 * A Vercel mede ISR Writes em unidades de 8 KB e só cobra quando o conteúdo
 * mudou — então o que uma página custa não é "uma escrita por revalidação", é
 * "uma escrita por revalidação **que produziu saída diferente**". Medido em
 * 19/09/2026: a Home tem 309 KB de HTML + 118 KB de RSC (53 unidades), uma
 * matéria 36, um briefing 42 — e **toda** regeneração produzia saída diferente,
 * porque o `NextIntlClientProvider` serializa `now` e o padrão do next-intl é
 * `new Date()` por requisição. Três páginas, três valores, cada um a hora da
 * própria geração. Só as três listagens, de hora em hora nos dois idiomas,
 * somavam ~5.100 unidades/dia: 150 mil em 30 dias, o aviso de 75% da cota.
 *
 * A guarda tem duas metades, e as duas são necessárias: o valor está fixo
 * (senão o payload muda), e ninguém lê esse valor (senão fixá-lo mentiria).
 */

const WEB_ROOT = process.cwd();

const getNewsMock = vi.fn();
const getArticlesMock = vi.fn();

// No build de servidor do next-intl `getRequestConfig` é a identidade
// (`dist/*/server/react-server/getRequestConfig.js`: `return createRequestConfig`).
// O Vitest resolve `next-intl/server` para o build de cliente, que só lança —
// então o mock reproduz o que o servidor faz, e o teste chama a função real.
vi.mock('next-intl/server', () => ({
  getRequestConfig: <T>(createRequestConfig: T): T => createRequestConfig,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    getNews: (...args: unknown[]) => getNewsMock(...args),
    getArticles: (...args: unknown[]) => getArticlesMock(...args),
  };
});

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function collect(dir: string, out: Array<{ file: string; source: string }> = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.tsx?$/.test(entry)) {
      out.push({
        file: path.relative(WEB_ROOT, full).replace(/\\/g, '/'),
        source: stripComments(readFileSync(full, 'utf8')),
      });
    }
  }
  return out;
}

/** Quem lê o relógio do next-intl — o que a fixação do `now` proíbe. */
const READS_INTL_CLOCK = /\b(useNow|getNow|relativeTime)\s*\(/;

describe('o `now` do next-intl está fixo', () => {
  it('a configuração da requisição devolve o pino, nos dois idiomas', async () => {
    for (const locale of ['pt-BR', 'en']) {
      const config = await requestConfig({
        locale,
        requestLocale: Promise.resolve(locale),
      });

      expect(config.now).toBe(STATIC_NOW);
      expect(config.locale).toBe(locale);
    }
  });

  it('o pino é a época — reconhecível como pino, nunca como data que alguém quis dizer', () => {
    expect(STATIC_NOW.getTime()).toBe(0);
  });

  it('o layout não sobrescreve o valor herdado com um `now` próprio', () => {
    // `NextIntlClientProviderServer` faz `now ?? getNow()`: uma prop `now` no
    // provider venceria a configuração, e `now={new Date()}` reabriria tudo.
    const layout = stripComments(
      readFileSync(path.resolve(WEB_ROOT, 'app/[locale]/layout.tsx'), 'utf8'),
    );

    expect(layout).toContain('<NextIntlClientProvider');
    expect(layout).not.toMatch(/\bnow=/);
  });

  it('ninguém lê esse relógio — fixá-lo mentiria', () => {
    const readers = ['app', 'components', 'lib', 'i18n']
      .flatMap((dir) => collect(path.resolve(WEB_ROOT, dir)))
      .filter(({ source }) => READS_INTL_CLOCK.test(source))
      .map(({ file }) => file);

    expect(readers).toEqual([]);
  });

  it('o detector acha um leitor quando há um', () => {
    // Sem isto "ninguém lê" poderia ser verdade porque o regex não casa nada.
    expect(READS_INTL_CLOCK.test('const now = useNow({ updateInterval: 1000 });')).toBe(true);
    expect(READS_INTL_CLOCK.test('format.relativeTime(date)')).toBe(true);
    expect(READS_INTL_CLOCK.test('const now = await getNow();')).toBe(true);
    expect(READS_INTL_CLOCK.test('const nowish = knownNow();')).toBe(false);
  });
});

describe('o sitemap é determinístico', () => {
  const OLDER = '2026-09-18T11:00:00.000Z';
  const NEWEST = '2026-09-19T11:00:09.000Z';
  const ITEM_DATES = [OLDER, NEWEST];

  beforeEach(() => {
    getNewsMock.mockReset();
    getArticlesMock.mockReset();
    getNewsMock.mockResolvedValue({
      data: ITEM_DATES.map((updatedAt, index) => ({ id: `news-${index}`, updatedAt })),
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
    getArticlesMock.mockResolvedValue({
      data: [{ date: '2026-09-19T00:00:00.000Z', updatedAt: NEWEST }],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('duas regenerações com o mesmo dado saem iguais, com o relógio andando', async () => {
    // Era `lastModified: new Date()` nas rotas fixas: cada regeneração de hora
    // em hora produzia um documento diferente, e a Vercel cobra pela mudança.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'));
    const first = await sitemap();

    vi.setSystemTime(new Date('2026-09-19T13:00:00.000Z'));
    const second = await sitemap();

    expect(second).toEqual(first);
  });

  it('toda data do documento vem do dado, nunca do relógio', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'));

    const entries = await sitemap();
    const stamps = entries
      .map((entry) => entry.lastModified)
      .filter((value): value is Date => value instanceof Date)
      .map((date) => date.toISOString());

    expect(stamps.length).toBeGreaterThan(0);
    expect(new Set(stamps)).toEqual(new Set(ITEM_DATES));
    expect(stamps).not.toContain('2026-09-19T12:00:00.000Z');
  });

  it('as listagens carregam a data do item mais novo; o que não muda não declara data', async () => {
    const entries = await sitemap();
    const byPath = new Map(
      entries.map((entry) => [new URL(entry.url).pathname, entry.lastModified]),
    );

    expect(byPath.get('/pt-BR')).toEqual(new Date(NEWEST));
    expect(byPath.get('/pt-BR/news')).toEqual(new Date(NEWEST));
    expect(byPath.get('/pt-BR/article')).toEqual(new Date(NEWEST));
    expect(byPath.get('/pt-BR/about')).toBeUndefined();
    expect(byPath.get('/pt-BR/newsletter')).toBeUndefined();
  });

  it('com a API fora, relança onde o resultado é publicado — a ISR mantém o anterior', async () => {
    vi.stubEnv('VERCEL', '1');
    getNewsMock.mockRejectedValue(new Error('API down'));

    await expect(sitemap()).rejects.toThrow('API down');
  });

  it('no build do CI, que não publica, sai só com as rotas fixas', async () => {
    vi.stubEnv('VERCEL', '');
    getNewsMock.mockRejectedValue(new Error('API down'));
    getArticlesMock.mockRejectedValue(new Error('API down'));

    const entries = await sitemap();

    expect(entries.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/pt-BR',
      '/en',
      '/pt-BR/news',
      '/en/news',
      '/pt-BR/article',
      '/en/article',
      '/pt-BR/newsletter',
      '/en/newsletter',
      '/pt-BR/about',
      '/en/about',
    ]);
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });
});
