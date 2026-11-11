import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../helpers/test-server';

/**
 * `GET /api/health/hours` — P7 do plano de ação de 11/11/2026. Pública, só
 * leitura, e é o que o Heartbeat pergunta para mandar o e-mail das horas.
 */
vi.mock('../../../src/services/uptime.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/uptime.service')>()),
  getUptimeReading: vi.fn().mockResolvedValue({
    yesterday: { date: '2026-11-10', seconds: 86_040 },
    month: { start: '2026-11-01', seconds: 808_560 },
    checkedAt: '2026-11-11T17:02:11.000Z',
  }),
}));

describe('GET /api/health/hours', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers without a token, with the raw reading under data', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health/hours' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        yesterday: { date: '2026-11-10', seconds: 86_040 },
        month: { start: '2026-11-01', seconds: 808_560 },
        checkedAt: '2026-11-11T17:02:11.000Z',
      },
    });
  });

  it('has its own ceiling of 10 a minute — it goes to the database', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health/hours',
      headers: { 'x-forwarded-for': '203.0.113.77' },
    });

    expect(response.headers['x-ratelimit-limit']).toBe('10');
  });
});
