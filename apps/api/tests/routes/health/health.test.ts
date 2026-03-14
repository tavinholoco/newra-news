import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from '../../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'fastify';

describe('GET /api/health', () => {
  let app: FastifyInstance;
  let health: LightMyRequestResponse;

  beforeAll(async () => {
    app = await buildTestApp();
    health = await app.inject({ method: 'GET', url: '/api/health' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with status ok', () => {
    expect(health.statusCode).toBe(200);
    const body = JSON.parse(health.body);
    expect(body.status).toBe('ok');
  });

  it('should return a valid ISO timestamp', () => {
    const body = JSON.parse(health.body);
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('should return a numeric uptime', () => {
    const body = JSON.parse(health.body);
    expect(body.uptime).toBeTypeOf('number');
    expect(body.uptime).toBeGreaterThan(0);
  });

  it('should be documented in OpenAPI spec', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(response.body);
    expect(spec.paths['/api/health/']).toBeDefined();
  });

  it('should include rate limit headers', () => {
    expect(health.headers['x-ratelimit-limit']).toBeDefined();
  });
});
