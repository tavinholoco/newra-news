import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { buildTestApp } from '../helpers/test-server';
import {
  getDevLogDetail,
  getDevLogs,
} from '../../src/services/pipeline-event.service';

/**
 * **Fase 2 — o pipeline visível para uma sessão ADMIN.**
 *
 * O que esta suíte mede é **a porta**, porque é só isso que a fase acrescenta:
 * a consulta é a mesma de `/api/dev/logs` e o schema de resposta também. O
 * último bloco prova essa igualdade em vez de deixá-la escrita num comentário —
 * se um dia alguém duplicar o schema para a porta nova, ele cai.
 */

vi.mock('../../src/services/pipeline-event.service', () => ({
  getDevLogs: vi.fn(),
  getDevLogDetail: vi.fn(),
  extractErrorDetail: vi.fn(),
  logPipelineEvent: vi.fn(),
}));

// O `env` é lido na carga do módulo — `process.env` num `beforeAll` chegaria
// tarde, e `AUTH_JWT_SECRET` vazio faria `verifyAuthJwt` recusar **todo** token
// por 'auth não configurada'. Os testes de 401 passariam pelo motivo errado, e
// é por isso que há caminho feliz aqui provando que o harness não é vazio.
vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    AUTH_JWT_SECRET: 'admin-pipeline-secret',
    JOB_SECRET: 'test-job-secret',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    CORS_ORIGIN: 'http://localhost:3000',
    SITE_URL: 'http://localhost:3000',
    ADMIN_EMAILS: '',
  },
}));

const RUN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FAILED_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

const summary = {
  id: RUN_ID,
  status: 'SUCCESS' as const,
  newsCount: 377,
  articleId: null,
  error: null,
  errorStage: null,
  errorDetail: null,
  startedAt: '2026-09-06T11:00:00.000Z',
  completedAt: '2026-09-06T11:00:45.000Z',
  durationSeconds: 45,
  eventCount: 19,
};

const failed = {
  ...summary,
  id: FAILED_ID,
  status: 'FAILED' as const,
  error: 'Gemini API error 503: UNAVAILABLE',
  errorStage: 6,
  errorDetail: {
    message: 'Gemini API error 503: UNAVAILABLE',
    provider: 'gemini',
    statusCode: 503,
  },
  completedAt: null,
  durationSeconds: null,
};

const detail = {
  log: failed,
  events: [
    {
      id: 'cccccccc-0000-0000-0000-000000000003',
      stage: 1,
      level: 'INFO' as const,
      message: 'fetched 377 items from 45 sources',
      context: { sources: 45 },
      createdAt: '2026-09-06T11:00:05.000Z',
    },
    {
      id: 'dddddddd-0000-0000-0000-000000000004',
      stage: 6,
      level: 'ERROR' as const,
      message: 'Gemini API error 503: UNAVAILABLE',
      context: { provider: 'gemini', statusCode: 503 },
      createdAt: '2026-09-06T11:00:40.000Z',
    },
  ],
};

let app: FastifyInstance;

async function adminToken(role = 'ADMIN'): Promise<string> {
  return new SignJWT({ sub: 'admin-1', email: 'admin@test.com', role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode('admin-pipeline-secret'));
}

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.mocked(getDevLogs).mockReset();
  vi.mocked(getDevLogDetail).mockReset();
  vi.mocked(getDevLogs).mockResolvedValue({
    runs: [summary, failed],
    recentErrors: [failed],
    total: 2,
  });
  vi.mocked(getDevLogDetail).mockResolvedValue(detail);
});

describe('GET /api/admin/pipeline/runs', () => {
  it('answers 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/pipeline/runs' });

    expect(res.statusCode).toBe(401);
    expect(getDevLogs).not.toHaveBeenCalled();
  });

  it('answers 403 for a session without the ADMIN role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/pipeline/runs',
      headers: { authorization: `Bearer ${await adminToken('USER')}` },
    });

    expect(res.statusCode).toBe(403);
    expect(getDevLogs).not.toHaveBeenCalled();
  });

  it('answers 401 for the job secret — this door is a session, not a secret', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/pipeline/runs',
      headers: { authorization: 'Bearer test-job-secret' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns runs, recent errors and the total for an admin session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/pipeline/runs',
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meta.total).toBe(2);
    expect(body.data.runs).toHaveLength(2);
    expect(body.data.runs[0]).toEqual(
      expect.objectContaining({ id: RUN_ID, status: 'SUCCESS', durationSeconds: 45 }),
    );
    expect(body.data.recentErrors).toHaveLength(1);
    expect(body.data.recentErrors[0].errorStage).toBe(6);
  });

  it('forwards status, since and limit', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/admin/pipeline/runs?status=FAILED&since=7&limit=10',
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(getDevLogs).toHaveBeenCalledWith({
      status: 'FAILED',
      sinceDays: 7,
      limit: 10,
    });
  });

  it('rejects a since outside the 1-90 window', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/pipeline/runs?since=365',
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('keeps errorDetail in the response — the message is the reason to open this', async () => {
    // O schema é o contrato: campo que o serviço carrega e o schema não declara
    // é buscado e descartado na serialização, sem erro nenhum. Aqui o campo é
    // justamente o que responde "o que o erro dizia".
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/pipeline/runs',
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(JSON.parse(res.body).data.recentErrors[0].errorDetail).toEqual({
      message: 'Gemini API error 503: UNAVAILABLE',
      provider: 'gemini',
      statusCode: 503,
    });
  });
});

describe('GET /api/admin/pipeline/runs/:pipelineId', () => {
  it('answers 401 without a token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/pipeline/runs/${RUN_ID}`,
    });

    expect(res.statusCode).toBe(401);
    expect(getDevLogDetail).not.toHaveBeenCalled();
  });

  it('answers 403 for a session without the ADMIN role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/pipeline/runs/${RUN_ID}`,
      headers: { authorization: `Bearer ${await adminToken('USER')}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns the run with its per-stage events', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/pipeline/runs/${FAILED_ID}`,
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(getDevLogDetail).toHaveBeenCalledWith(FAILED_ID);
    expect(body.data.log.id).toBe(FAILED_ID);
    expect(body.data.events).toHaveLength(2);
    expect(body.data.events[1]).toEqual(
      expect.objectContaining({ stage: 6, level: 'ERROR' }),
    );
  });

  it('answers 404 for a run that does not exist', async () => {
    vi.mocked(getDevLogDetail).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/pipeline/runs/${RUN_ID}`,
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('answers 400 for an id outside the UUID format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/pipeline/runs/not-a-uuid',
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('as duas portas devolvem exatamente a mesma coisa', () => {
  /**
   * **As asserções que sustentam "zero consulta nova".**
   *
   * A fase inteira se apoia em reusar `getDevLogs` verbatim e servir o mesmo
   * schema pelas duas portas. Escrito só em comentário, isso dura até alguém
   * achar mais fácil duplicar o schema do que importar o existente — e aí os
   * dois divergem no primeiro campo acrescentado de um lado. Comparar os corpos
   * transforma a intenção em algo que reprova.
   */
  it('serializes the same body for /api/dev/logs and /api/admin/pipeline/runs', async () => {
    const viaSecret = await app.inject({
      method: 'GET',
      url: '/api/dev/logs',
      headers: { authorization: 'Bearer test-job-secret' },
    });
    const viaSession = await app.inject({
      method: 'GET',
      url: '/api/admin/pipeline/runs',
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(viaSecret.statusCode).toBe(200);
    expect(viaSession.statusCode).toBe(200);
    expect(JSON.parse(viaSession.body)).toEqual(JSON.parse(viaSecret.body));
  });

  it('serializes the same detail body through both doors', async () => {
    const viaSecret = await app.inject({
      method: 'GET',
      url: `/api/dev/logs/${FAILED_ID}`,
      headers: { authorization: 'Bearer test-job-secret' },
    });
    const viaSession = await app.inject({
      method: 'GET',
      url: `/api/admin/pipeline/runs/${FAILED_ID}`,
      headers: { authorization: `Bearer ${await adminToken()}` },
    });

    expect(viaSecret.statusCode).toBe(200);
    expect(viaSession.statusCode).toBe(200);
    expect(JSON.parse(viaSession.body)).toEqual(JSON.parse(viaSecret.body));
  });
});
