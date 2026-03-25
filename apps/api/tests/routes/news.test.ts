import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'fastify';
import { getNewsById } from '../../src/services/news.service';

vi.mock('../../src/services/news.service', () => ({
  listNews: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getNewsById: vi.fn().mockResolvedValue(null),
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

describe('GET /api/news/:id', () => {
  let app: FastifyInstance;
  const VALID_UUID = 'a0000000-0000-0000-0000-000000000001';
  const mockNews = {
    id: VALID_UUID,
    title: 'Test News',
    description: 'Test description',
    content: null,
    source: 'Test Source',
    sourceUrl: 'https://example.com',
    imageUrl: null,
    category: 'TECHNOLOGY',
    publishedAt: new Date('2024-01-01T00:00:00.000Z'),
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with news data when found', async () => {
    vi.mocked(getNewsById).mockResolvedValueOnce(mockNews as never);
    const res = await app.inject({ method: 'GET', url: `/api/news/${VALID_UUID}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(VALID_UUID);
    expect(body.data.title).toBe('Test News');
  });

  it('should return ISO datetime strings for publishedAt and createdAt', async () => {
    vi.mocked(getNewsById).mockResolvedValueOnce(mockNews as never);
    const res = await app.inject({ method: 'GET', url: `/api/news/${VALID_UUID}` });
    const body = JSON.parse(res.body);
    expect(body.data.publishedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(body.data.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should return 404 when news not found', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/news/${VALID_UUID}` });
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 for invalid UUID format', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news/not-a-uuid' });
    expect(res.statusCode).toBe(400);
  });

  it('should be documented in OpenAPI spec', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body);
    expect(spec.paths['/api/news/{id}']).toBeDefined();
  });
});
