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
      favorite: {
        findMany: vi.fn(),
        count: vi.fn(),
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
    GROQ_MODEL: 'llama-3.1-8b-instant',
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

const makeFavorite = (overrides: Partial<{ id: string; newsId: string }> = {}) => ({
  id: FAVORITE_ID,
  userId: USER_ID,
  newsId: NEWS_ID,
  createdAt: new Date('2024-01-02T08:00:00Z'),
  ...overrides,
});

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

  it('should list favorites with the embedded news', async () => {
    const news = makeNews();
    vi.mocked(prisma.favorite.findMany).mockResolvedValue([makeFavorite()] as never);
    vi.mocked(prisma.favorite.count).mockResolvedValue(1);
    vi.mocked(prisma.news.findMany).mockResolvedValue([news] as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ id: string; newsId: string; news: { id: string; title: string } }>;
      meta: { total: number; totalPages: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(FAVORITE_ID);
    expect(body.data[0].news.title).toBe('Notícia de teste');
    expect(body.meta.total).toBe(1);
    expect(body.meta.totalPages).toBe(1);
    expect(prisma.favorite.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('should add a favorite', async () => {
    vi.mocked(prisma.news.findUnique).mockResolvedValue(makeNews() as never);
    vi.mocked(prisma.favorite.upsert).mockResolvedValue(makeFavorite() as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
      payload: { newsId: NEWS_ID },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { newsId: string; userId: string } };
    expect(body.data.newsId).toBe(NEWS_ID);
    expect(body.data.userId).toBe(USER_ID);
    expect(prisma.favorite.upsert).toHaveBeenCalledWith({
      where: { userId_newsId: { userId: USER_ID, newsId: NEWS_ID } },
      create: { userId: USER_ID, newsId: NEWS_ID },
      update: {},
    });
  });

  it('should return 404 when the news does not exist', async () => {
    vi.mocked(prisma.news.findUnique).mockResolvedValue(null);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'POST',
      url: '/api/favorites',
      headers: { authorization: `Bearer ${token}` },
      payload: { newsId: NEWS_ID },
    });

    expect(res.statusCode).toBe(404);
    expect(prisma.favorite.upsert).not.toHaveBeenCalled();
  });

  it('should remove a favorite', async () => {
    vi.mocked(prisma.favorite.findUnique).mockResolvedValue(makeFavorite() as never);
    vi.mocked(prisma.favorite.delete).mockResolvedValue(makeFavorite() as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/favorites/${NEWS_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { removed: boolean } };
    expect(body.data.removed).toBe(true);
    expect(prisma.favorite.delete).toHaveBeenCalledWith({ where: { id: FAVORITE_ID } });
  });

  it('should return 404 when removing a favorite that does not exist', async () => {
    vi.mocked(prisma.favorite.findUnique).mockResolvedValue(null);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/favorites/${NEWS_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(prisma.favorite.delete).not.toHaveBeenCalled();
  });
});
