import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';

describe('POST /api/jobs/daily-pipeline', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // TODO: Implement tests
  it.todo('should require authorization header');
  it.todo('should reject invalid token');
  it.todo('should trigger pipeline with valid token');
});
