import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import { getHome } from '../../src/services/home.service';
import { getTrending } from '../../src/services/trending.service';
import { getRelatedNews } from '../../src/services/related.service';
import { EDITORIAL_CACHE_CONTROL } from '../../src/utils/cache';

vi.mock('../../src/services/home.service', () => ({ getHome: vi.fn() }));
vi.mock('../../src/services/trending.service', () => ({ getTrending: vi.fn() }));
vi.mock('../../src/services/related.service', () => ({ getRelatedNews: vi.fn() }));

const NEWS_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

function story(id = NEWS_ID) {
  return {
    id,
    title: 'Titulo',
    dek: 'Resumo',
    imageUrl: null,
    category: 'ECONOMY',
    source: 'G1',
    sourceUrl: 'https://g1.globo.com/x',
    publishedAt: '2026-08-20T12:00:00.000Z',
    updatedAt: null,
    readingTimeMinutes: 3,
  };
}

const EMPTY_HOME = {
  hero: null,
  briefing: null,
  topStories: [],
  trending: [],
  latest: [],
  categories: [],
};

describe('GET /api/home', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHome).mockResolvedValue(EMPTY_HOME as never);
  });

  it('should return 200 with the aggregate envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/home' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveProperty('hero');
    expect(body.data).toHaveProperty('briefing');
    expect(body.data).toHaveProperty('topStories');
    expect(body.data).toHaveProperty('trending');
    expect(body.data).toHaveProperty('latest');
    expect(body.data).toHaveProperty('categories');
  });

  it('should default to 4 category sections', async () => {
    await app.inject({ method: 'GET', url: '/api/home' });

    expect(getHome).toHaveBeenCalledWith({ categories: 4 });
  });

  it('should accept a categories override', async () => {
    await app.inject({ method: 'GET', url: '/api/home?categories=2' });

    expect(getHome).toHaveBeenCalledWith({ categories: 2 });
  });

  it('should reject a categories value outside the range', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/home?categories=99' });

    expect(res.statusCode).toBe(400);
    expect(getHome).not.toHaveBeenCalled();
  });

  it('should reject an unknown locale', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/home?locale=fr' });

    expect(res.statusCode).toBe(400);
  });

  it('should set the editorial Cache-Control', async () => {
    // Estreia o cabecalho na API: nenhuma rota definia cache antes desta.
    const res = await app.inject({ method: 'GET', url: '/api/home' });

    expect(res.headers['cache-control']).toBe(EDITORIAL_CACHE_CONTROL);
  });

  it('should serialise a full payload without dropping fields', async () => {
    vi.mocked(getHome).mockResolvedValue({
      ...EMPTY_HOME,
      hero: { ...story(), isFeatured: true },
      trending: [{ ...story('bbbbbbbb-0000-0000-0000-000000000002'), isTrending: true }],
      categories: [{ category: 'SPORTS', stories: [story('cccccccc-0000-0000-0000-000000000003')] }],
    } as never);

    const res = await app.inject({ method: 'GET', url: '/api/home' });
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.data.hero.isFeatured).toBe(true);
    expect(body.data.trending[0].isTrending).toBe(true);
    expect(body.data.categories[0].category).toBe('SPORTS');
  });
});

describe('GET /api/trending', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTrending).mockResolvedValue([]);
  });

  it('should default to 5 stories over 24h', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trending' });

    expect(res.statusCode).toBe(200);
    expect(getTrending).toHaveBeenCalledWith({ limit: 5, window: '24h' });
  });

  it('should accept the 7d window', async () => {
    await app.inject({ method: 'GET', url: '/api/trending?window=7d&limit=10' });

    expect(getTrending).toHaveBeenCalledWith({ limit: 10, window: '7d' });
  });

  it('should reject an unsupported window', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trending?window=30d' });

    expect(res.statusCode).toBe(400);
    expect(getTrending).not.toHaveBeenCalled();
  });

  it('should cap the limit at 20', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trending?limit=50' });

    expect(res.statusCode).toBe(400);
  });

  it('should set the editorial Cache-Control', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trending' });

    expect(res.headers['cache-control']).toBe(EDITORIAL_CACHE_CONTROL);
  });
});

describe('GET /api/news/:id/related', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRelatedNews).mockResolvedValue([]);
  });

  it('should default to 4 related stories', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/news/${NEWS_ID}/related` });

    expect(res.statusCode).toBe(200);
    expect(getRelatedNews).toHaveBeenCalledWith(NEWS_ID, 4);
  });

  it('should return 404 when the base story does not exist', async () => {
    vi.mocked(getRelatedNews).mockResolvedValue(null);

    const res = await app.inject({ method: 'GET', url: `/api/news/${NEWS_ID}/related` });

    expect(res.statusCode).toBe(404);
  });

  it('should reject a non-uuid id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news/nao-e-uuid/related' });

    expect(res.statusCode).toBe(400);
    expect(getRelatedNews).not.toHaveBeenCalled();
  });

  it('should not shadow GET /api/news/:id', async () => {
    // As duas rotas convivem sob o mesmo prefixo; registrar `related` nao pode
    // capturar o detalhe da noticia.
    const res = await app.inject({ method: 'GET', url: `/api/news/${NEWS_ID}/related` });

    expect(res.statusCode).toBe(200);
    expect(getRelatedNews).toHaveBeenCalled();
  });

  it('should set the editorial Cache-Control', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/news/${NEWS_ID}/related` });

    expect(res.headers['cache-control']).toBe(EDITORIAL_CACHE_CONTROL);
  });
});
