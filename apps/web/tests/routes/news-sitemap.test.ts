import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/news-sitemap.xml/route';
import { SITE_URL } from '@/lib/seo';

const getNewsMock = vi.fn();
const getArticlesMock = vi.fn();
const logServerErrorMock = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
  // `nullUnlessPublishing` é o real de propósito: o que se mede abaixo é a
  // costura entre a rota e a regra "relança onde publica", não uma cópia dela.
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    nullUnlessPublishing: actual.nullUnlessPublishing,
    getNews: (...args: unknown[]) => getNewsMock(...args),
    getArticles: (...args: unknown[]) => getArticlesMock(...args),
  };
});

vi.mock('@/lib/log-server-error', () => ({
  logServerError: (...args: unknown[]) => logServerErrorMock(...args),
}));

const HOJE = '2026-08-22T09:00:00.000Z';

function newsPage(
  items: Array<{ id: string; title: string; publishedAt: string }>,
  totalPages = 1,
) {
  return {
    data: items,
    meta: { page: 1, limit: 100, total: items.length, totalPages },
  };
}

beforeEach(() => {
  getNewsMock.mockReset();
  getArticlesMock.mockReset();
  logServerErrorMock.mockReset();
  getNewsMock.mockResolvedValue(newsPage([]));
  getArticlesMock.mockResolvedValue(newsPage([]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('GET /news-sitemap.xml', () => {
  it('declara o namespace news: e responde como XML', async () => {
    const res = await GET();
    const body = await res.text();

    expect(res.headers.get('Content-Type')).toBe('application/xml');
    expect(body).toContain(
      'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
    );
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('pede à API só a janela de 48h', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(HOJE));

    await GET();

    const [, , filters] = getNewsMock.mock.calls[0] as [
      number,
      number,
      { from: string },
    ];
    expect(filters.from).toBe('2026-08-20T09:00:00.000Z');
  });

  it('emite só a URL pt-BR — o corpo da matéria é o mesmo texto nos dois idiomas', async () => {
    getNewsMock.mockResolvedValue(
      newsPage([
        { id: 'abc', title: 'Manchete', publishedAt: '2026-08-22T08:00:00.000Z' },
      ]),
    );

    const body = await (await GET()).text();

    expect(body).toContain(`<loc>${SITE_URL}/pt-BR/news/abc</loc>`);
    expect(body).not.toContain('/en/news/abc');
  });

  it('news:language é ISO 639 (`pt`), não o BCP-47 da rota', async () => {
    getNewsMock.mockResolvedValue(
      newsPage([
        { id: 'abc', title: 'Manchete', publishedAt: '2026-08-22T08:00:00.000Z' },
      ]),
    );

    const body = await (await GET()).text();

    expect(body).toContain('<news:language>pt</news:language>');
    expect(body).not.toContain('pt-BR</news:language>');
  });

  it('escapa a manchete — o título vem de feed de terceiro', async () => {
    getNewsMock.mockResolvedValue(
      newsPage([
        {
          id: 'abc',
          title: 'Tribunal & "o caso" <urgente>',
          publishedAt: '2026-08-22T08:00:00.000Z',
        },
      ]),
    );

    const body = await (await GET()).text();

    expect(body).toContain(
      '<news:title>Tribunal &amp; &quot;o caso&quot; &lt;urgente&gt;</news:title>',
    );
  });

  it('inclui o briefing da janela e descarta o que é mais velho', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(HOJE));

    getArticlesMock.mockResolvedValue({
      data: [
        {
          title: 'Briefing de hoje',
          date: '2026-08-22T00:00:00.000Z',
          generatedAt: '2026-08-22T05:00:00.000Z',
          updatedAt: '2026-08-22T05:00:00.000Z',
        },
        {
          title: 'Briefing da semana passada',
          date: '2026-08-15T00:00:00.000Z',
          generatedAt: null,
          updatedAt: '2026-08-15T05:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    const body = await (await GET()).text();

    expect(body).toContain(`${SITE_URL}/pt-BR/article/2026-08-22`);
    expect(body).not.toContain('2026-08-15');
  });

  /**
   * **A falha da API sobe onde o resultado é publicado.** Até 19/09/2026 esta
   * suíte fixava o contrário ("documento válido e vazio, nunca 500"), e foi
   * medido o que isso custava: com a API suspensa, a revalidação da ISR
   * regenerou o sitemap de 612 URLs para **zero**, com 200 — e a Vercel
   * gravou, porque 200 é revalidação bem-sucedida. 5xx é falha, e falha
   * mantém o documento anterior no ar. O CI, que constrói sem API e não
   * publica nada, continua recebendo o documento vazio.
   */
  describe('API fora do ar', () => {
    beforeEach(() => {
      getNewsMock.mockRejectedValue(new Error('API down'));
      getArticlesMock.mockRejectedValue(new Error('API down'));
    });

    it('relança onde o resultado é publicado — a ISR mantém o sitemap anterior', async () => {
      vi.stubEnv('VERCEL', '1');

      await expect(GET()).rejects.toThrow('API down');
    });

    it('e a causa sobrevive na linha de log, uma por coleção', async () => {
      vi.stubEnv('VERCEL', '1');

      await GET().catch(() => undefined);

      const collections = logServerErrorMock.mock.calls
        .map(([scope, , context]) => [scope, (context as { collection: string }).collection])
        .sort();
      expect(collections).toEqual([
        ['bff.news-sitemap', 'briefings'],
        ['bff.news-sitemap', 'news'],
      ]);
    });

    it('no build do CI, que não publica, sai um documento válido e vazio', async () => {
      vi.stubEnv('VERCEL', '');

      const res = await GET();
      const body = await res.text();

      expect(res.status).toBe(200);
      expect(body).toContain('<urlset');
      expect(body).toContain('</urlset>');
      expect(body).not.toContain('<url>');
    });
  });

  it('pagina até o teto de 1.000 URLs do formato', async () => {
    // 100 por página é o `limit` máximo de GET /api/news; 10 páginas é o teto.
    getNewsMock.mockResolvedValue(newsPage([], 50));

    await GET();

    expect(getNewsMock).toHaveBeenCalledTimes(10);
  });
});
