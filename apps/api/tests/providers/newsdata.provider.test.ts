import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { fetchFromNewsData } from '../../src/providers/news/newsdata.provider';
import { baseLogger } from '../../src/utils/logger';

vi.mock('../../src/config/env', () => ({
  env: { NEWSDATA_API_KEY: 'test-key' },
}));

const mockArticle = {
  article_id: 'abc123',
  link: 'https://g1.globo.com/noticia-teste',
  title: 'Notícia de Teste',
  description: 'Descrição da notícia de teste',
  content: 'Conteúdo da notícia de teste',
  pubDate: '2024-01-01 12:00:00',
  image_url: 'https://g1.globo.com/image.jpg',
  source_id: 'g1',
  source_name: 'G1',
  category: ['technology', 'top'],
  country: ['brazil'],
  language: 'portuguese',
  duplicate: false,
};

const mockApiResponse = {
  status: 'success',
  totalResults: 10,
  results: [mockArticle],
};

function makeFetchMock(response = mockApiResponse) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(response),
  });
}

describe('fetchFromNewsData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return normalized articles for given category', async () => {
    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Notícia de Teste');
    expect(result[0].description).toBe('Descrição da notícia de teste');
    expect(result[0].source).toBe('G1');
    expect(result[0].sourceUrl).toBe('https://g1.globo.com/noticia-teste');
    expect(result[0].imageUrl).toBe('https://g1.globo.com/image.jpg');
    expect(result[0].category).toBe(Category.TECHNOLOGY);
  });

  it('should make one fetch call per category', async () => {
    await fetchFromNewsData([Category.TECHNOLOGY, Category.SPORTS]);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should use category=business in URL for ECONOMY', async () => {
    await fetchFromNewsData([Category.ECONOMY]);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('category=business'),
      expect.anything(),
    );
  });

  it('should use category=world in URL for WORLD', async () => {
    await fetchFromNewsData([Category.WORLD]);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('category=world'),
      expect.anything(),
    );
  });

  it('should use country=br and language=pt in URL', async () => {
    await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('country=br'),
      expect.anything(),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('language=pt'),
      expect.anything(),
    );
  });

  it('should filter articles without description', async () => {
    const withoutDescription = { ...mockArticle, description: null };
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ status: 'success', results: [withoutDescription, mockArticle] }),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result).toHaveLength(1);
  });

  it('should filter duplicate articles', async () => {
    const duplicate = { ...mockArticle, duplicate: true };
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ status: 'success', results: [duplicate, mockArticle] }),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result).toHaveLength(1);
  });

  /**
   * **As oito categorias deixaram de ser tudo-ou-nada.**
   *
   * Com `Promise.all`, a categoria que rejeitasse levava junto as sete que já
   * tinham respondido: a colheita inteira da NewsData virava zero e o pipeline
   * seguia para `SUCCESS` só com o RSS — que é o modo de falha silenciosa que
   * ninguém veria, porque o dia continua tendo briefing. O provider de RSS já
   * fazia a escolha certa por feed desde o começo; este ficou para trás, e a
   * assimetria não tinha motivo.
   *
   * Os três casos abaixo são as três formas de uma categoria falhar:
   * transporte, `status: error` no corpo, e HTTP não-ok.
   */
  it('keeps the other categories when one of them fails on transport', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        url.includes('category=world')
          ? Promise.reject(new Error('socket hang up'))
          : Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue(mockApiResponse) }),
      ),
    );

    const result = await fetchFromNewsData([
      Category.TECHNOLOGY,
      Category.WORLD,
      Category.SPORTS,
    ]);

    expect(result).toHaveLength(2);
  });

  it('keeps the other categories when one returns an API error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue(
            url.includes('category=technology')
              ? {
                  status: 'error',
                  results: {
                    message: 'The provided API key is not valid.',
                    code: 'Unauthorized',
                  },
                }
              : mockApiResponse,
          ),
        }),
      ),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY, Category.SPORTS]);

    expect(result).toHaveLength(1);
  });

  it('keeps the other categories when one returns an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        url.includes('category=technology')
          ? Promise.resolve({ ok: false, status: 429, statusText: 'Too Many Requests' })
          : Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue(mockApiResponse) }),
      ),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY, Category.SPORTS]);

    expect(result).toHaveLength(1);
  });

  it('comes back empty instead of throwing when every category fails', async () => {
    // Quem decide o que fazer com a colheita vazia é o `fetchAll`, que a
    // transforma em aviso gravado no run. Lançar aqui nao acrescentaria
    // informacao e custaria as categorias boas do dia em que so uma quebrou.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    await expect(
      fetchFromNewsData([Category.TECHNOLOGY, Category.SPORTS]),
    ).resolves.toEqual([]);
  });

  it('names the category that failed and the one that came back empty', async () => {
    // Oito respostas viram um numero so; sem o aviso por categoria, a que
    // sumiu nao deixa rastro nenhum. E o mesmo aviso que o RSS emite por feed.
    const warn = vi.spyOn(baseLogger, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        url.includes('category=technology')
          ? Promise.reject(new Error('socket hang up'))
          : Promise.resolve({
              ok: true,
              json: vi
                .fn()
                .mockResolvedValue({ status: 'success', totalResults: 0, results: [] }),
            }),
      ),
    );

    await fetchFromNewsData([Category.TECHNOLOGY, Category.SPORTS]);

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'TECHNOLOGY', err: expect.any(Error) }),
      expect.stringContaining('falhou'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'SPORTS' }),
      expect.stringContaining('zero itens'),
    );
    warn.mockRestore();
  });

  it('gives every category request a deadline', async () => {
    // Sem prazo, uma requisicao que abre a conexao e nao responde prende a
    // etapa 1 sem teto — e sao oito em paralelo, entao basta uma.
    await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should fall back to source_id when source_name is missing', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ status: 'success', results: [{ ...mockArticle, source_name: undefined }] }),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result[0].source).toBe('g1');
  });

  it('should fall back to a generic label when both source fields are missing', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        status: 'success',
        results: [{ ...mockArticle, source_name: undefined, source_id: undefined }],
      }),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result[0].source).toBe('Unknown source');
  });

  it('should null out content when it is the paid plan placeholder', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        status: 'success',
        results: [{ ...mockArticle, content: 'ONLY AVAILABLE IN PAID PLANS' }],
      }),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result[0].content).toBeNull();
  });

  it('should keep real content that is not the paid placeholder', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        status: 'success',
        results: [{ ...mockArticle, content: 'Conteúdo real da notícia' }],
      }),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result[0].content).toBe('Conteúdo real da notícia');
  });
});
