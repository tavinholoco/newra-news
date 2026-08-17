import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SignJWT } from 'jose';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@newranews/database';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      user: {
        upsert: vi.fn(),
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

async function signUpsertToken(email: string, overrides: Record<string, unknown> = {}) {
  return new SignJWT({ purpose: 'auth-upsert', email, ...overrides })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET);
}

const makeUser = (email: string, role: 'USER' | 'ADMIN' = 'USER') => ({
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  email,
  name: 'Nome do Usuário',
  image: null,
  role,
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T08:00:00Z'),
});

describe('POST /api/auth/upsert', () => {
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
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      payload: { email: 'user@test.com' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 with an invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: 'Bearer not-a-jwt' },
      payload: { email: 'user@test.com' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 when the token is not an upsert token', async () => {
    const token = await new SignJWT({ sub: 'user-1', email: 'user@test.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(SECRET);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'user@test.com' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 when the token email differs from the body', async () => {
    const token = await signUpsertToken('outro@test.com');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'user@test.com' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should accept null name/image from OAuth providers', async () => {
    const user = makeUser('user@test.com');
    vi.mocked(prisma.user.upsert).mockResolvedValue(user as never);
    const token = await signUpsertToken('user@test.com');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'user@test.com', name: null, image: null },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should return 400 for an invalid email', async () => {
    const token = await signUpsertToken('invalido');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'nao-e-email' },
    });

    expect(res.statusCode).toBe(400);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it('should create a user with USER role and return the data', async () => {
    const user = makeUser('user@test.com');
    vi.mocked(prisma.user.upsert).mockResolvedValue(user as never);
    const token = await signUpsertToken('user@test.com');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'user@test.com', name: 'Nome do Usuário' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { id: string; email: string; role: string };
    };
    expect(body.data.email).toBe('user@test.com');
    expect(body.data.role).toBe('USER');
    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'user@test.com' },
      create: {
        email: 'user@test.com',
        name: 'Nome do Usuário',
        image: null,
        role: 'USER',
      },
      update: {
        name: 'Nome do Usuário',
        image: undefined,
        role: 'USER',
      },
    });
  });

  it('should assign ADMIN role for emails in ADMIN_EMAILS', async () => {
    vi.mocked(prisma.user.upsert).mockResolvedValue(
      makeUser('admin@newranews.com', 'ADMIN') as never,
    );
    const token = await signUpsertToken('admin@newranews.com');

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'admin@newranews.com' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { role: string } };
    expect(body.data.role).toBe('ADMIN');
    const call = vi.mocked(prisma.user.upsert).mock.calls[0][0] as {
      create: { role: string };
    };
    expect(call.create.role).toBe('ADMIN');
  });
});
