import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';

describe('GET /api/news', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // TODO: Implement tests
  it.todo('should return a list of news with pagination');
  it.todo('should filter by category');
  it.todo('should return 400 for invalid category');
});
