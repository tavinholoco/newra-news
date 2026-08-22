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
      user: {
        findUnique: vi.fn(),
      },
      userPreference: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      subscriber: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      favorite: {
        groupBy: vi.fn(),
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
const EMAIL = 'user@test.com';

async function signUserToken() {
  return new SignJWT({ sub: USER_ID, email: EMAIL })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET);
}

const makeUser = () => ({
  id: USER_ID,
  email: EMAIL,
  name: 'Leitor',
  image: null,
  role: 'USER' as const,
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T08:00:00Z'),
});

const makeSubscriber = (overrides: Record<string, unknown> = {}) => ({
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  email: EMAIL,
  userId: USER_ID,
  status: 'ACTIVE' as const,
  token: 'token-1',
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T08:00:00Z'),
  ...overrides,
});

describe('Account routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.favorite.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.subscriber.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.userPreference.findUnique).mockResolvedValue(null);
  });

  it('should return 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/account' });

    expect(res.statusCode).toBe(401);
  });

  it('should assemble the account screen in one call', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as never);
    vi.mocked(prisma.favorite.groupBy).mockResolvedValue([
      { itemType: 'NEWS', _count: { _all: 4 } },
      { itemType: 'ARTICLE', _count: { _all: 1 } },
    ] as never);
    vi.mocked(prisma.subscriber.findFirst).mockResolvedValue(makeSubscriber() as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/account',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: {
        user: { email: string };
        preferences: { categories: string[]; theme: string };
        newsletter: { subscribed: boolean; email: string | null };
        saved: { news: number; articles: number };
      };
    };
    expect(body.data.user.email).toBe(EMAIL);
    expect(body.data.preferences).toEqual({ categories: [], theme: 'SYSTEM' });
    expect(body.data.newsletter).toEqual({ subscribed: true, email: EMAIL });
    expect(body.data.saved).toEqual({ news: 4, articles: 1 });
  });

  it('should never carry a shared cache header — the answer is per user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/account',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('should return 404 when the session points at a user that no longer exists', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/account',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('should read the default preferences without creating a row', async () => {
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/account/preferences',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      data: { categories: [], theme: 'SYSTEM' },
    });
    expect(prisma.userPreference.upsert).not.toHaveBeenCalled();
  });

  it('should not wipe the categories when only the theme is sent', async () => {
    vi.mocked(prisma.userPreference.upsert).mockResolvedValue({
      categories: ['WORLD'],
      theme: 'DARK',
    } as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'PUT',
      url: '/api/account/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { theme: 'DARK' },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { theme: 'DARK' } }),
    );
    expect(JSON.parse(res.body)).toEqual({
      data: { categories: ['WORLD'], theme: 'DARK' },
    });
  });

  it('should reject a body with nothing to update', async () => {
    const token = await signUserToken();

    const res = await app.inject({
      method: 'PUT',
      url: '/api/account/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(prisma.userPreference.upsert).not.toHaveBeenCalled();
  });

  it('should reject a category the enum does not know', async () => {
    const token = await signUserToken();

    const res = await app.inject({
      method: 'PUT',
      url: '/api/account/preferences',
      headers: { authorization: `Bearer ${token}` },
      payload: { categories: ['GOSSIP'] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should subscribe the account, carrying the link along', async () => {
    vi.mocked(prisma.subscriber.create).mockResolvedValue(makeSubscriber() as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'PUT',
      url: '/api/account/newsletter',
      headers: { authorization: `Bearer ${token}` },
      payload: { subscribed: true },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      data: { subscribed: true, email: EMAIL },
    });
    expect(prisma.subscriber.create).toHaveBeenCalledWith({
      data: { email: EMAIL, userId: USER_ID },
    });
  });

  it('should claim a subscription made before the account existed', async () => {
    // Inscrição antiga: mesmo e-mail, sem dono. A leitura amarra o userId.
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(
      makeSubscriber({ userId: null }) as never,
    );
    vi.mocked(prisma.subscriber.update).mockResolvedValue(makeSubscriber() as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as never);
    const token = await signUserToken();

    const res = await app.inject({
      method: 'GET',
      url: '/api/account',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.subscriber.update).toHaveBeenCalledWith({
      where: { id: 'aaaaaaaa-0000-0000-0000-000000000001' },
      data: { userId: USER_ID },
    });
  });

  it('should unsubscribe from the account screen, without a token in an e-mail', async () => {
    vi.mocked(prisma.subscriber.findFirst)
      .mockResolvedValueOnce(makeSubscriber() as never)
      .mockResolvedValueOnce(
        makeSubscriber({ status: 'UNSUBSCRIBED' }) as never,
      );
    vi.mocked(prisma.subscriber.update).mockResolvedValue(
      makeSubscriber({ status: 'UNSUBSCRIBED' }) as never,
    );
    const token = await signUserToken();

    const res = await app.inject({
      method: 'PUT',
      url: '/api/account/newsletter',
      headers: { authorization: `Bearer ${token}` },
      payload: { subscribed: false },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      data: { subscribed: false, email: EMAIL },
    });
  });

  it('should report no subscription for someone who never subscribed', async () => {
    const token = await signUserToken();

    const res = await app.inject({
      method: 'PUT',
      url: '/api/account/newsletter',
      headers: { authorization: `Bearer ${token}` },
      payload: { subscribed: false },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      data: { subscribed: false, email: null },
    });
    expect(prisma.subscriber.update).not.toHaveBeenCalled();
  });
});
