import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@newranews/database';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      news: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      article: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      favorite: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSDATA_API_KEY: 'test-key',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-1.5-flash',
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
    RESEND_API_KEY: 'test-resend-key',
    SITE_URL: 'http://localhost:3000',
    NEWSLETTER_FROM: 'Newra News <news@test.com>',
    AUTH_JWT_SECRET: 'test-jwt-secret',
    ADMIN_EMAILS: 'admin@newranews.com',
  },
}));

const SECRET = new TextEncoder().encode('test-jwt-secret');
const USER_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const NEWS_ID = 'cccccccc-0000-0000-0000-000000000001';
const ARTICLE_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const FAVORITE_ID = 'dddddddd-0000-0000-0000-000000000001';

async function signUserToken() {
  return new SignJWT({ sub: USER_ID, email: 'user@test.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET);
}

const makeNews = (id = NEWS_ID) => ({
  id,
  title: 'Notícia de teste',
  description: 'Descrição',
  content: 'Conteúdo',
  source: 'Fonte',
  sourceUrl: 'https://example.com/1',
  imageUrl: null,
  category: 'WORLD' as const,
  publishedAt: new Date('2024-01-01T08:00:00Z'),
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T08:00:00Z'),
});

const makeArticle = (id = ARTICLE_ID) => ({
  id,
  title: 'Briefing de teste',
  summary: 'Resumo',
  date: new Date('2024-01-03T00:00:00Z'),
  newsCount: 15,
});

const makeFavorite = (
  overrides: Partial<{ id: string; itemType: 'NEWS' | 'ARTICLE'; itemId: string }> = {},
) => ({
  id: FAVORITE_ID,
  userId: USER_ID,
  itemType: 'NEWS' as const,
  itemId: NEWS_ID,
  createdAt: new Date('2024-01-02T08:00:00Z'),
  ...overrides,
});

/** Ver o comentário do mesmo helper em `tests/services/favorite.test.ts`. */
function mockContent(
  news: ReturnType<typeof makeNews>[],
  articles: ReturnType<typeof makeArticle>[] = [],
) {
  vi.mocked(prisma.news.findMany).mockImplementation((async (args: {
    select?: unknown;
  }) =>
    args.select
      ? news.map((item) => ({ id: item.id, publishedAt: item.publishedAt }))
      : news) as never);

  vi.mocked(prisma.article.findMany).mockImplementation((async (args: {
    select?: { title?: boolean };
  }) =>
    args.select && !args.select.title
      ? articles.map((item) => ({ id: item.id, date: item.date }))
      : articles) as never);
}

describe('Favorites routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/favorites' });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 with an invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites',
      headers: { authorization: 'Bearer not-a-jwt' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should list saved news with the content embedded', async () => {
    vi.mocked(prisma.favorite.findMany).mockResolvedValue([makeFavorite()] as never);
    mockContent([makeNews()]);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ id: string; itemType: string; itemId: string; news: { title: string } }>;
      meta: { total: number; totalPages: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(FAVORITE_ID);
    expect(body.data[0].itemType).toBe('NEWS');
    expect(body.data[0].news.title).toBe('Notícia de teste');
    expect(body.meta.total).toBe(1);
    expect(body.meta.totalPages).toBe(1);
  });

  it('should serve a saved briefing without dragging its whole body along', async () => {
    vi.mocked(prisma.favorite.findMany).mockResolvedValue([
      makeFavorite({ itemType: 'ARTICLE', itemId: ARTICLE_ID }),
    ] as never);
    mockContent([], [makeArticle()]);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ itemType: string; article: Record<string, unknown> }>;
    };
    expect(body.data[0].itemType).toBe('ARTICLE');
    expect(body.data[0].article.title).toBe('Briefing de teste');
    expect(body.data[0].article).not.toHaveProperty('content');
  });

  it('should never carry a shared cache header — the answer is per user', async () => {
    vi.mocked(prisma.favorite.findMany).mockResolvedValue([] as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('should pass the archive filters through to the listing', async () => {
    vi.mocked(prisma.favorite.findMany).mockResolvedValue([makeFavorite()] as never);
    mockContent([makeNews()]);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites?category=WORLD&source=Fonte&sort=oldest',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: 'WORLD',
          source: { equals: 'Fonte', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('should list the ids of everything saved', async () => {
    vi.mocked(prisma.favorite.findMany).mockResolvedValue([
      { itemType: 'NEWS', itemId: NEWS_ID },
      { itemType: 'ARTICLE', itemId: ARTICLE_ID },
    ] as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites/ids',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      data: { news: [NEWS_ID], articles: [ARTICLE_ID] },
    });
  });

  it('should save a news item when no type is given', async () => {
    vi.mocked(prisma.news.findUnique).mockResolvedValue(makeNews() as never);
    vi.mocked(prisma.favorite.upsert).mockResolvedValue(makeFavorite() as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemId: NEWS_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { itemType: string; itemId: string; userId: string };
    };
    expect(body.data.itemType).toBe('NEWS');
    expect(body.data.itemId).toBe(NEWS_ID);
    expect(body.data.userId).toBe(USER_ID);
  });

  it('should save the daily briefing', async () => {
    vi.mocked(prisma.article.findUnique).mockResolvedValue({ id: ARTICLE_ID } as never);
    vi.mocked(prisma.favorite.upsert).mockResolvedValue(
      makeFavorite({ itemType: 'ARTICLE', itemId: ARTICLE_ID }) as never,
    );
    const token = await signUserToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemType: 'ARTICLE', itemId: ARTICLE_ID },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.favorite.upsert).toHaveBeenCalledWith({
      where: {
        userId_itemType_itemId: {
          userId: USER_ID,
          itemType: 'ARTICLE',
          itemId: ARTICLE_ID,
        },
      },
      create: { userId: USER_ID, itemType: 'ARTICLE', itemId: ARTICLE_ID },
      update: {},
    });
  });

  it('should return 404 when the content does not exist', async () => {
    vi.mocked(prisma.news.findUnique).mockResolvedValue(null);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
      payload: { itemId: NEWS_ID },
    });

    expect(res.statusCode).toBe(404);
    expect(prisma.favorite.upsert).not.toHaveBeenCalled();
  });

  it('should remove a saved item addressed by type and id', async () => {
    vi.mocked(prisma.favorite.findUnique).mockResolvedValue(makeFavorite() as never);
    vi.mocked(prisma.favorite.delete).mockResolvedValue(makeFavorite() as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/favorites/news/${NEWS_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ data: { removed: true } });
    expect(prisma.favorite.findUnique).toHaveBeenCalledWith({
      where: {
        userId_itemType_itemId: { userId: USER_ID, itemType: 'NEWS', itemId: NEWS_ID },
      },
    });
  });

  it('should reject a type the enum does not know', async () => {
    const token = await signUserToken();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/favorites/podcast/${NEWS_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
    expect(prisma.favorite.findUnique).not.toHaveBeenCalled();
  });

  it('should return 404 when removing something that was not saved', async () => {
    vi.mocked(prisma.favorite.findUnique).mockResolvedValue(null);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/favorites/news/${NEWS_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(prisma.favorite.delete).not.toHaveBeenCalled();
  });
});
