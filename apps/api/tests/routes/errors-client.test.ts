import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  CLIENT_ERROR_DIGEST_MAX_LENGTH,
  CLIENT_ERROR_MESSAGE_MAX_LENGTH,
} from '@newranews/types';
import { buildTestApp } from '../helpers/test-server';
import { recordClientError } from '../../src/services/client-error.service';

vi.mock('../../src/services/client-error.service', () => ({
  recordClientError: vi.fn(),
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

const recordMock = vi.mocked(recordClientError);

const REPORT = {
  message: "Cannot read properties of undefined (reading 'title')",
  digest: '1234567890',
  path: '/pt-BR/news/3f2a9c1e-7b4d-4e8a-9c2b-1d5e6f7a8b9c',
};

/**
 * Cada chamada sai de um endereço próprio, porque **o balde de 10/min é real
 * no `inject`** — a primeira versão desta suíte esbarrou nele na décima
 * primeira requisição, com todo o resto certo. O que se mede aqui é a forma
 * do corpo; o balde tem o próprio teste em `client-error-ingest.test.ts`.
 * `trustProxy: 1` faz o `x-forwarded-for` valer como o IP do cliente.
 */
let address = 0;
function post(app: FastifyInstance, payload: unknown, headers: Record<string, string> = {}) {
  address += 1;
  return app.inject({
    method: 'POST',
    url: '/api/errors/client',
    payload,
    headers: { 'x-forwarded-for': `10.7.${Math.floor(address / 256)}.${address % 256}`, ...headers },
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
});

describe('POST /api/errors/client', () => {
  it('accepts a report and answers 202 — the line exists after the flush, not now', async () => {
    const res = await post(app, REPORT);

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ data: { accepted: true } });
    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  it('hands the service the parsed report and the id of this request', async () => {
    // O `requestId` é o da ingestão, não o da requisição que falhou: é o que
    // liga a linha do `ErrorEvent` à linha de acesso deste POST no log.
    const res = await post(app, REPORT, { 'x-request-id': 'req-do-relato' });

    expect(res.statusCode).toBe(202);
    expect(recordMock).toHaveBeenCalledWith(REPORT, 'req-do-relato');
  });

  it('accepts a report without digest — a crash in the browser has none', async () => {
    const { digest: _digest, ...withoutDigest } = REPORT;
    const res = await post(app, withoutDigest);

    expect(res.statusCode).toBe(202);
    expect(recordMock).toHaveBeenCalledWith(withoutDigest, expect.any(String));
  });

  it('does not set Cache-Control — the response is about the request, not a resource', async () => {
    const res = await post(app, REPORT);
    expect(res.headers['cache-control']).toBeUndefined();
  });

  describe('the strict shape — 400 and nothing recorded', () => {
    it.each([
      ['empty message', { ...REPORT, message: '' }],
      ['message above the ceiling', { ...REPORT, message: 'x'.repeat(CLIENT_ERROR_MESSAGE_MAX_LENGTH + 1) }],
      ['digest above the ceiling', { ...REPORT, digest: 'd'.repeat(CLIENT_ERROR_DIGEST_MAX_LENGTH + 1) }],
      ['empty digest', { ...REPORT, digest: '' }],
      ['path with a query string', { ...REPORT, path: '/pt-BR/news?search=meu+cpf' }],
      ['path with a fragment', { ...REPORT, path: '/pt-BR/news#topo' }],
      ['path without the leading slash', { ...REPORT, path: 'pt-BR/news' }],
      ['path above the ceiling', { ...REPORT, path: '/' + 'a'.repeat(512) }],
      ['missing path', { message: REPORT.message }],
      ['missing message', { path: REPORT.path }],
    ])('rejects %s', async (_label, payload) => {
      const res = await post(app, payload);

      expect(res.statusCode).toBe(400);
      expect(recordMock).not.toHaveBeenCalled();
    });

    it('accepts a message exactly at the ceiling, so the ceiling above means something', async () => {
      const res = await post(app, { ...REPORT, message: 'x'.repeat(CLIENT_ERROR_MESSAGE_MAX_LENGTH) });
      expect(res.statusCode).toBe(202);
    });

    it('drops a field the schema does not declare instead of refusing the report', async () => {
      // Um stack minificado "para ajudar" não é recusa nem entrada: `z.object`
      // o **descarta**, e o relato entra sem ele. O mesmo mecanismo é o que
      // mantém a rota anônima — ver `client-error-ingest.test.ts`.
      const res = await post(app, { ...REPORT, stack: 'at render (app.js:1:1)' });

      expect(res.statusCode).toBe(202);
      expect(recordMock).toHaveBeenCalledWith(REPORT, expect.any(String));
    });
  });
});
