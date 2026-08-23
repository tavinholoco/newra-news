import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'fastify';
import { getNewsById, listNews, getNewsFacets } from '../../src/services/news.service';

vi.mock('../../src/services/news.service', () => ({
  listNews: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getNewsById: vi.fn().mockResolvedValue(null),
  getNewsFacets: vi.fn().mockResolvedValue({ categories: [], sources: [] }),
}));

describe('GET /api/news', () => {
  let app: FastifyInstance;
  let response: LightMyRequestResponse;

  beforeAll(async () => {
    app = await buildTestApp();
    response = await app.inject({ method: 'GET', url: '/api/news' });
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

  it('should use default pagination (page=1, limit=20)', () => {
    const body = JSON.parse(response.body);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(20);
  });

  it('should return correct meta shape', () => {
    const body = JSON.parse(response.body);
    expect(body.meta.total).toBeTypeOf('number');
    expect(body.meta.totalPages).toBeTypeOf('number');
  });

  it('should serialize a real row through the response schema', async () => {
    const id = 'a0000000-0000-0000-0000-000000000001';
    // **A listagem nunca tinha serializado uma linha de verdade.** O
    // `listNews` estava mockado em `{ data: [], total: 0 }` em toda a suíte, e
    // a rota mais chamada do produto passava por `data: []` — o `map` que
    // converte as datas ficava sem execução, e o schema de resposta sem
    // exercício.
    //
    // Isso importa porque o `fastify-type-provider-zod` serializa **pelo
    // schema**: campo que o serviço carrega e o schema não declara é
    // descartado em silêncio. Com a lista sempre vazia, a suíte não podia
    // achar a versão deste defeito que custou um dia de produção na Fase 5.
    vi.mocked(listNews).mockResolvedValueOnce({
      data: [
        {
          id: id,
          title: 'Manchete',
          description: 'Resumo',
          content: 'Corpo',
          source: 'G1',
          sourceUrl: 'https://g1.globo.com/x',
          imageUrl: 'https://g1.globo.com/x.jpg',
          category: 'TECHNOLOGY',
          publishedAt: new Date('2026-08-23T10:00:00.000Z'),
          createdAt: new Date('2026-08-23T10:05:00.000Z'),
          updatedAt: new Date('2026-08-23T10:06:00.000Z'),
        },
      ],
      total: 1,
    } as never);

    const res = await app.inject({ method: 'GET', url: '/api/news' });
    const body = JSON.parse(res.body) as { data: Record<string, unknown>[] };
    const [item] = body.data;

    expect(res.statusCode).toBe(200);
    expect(item).toEqual({
      id: id,
      title: 'Manchete',
      description: 'Resumo',
      content: 'Corpo',
      source: 'G1',
      sourceUrl: 'https://g1.globo.com/x',
      imageUrl: 'https://g1.globo.com/x.jpg',
      category: 'TECHNOLOGY',
      publishedAt: '2026-08-23T10:00:00.000Z',
      createdAt: '2026-08-23T10:05:00.000Z',
      updatedAt: '2026-08-23T10:06:00.000Z',
    });
  });

  it('should accept custom pagination params', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?page=2&limit=5' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meta.page).toBe(2);
    expect(body.meta.limit).toBe(5);
  });

  it('should filter by valid category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?category=TECHNOLOGY' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should return 400 for invalid category value', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?category=INVALID' });
    expect(res.statusCode).toBe(400);
  });

  it('should be documented in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body);
    expect(spec.paths['/api/news/']).toBeDefined();
  });

  it('should include rate limit headers', () => {
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
  });
});

describe('GET /api/news/:id', () => {
  let app: FastifyInstance;
  const VALID_UUID = 'a0000000-0000-0000-0000-000000000001';
  const mockNews = {
    id: VALID_UUID,
    title: 'Test News',
    description: 'Test description',
    content: null,
    source: 'Test Source',
    sourceUrl: 'https://example.com',
    imageUrl: null,
    category: 'TECHNOLOGY',
    publishedAt: new Date('2024-01-01T00:00:00.000Z'),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with news data when found', async () => {
    vi.mocked(getNewsById).mockResolvedValueOnce(mockNews as never);
    const res = await app.inject({ method: 'GET', url: `/api/news/${VALID_UUID}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(VALID_UUID);
    expect(body.data.title).toBe('Test News');
  });

  it('should return ISO datetime strings for publishedAt and createdAt', async () => {
    vi.mocked(getNewsById).mockResolvedValueOnce(mockNews as never);
    const res = await app.inject({ method: 'GET', url: `/api/news/${VALID_UUID}` });
    const body = JSON.parse(res.body);
    expect(body.data.publishedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(body.data.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should return 404 when news not found', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/news/${VALID_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news/not-a-uuid' });
    expect(res.statusCode).toBe(400);
  });

  it('should be documented in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body);
    expect(spec.paths['/api/news/{id}']).toBeDefined();
  });
});

describe('GET /api/news — filtros da Fase 4', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should default sort to recent', async () => {
    vi.mocked(listNews).mockClear();
    await app.inject({ method: 'GET', url: '/api/news' });

    expect(vi.mocked(listNews).mock.calls[0][1]).toMatchObject({
      sort: 'recent',
    });
  });

  it('should pass source, period and sort through to the service', async () => {
    vi.mocked(listNews).mockClear();
    const res = await app.inject({
      method: 'GET',
      url: '/api/news?source=G1&from=2024-01-01T00:00:00.000Z&to=2024-01-31T00:00:00.000Z&sort=oldest',
    });

    expect(res.statusCode).toBe(200);
    const [filters, pagination] = vi.mocked(listNews).mock.calls[0];
    expect(filters).toMatchObject({
      source: 'G1',
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-01-31T00:00:00.000Z',
    });
    expect(pagination).toMatchObject({ sort: 'oldest' });
  });

  it('should return 400 for an unknown sort value', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?sort=random' });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for a period that is not a datetime', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?from=yesterday' });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/news/facets', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return the facets envelope', async () => {
    vi.mocked(getNewsFacets).mockResolvedValueOnce({
      categories: [{ category: 'SPORTS', count: 5 }],
      sources: [{ source: 'G1', count: 5 }],
    } as never);

    const res = await app.inject({ method: 'GET', url: '/api/news/facets' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.categories[0]).toEqual({ category: 'SPORTS', count: 5 });
    expect(body.data.sources[0]).toEqual({ source: 'G1', count: 5 });
  });

  it('should not be swallowed by the /:id route', async () => {
    // `/:id` exige UUID: se o roteador casasse `facets` com ele, a resposta
    // seria 400 e o `category-nav` ficaria sem contagem sem dizer por quê.
    const res = await app.inject({ method: 'GET', url: '/api/news/facets' });
    expect(res.statusCode).toBe(200);
  });

  it('should forward the filters that narrow the archive', async () => {
    vi.mocked(getNewsFacets).mockClear();
    await app.inject({
      method: 'GET',
      url: '/api/news/facets?search=copa&category=SPORTS',
    });

    expect(vi.mocked(getNewsFacets).mock.calls[0][0]).toMatchObject({
      search: 'copa',
      category: 'SPORTS',
    });
  });

  it('should be cacheable at the CDN', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news/facets' });
    expect(res.headers['cache-control']).toContain('s-maxage');
  });

  it('should be documented in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body);
    expect(spec.paths['/api/news/facets']).toBeDefined();
  });
});
