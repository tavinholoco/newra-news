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
      // A trilha de auditoria da Fase 5 — sem o mock, `recordAuditEvent` cai
      // no `catch` e a suíte passaria sem medir a linha.
      auditEvent: {
        create: vi.fn(),
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
    GROQ_MODEL: 'openai/gpt-oss-20b',
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
    vi.mocked(prisma.auditEvent.create).mockResolvedValue({} as never);
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

  /**
   * **Quem apagou o quê — a trilha da Fase 5.** Até aqui o `sub` chegava a este
   * handler e morria com a resposta; a linha do Render era o único outro
   * registro, e ela rola para fora.
   */
  describe('the audit trail', () => {
    it('records the actor, the target and the outcome when the news is deleted', async () => {
      const token = await signToken({ sub: ADMIN_ID, email: 'admin@test.com', role: 'ADMIN' });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/news/${NEWS_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1);
      const [arg] = vi.mocked(prisma.auditEvent.create).mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(arg.data).toMatchObject({
        actorId: ADMIN_ID,
        action: 'news.deleted',
        targetId: NEWS_ID,
        outcome: 'deleted',
        requestId: res.headers['x-request-id'],
      });
    });

    it('records the attempt on a news that does not exist — the 404 is an action too', async () => {
      vi.mocked(prisma.news.deleteMany).mockResolvedValue({ count: 0 });
      const token = await signToken({ sub: ADMIN_ID, email: 'admin@test.com', role: 'ADMIN' });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/news/${NEWS_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
      const [arg] = vi.mocked(prisma.auditEvent.create).mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(arg.data).toMatchObject({ action: 'news.deleted', outcome: 'not-found' });
    });

    it('refuses before deleting when the session has no subject — an unattributable deletion is what the trail exists to prevent', async () => {
      const token = await signToken({ email: 'admin@test.com', role: 'ADMIN' });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/news/${NEWS_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(401);
      expect(prisma.news.deleteMany).not.toHaveBeenCalled();
      expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    });

    it('does not write for the refused caller — 403 never reaches the handler', async () => {
      const token = await signToken({ sub: USER_ID, email: 'user@test.com', role: 'USER' });

      await app.inject({
        method: 'DELETE',
        url: `/api/news/${NEWS_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(prisma.auditEvent.create).not.toHaveBeenCalled();
    });

    it('still answers 200 when the audit write fails — the news is already gone', async () => {
      vi.mocked(prisma.auditEvent.create).mockRejectedValueOnce(new Error('connection refused'));
      const token = await signToken({ sub: ADMIN_ID, email: 'admin@test.com', role: 'ADMIN' });

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/news/${NEWS_ID}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });
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
