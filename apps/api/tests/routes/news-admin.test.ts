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
        deleteMany: vi.fn(),
        findUnique: vi.fn(),
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
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'llama-3.1-8b-instant',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
    AUTH_JWT_SECRET: 'test-jwt-secret',
    ADMIN_EMAILS: 'admin@newranews.com',
  },
}));

const SECRET = new TextEncoder().encode('test-jwt-secret');
const ADMIN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const NEWS_ID = 'cccccccc-0000-0000-0000-000000000001';

async function signToken(payload: Record<string, string>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET);
}

describe('DELETE /api/news/:id (admin)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.news.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.news.findUnique).mockResolvedValue(null);
  });

  it('should return 401 without a token', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/news/${NEWS_ID}`,
    });

    expect(res.statusCode).toBe(401);
    expect(prisma.news.deleteMany).not.toHaveBeenCalled();
  });

  it('should return 401 with an invalid token', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/news/${NEWS_ID}`,
      headers: { authorization: 'Bearer not-a-jwt' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 403 for a non-admin user', async () => {
    const token = await signToken({ sub: USER_ID, email: 'user@test.com', role: 'USER' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/news/${NEWS_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('Admin access required');
    expect(prisma.news.deleteMany).not.toHaveBeenCalled();
  });

  it('should delete the news when the caller is ADMIN', async () => {
    const token = await signToken({ sub: ADMIN_ID, email: 'admin@test.com', role: 'ADMIN' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/news/${NEWS_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { deleted: boolean; id: string } };
    expect(body.data).toEqual({ deleted: true, id: NEWS_ID });
    expect(prisma.news.deleteMany).toHaveBeenCalledWith({ where: { id: NEWS_ID } });
  });

  it('should return 404 when the news does not exist', async () => {
    vi.mocked(prisma.news.deleteMany).mockResolvedValue({ count: 0 });
    const token = await signToken({ sub: ADMIN_ID, email: 'admin@test.com', role: 'ADMIN' });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/news/${NEWS_ID}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('News not found');
  });

  it('should return 400 for an invalid UUID', async () => {
    const token = await signToken({ sub: ADMIN_ID, email: 'admin@test.com', role: 'ADMIN' });

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/news/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should not require auth for the public GET /api/news/:id', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/news/${NEWS_ID}` });

    expect(res.statusCode).toBe(404); // chega no service (não bloqueado por auth)
    expect(prisma.news.deleteMany).not.toHaveBeenCalled();
  });
});

describe('OpenAPI docs', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should document the DELETE /api/news/{id} endpoint', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body) as { paths: Record<string, unknown> };
    const path = spec.paths['/api/news/{id}'] as { delete?: unknown };
    expect(path?.delete).toBeDefined();
  });
});
