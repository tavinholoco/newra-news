import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'fastify';
import {
  getLatestArticle,
  getArticleByDate,
  listArticles,
} from '../../src/services/article.service';

vi.mock('../../src/services/article.service', () => ({
  listArticles: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getLatestArticle: vi.fn().mockResolvedValue(null),
  getArticleByDate: vi.fn().mockResolvedValue(null),
}));

const mockSource = {
  id: 'c0000000-0000-0000-0000-000000000001',
  // `position` é 0-based: o pipeline grava o índice do `map` sobre as
  // selecionadas, na ordem em que foram enviadas à IA.
  position: 0,
  title: 'Notícia que entrou no briefing',
  source: 'G1',
  sourceUrl: 'https://g1.globo.com/teste',
  newsId: 'a0000000-0000-0000-0000-000000000001',
};

const mockArticle = {
  id: 'b0000000-0000-0000-0000-000000000001',
  title: 'Test Article',
  content: 'Full article content',
  summary: 'Short summary',
  date: new Date('2024-01-15T00:00:00.000Z'),
  newsCount: 5,
  createdAt: new Date('2024-01-15T01:00:00.000Z'),
  updatedAt: new Date('2024-01-15T01:00:00.000Z'),
  generatedAt: new Date('2024-01-15T00:58:00.000Z'),
  promptVersion: 'v2',
  modelVersion: 'gemini-2.0-flash',
  status: 'PUBLISHED' as const,
  sources: [mockSource],
};

/** Artigo anterior à migration de auditoria: os três campos são nulos. */
const legacyArticle = {
  ...mockArticle,
  generatedAt: null,
  promptVersion: null,
  modelVersion: null,
  sources: [],
};

describe('GET /api/articles', () => {
  let app: FastifyInstance;
  let response: LightMyRequestResponse;

  beforeAll(async () => {
    app = await buildTestApp();
    response = await app.inject({ method: 'GET', url: '/api/articles' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200', () => {
    expect(response.statusCode).toBe(200);
  });

  it('should return data array and meta object', () => {
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
  });

  it('should use default pagination (page=1, limit=10)', () => {
    const body = JSON.parse(response.body);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(10);
  });

  it('should accept custom pagination params', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles?page=2&limit=5' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meta.page).toBe(2);
    expect(body.meta.limit).toBe(5);
  });

  it('should be documented in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body);
    expect(spec.paths['/api/articles/']).toBeDefined();
  });

  it('should include rate limit headers', () => {
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
  });
});

describe('GET /api/articles/latest', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with article when found', async () => {
    vi.mocked(getLatestArticle).mockResolvedValueOnce(mockArticle as never);
    const res = await app.inject({ method: 'GET', url: '/api/articles/latest' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(mockArticle.id);
    expect(body.data.title).toBe('Test Article');
  });

  it('should return ISO datetime strings for date, createdAt, updatedAt', async () => {
    vi.mocked(getLatestArticle).mockResolvedValueOnce(mockArticle as never);
    const res = await app.inject({ method: 'GET', url: '/api/articles/latest' });
    const body = JSON.parse(res.body);
    expect(body.data.date).toBe('2024-01-15T00:00:00.000Z');
    expect(body.data.createdAt).toBe('2024-01-15T01:00:00.000Z');
    expect(body.data.updatedAt).toBe('2024-01-15T01:00:00.000Z');
  });

  it('should return 404 when no article found', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles/latest' });
    expect(res.statusCode).toBe(404);
  });

  it('should be documented in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body);
    expect(spec.paths['/api/articles/latest']).toBeDefined();
  });
});

describe('GET /api/articles/:date', () => {
  let app: FastifyInstance;
  const VALID_DATE = '2024-01-15';

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with article when found', async () => {
    vi.mocked(getArticleByDate).mockResolvedValueOnce(mockArticle as never);
    const res = await app.inject({ method: 'GET', url: `/api/articles/${VALID_DATE}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(mockArticle.id);
    expect(body.data.newsCount).toBe(5);
  });

  it('should return ISO datetime strings for date fields', async () => {
    vi.mocked(getArticleByDate).mockResolvedValueOnce(mockArticle as never);
    const res = await app.inject({ method: 'GET', url: `/api/articles/${VALID_DATE}` });
    const body = JSON.parse(res.body);
    expect(body.data.date).toBe('2024-01-15T00:00:00.000Z');
    expect(body.data.createdAt).toBe('2024-01-15T01:00:00.000Z');
  });

  it('should return 404 when article not found', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/articles/${VALID_DATE}` });
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 for invalid date format', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/articles/not-a-date' });
    expect(res.statusCode).toBe(400);
  });

  it('should be documented in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body);
    expect(spec.paths['/api/articles/{date}']).toBeDefined();
  });
});

describe('transparência de IA no payload do artigo (§8, pré-requisito da Fase 5)', () => {
  let app: FastifyInstance;
  const VALID_DATE = '2024-01-15';

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should carry the audit fields on GET /:date', async () => {
    // O serviço já os lia desde a Fase 0.5; o schema de resposta era o da V1 e
    // os descartava na serialização, então a §8 não tinha o que exibir.
    vi.mocked(getArticleByDate).mockResolvedValueOnce(mockArticle as never);
    const res = await app.inject({ method: 'GET', url: `/api/articles/${VALID_DATE}` });

    const { data } = JSON.parse(res.body);
    expect(data.generatedAt).toBe('2024-01-15T00:58:00.000Z');
    expect(data.promptVersion).toBe('v2');
    expect(data.modelVersion).toBe('gemini-2.0-flash');
    expect(data.status).toBe('PUBLISHED');
  });

  it('should carry the source list, in position order', async () => {
    vi.mocked(getArticleByDate).mockResolvedValueOnce({
      ...mockArticle,
      sources: [
        { ...mockSource, position: 0, title: 'Primeira' },
        { ...mockSource, id: 'c0000000-0000-0000-0000-000000000002', position: 1, title: 'Segunda' },
      ],
    } as never);
    const res = await app.inject({ method: 'GET', url: `/api/articles/${VALID_DATE}` });

    const { data } = JSON.parse(res.body);
    expect(data.sources.map((s: { title: string }) => s.title)).toEqual([
      'Primeira',
      'Segunda',
    ]);
  });

  it('should carry the audit fields on GET /latest too', async () => {
    vi.mocked(getLatestArticle).mockResolvedValueOnce(mockArticle as never);
    const res = await app.inject({ method: 'GET', url: '/api/articles/latest' });

    const { data } = JSON.parse(res.body);
    expect(data.modelVersion).toBe('gemini-2.0-flash');
    expect(data.sources).toHaveLength(1);
  });

  it('should answer null, not omit, for an article older than the migration', async () => {
    // Nulo é o estado normal do acervo anterior a 20/08 — a tela desenha sem a
    // seção de transparência, e precisa conseguir distinguir "não há" de "não
    // veio no payload".
    vi.mocked(getArticleByDate).mockResolvedValueOnce(legacyArticle as never);
    const res = await app.inject({ method: 'GET', url: `/api/articles/${VALID_DATE}` });

    const { data } = JSON.parse(res.body);
    expect(data).toHaveProperty('generatedAt', null);
    expect(data).toHaveProperty('promptVersion', null);
    expect(data).toHaveProperty('modelVersion', null);
    expect(data.sources).toEqual([]);
  });

  it('should keep the source list out of the paginated listing', async () => {
    // ~15 fontes por artigo × 10 artigos por página, sem nada as exibindo.
    vi.mocked(listArticles).mockResolvedValueOnce({
      data: [mockArticle],
      total: 1,
    } as never);
    const res = await app.inject({ method: 'GET', url: '/api/articles' });

    const { data } = JSON.parse(res.body);
    expect(data[0]).not.toHaveProperty('sources');
    // Os escalares de auditoria continuam: são baratos e o tipo compartilhado
    // `Article` os declara como obrigatórios.
    expect(data[0].modelVersion).toBe('gemini-2.0-flash');
  });
});
