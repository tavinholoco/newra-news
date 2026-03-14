import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'fastify';

vi.mock('../../src/services/news.service', () => ({
  listNews: vi.fn().mockResolvedValue({ data: [], total: 0 }),
}));

describe('GET /api/news', () => {
  let app: FastifyInstance;
  let response: LightMyRequestResponse;

  beforeAll(async () => {
    app = await buildTestApp();
    response = await app.inject({ method: 'GET', url: '/api/news' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200', () => {
    expect(response.statusCode).toBe(200);
  });

  it('should return data array and meta object', () => {
    const body = JSON.parse(response.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
  });

  it('should use default pagination (page=1, limit=20)', () => {
    const body = JSON.parse(response.body);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(20);
  });

  it('should return correct meta shape', () => {
    const body = JSON.parse(response.body);
    expect(body.meta.total).toBeTypeOf('number');
    expect(body.meta.totalPages).toBeTypeOf('number');
  });

  it('should accept custom pagination params', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?page=2&limit=5' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meta.page).toBe(2);
    expect(body.meta.limit).toBe(5);
  });

  it('should filter by valid category', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?category=TECHNOLOGY' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('should return 400 for invalid category value', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?category=INVALID' });
    expect(res.statusCode).toBe(400);
  });

  it('should be documented in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body);
    expect(spec.paths['/api/news/']).toBeDefined();
  });

  it('should include rate limit headers', () => {
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
  });
});
