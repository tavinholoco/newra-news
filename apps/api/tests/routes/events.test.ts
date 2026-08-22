import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';
import { ingestProductEvents } from '../../src/services/product-event.service';

vi.mock('../../src/services/product-event.service', () => ({
  ingestProductEvents: vi.fn(),
  deleteExpiredProductEvents: vi.fn(),
}));

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
  },
}));

const ingestMock = vi.mocked(ingestProductEvents);

const base = {
  sessionId: 'bbbbbbbb-0000-0000-0000-000000000001',
  locale: 'pt-BR',
  path: '/pt-BR/news',
  occurredAt: '2026-08-22T12:00:00.000Z',
};

function post(app: FastifyInstance, events: unknown[]) {
  return app.inject({
    method: 'POST',
    url: '/api/events',
    payload: { events },
  });
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  ingestMock.mockResolvedValue({ accepted: 1 });
});

describe('POST /api/events', () => {
  it('accepts a valid event and answers 201 with how many were stored', async () => {
    // 201 e não 200: a requisição criou linhas. E o corpo diz **quantas** — um
    // `{ ok: true }` não deixaria descobrir que metade do lote sumiu.
    const res = await post(app, [{ ...base, type: 'homepage_view' }]);

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ data: { accepted: 1 } });
    expect(ingestMock).toHaveBeenCalledTimes(1);
  });

  it('accepts a batch', async () => {
    ingestMock.mockResolvedValue({ accepted: 2 });

    const res = await post(app, [
      { ...base, type: 'homepage_view' },
      {
        ...base,
        type: 'story_open',
        storyId: 'story-1',
        category: 'HEALTH',
        position: 0,
        source: 'hero',
      },
    ]);

    expect(res.statusCode).toBe(201);
    expect(res.json().data.accepted).toBe(2);
  });

  it('rejects an event type outside the catalogue', async () => {
    // Não há sessão para autenticar — a §4 proíbe o identificador que serviria
    // para isso. O que separa evento de lixo é o schema.
    const res = await post(app, [{ ...base, type: 'story_deleted' }]);

    expect(res.statusCode).toBe(400);
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it('rejects a payload missing a field its own type requires', async () => {
    const res = await post(app, [
      { ...base, type: 'story_open', storyId: 'story-1', source: 'hero' },
    ]);

    expect(res.statusCode).toBe(400);
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it('rejects a source that is not in the closed vocabulary', async () => {
    const res = await post(app, [
      {
        ...base,
        type: 'story_open',
        storyId: 'story-1',
        category: 'HEALTH',
        position: 0,
        source: 'newsletter-footer-v2',
      },
    ]);

    expect(res.statusCode).toBe(400);
  });

  it('rejects a sessionId that is not a UUID', async () => {
    const res = await post(app, [
      { ...base, sessionId: 'user@example.com', type: 'homepage_view' },
    ]);

    expect(res.statusCode).toBe(400);
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it('rejects a path carrying a query string', async () => {
    // A query carrega o termo de busca, e o termo tem regra de higiene própria.
    // Deixá-lo entrar por aqui seria a mesma informação por uma porta sem
    // porteiro.
    const res = await post(app, [
      { ...base, path: '/pt-BR/news?search=meu+cpf', type: 'homepage_view' },
    ]);

    expect(res.statusCode).toBe(400);
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it('rejects a search query longer than the cap', async () => {
    const res = await post(app, [
      { ...base, type: 'search', query: 'a'.repeat(101), resultCount: 0 },
    ]);

    expect(res.statusCode).toBe(400);
  });

  it('rejects an empty batch', async () => {
    const res = await post(app, []);

    expect(res.statusCode).toBe(400);
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it('rejects a batch above the cap', async () => {
    const res = await post(
      app,
      Array.from({ length: 21 }, () => ({ ...base, type: 'homepage_view' })),
    );

    expect(res.statusCode).toBe(400);
  });

  it('does not send Cache-Control — the answer is the request, not a resource', async () => {
    const res = await post(app, [{ ...base, type: 'homepage_view' }]);

    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('accepts every ad placement and format of the inventory', async () => {
    const res = await post(app, [
      {
        ...base,
        type: 'ad_view',
        placement: 'article-in-content',
        format: 'in-article',
      },
      {
        ...base,
        type: 'ad_click',
        placement: 'home-after-hero',
        format: 'leaderboard',
      },
    ]);

    expect(res.statusCode).toBe(201);
  });
});
