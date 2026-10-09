import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../helpers/test-server';

const SECRET = 'probe-jwt-secret';

vi.mock('../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSDATA_API_KEY: 'test-newsdata-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_API_KEY: 'test-groq-key',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
    AUTH_JWT_SECRET: 'probe-jwt-secret',
  },
}));

async function sign(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(SECRET));
}

/**
 * **A sonda do par de JWT entre a Vercel e a API** — 13.7 do plano de
 * observabilidade, 09/10/2026.
 *
 * Os fluxos com login do Smoke ficam desligados por decisão (pôr o
 * `NEXTAUTH_SECRET` de produção no CI é dar a qualquer dependência
 * comprometida uma sessão de admin). O defeito que eles pegariam — a API
 * recusar a assinatura que a Vercel faz, e todo leitor logado cair em 401 com
 * o site anônimo perfeito — é medido aqui sem segredo nenhum fora das duas
 * plataformas: a Vercel assina um token de escopo próprio e pergunta.
 */
describe('GET /api/health/auth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts the health-probe token and says so', async () => {
    const jwt = await sign({
      sub: 'health-probe',
      email: 'health-probe@newranews.invalid',
      purpose: 'health-probe',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/health/auth',
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { accepted: true } });
  });

  it('refuses a token signed with another secret — the pairing it exists to check', async () => {
    const jwt = await new SignJWT({ sub: 'health-probe', purpose: 'health-probe' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('the-vercel-has-another-secret'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/health/auth',
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('touches no table — the probe must not depend on the database', async () => {
    // O Prisma do helper de teste não tem nada; se a rota tocasse o banco,
    // explodiria em 500. A pergunta é sobre a assinatura, e só sobre ela.
    const jwt = await sign({ sub: 'health-probe', purpose: 'health-probe' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/health/auth',
      headers: { authorization: `Bearer ${jwt}` },
    });

    expect(res.statusCode).toBe(200);
  });
});
