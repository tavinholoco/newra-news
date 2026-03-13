import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';

describe('Plugins', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should set CORS headers on requests', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/docs',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should set security headers via helmet', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
  });

  it('should expose swagger UI at /api/docs', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/docs' });
    expect(response.statusCode).toBe(200);
  });

  it('should expose OpenAPI JSON at /api/docs/json', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.info.title).toBe('Newra News API');
  });

  it('should include rate limit headers in responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
  });
});
