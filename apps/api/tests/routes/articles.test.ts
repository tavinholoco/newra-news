import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';

describe('GET /api/articles', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // TODO: Implement tests
  it.todo('should return a list of articles with pagination');
  it.todo('should return article by date');
  it.todo('should return latest article');
});
