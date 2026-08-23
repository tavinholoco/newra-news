import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { buildTestApp } from '../helpers/test-server';
import { CORS_METHODS } from '../../src/plugins/cors';

/**
 * As guardas do eixo 9.S.
 *
 * **Nenhuma delas conserta nada** — cada uma existe para que um achado da
 * revisão da Fase 9 não volte em silêncio. É a diferença entre auditoria (que
 * acontece uma vez) e guarda (que roda em todo PR); o modelo é o
 * `runtime-deps.test.ts`, e a regra da §28 é que achado de segurança sai da
 * fase com o teste que o mantém fechado.
 *
 * Cada `describe` abaixo nomeia o achado que ele tranca.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: {
      news: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    },
  };
});

const JWT_SECRET = 'test-auth-jwt-secret';

async function signToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

let app: FastifyInstance;

beforeAll(async () => {
  process.env.AUTH_JWT_SECRET = JWT_SECRET;
  process.env.CORS_ORIGIN = 'https://newra-news-web.vercel.app';
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('9.S — o balde de rate limit é por cliente, não um só para a internet', () => {
  /**
   * **O achado, medido em produção em 23/08/2026.** Três requisições com
   * `X-Forwarded-For` diferentes na mesma janela de 60s devolveram
   * `x-ratelimit-remaining` 98, 97 e 96 — um contador só. Sem `trustProxy`, o
   * Fastify usa o peer do socket como `request.ip`, e atrás do proxy do Render
   * o peer é o proxy.
   *
   * A consequência era silenciosa: todo o tráfego server-side sai da Vercel, e
   * a ingestão de eventos passa pela rota `/api/events` do Next — com balde
   * único, o teto de 30/min daquela rota vira **teto global de ingestão**, e a
   * tela de métricas da Fase 8 subconta sem sinal nenhum (429 num `sendBeacon`
   * não tem retorno que o cliente leia).
   */
  it('gives two clients behind the proxy independent buckets', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-forwarded-for': '203.0.113.10' },
      remoteAddress: '10.0.0.1',
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-forwarded-for': '203.0.113.20' },
      remoteAddress: '10.0.0.1',
    });

    // Mesmo peer de socket (o proxy), clientes diferentes: dois baldes.
    expect(second.headers['x-ratelimit-remaining']).toBe(
      first.headers['x-ratelimit-remaining'],
    );
  });

  it('keeps one bucket for one client across requests', async () => {
    const client = '203.0.113.30';
    const first = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-forwarded-for': client },
      remoteAddress: '10.0.0.1',
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-forwarded-for': client },
      remoteAddress: '10.0.0.1',
    });

    expect(Number(second.headers['x-ratelimit-remaining'])).toBe(
      Number(first.headers['x-ratelimit-remaining']) - 1,
    );
  });

  it('ignores a client-forged X-Forwarded-For beyond the trusted hop', async () => {
    // `trustProxy: 1` e não `true`: com `true`, o Fastify confiaria na ponta
    // esquerda da cadeia — escrita pelo cliente —, e escapar do limite seria
    // mandar um IP novo por requisição.
    const forged = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.40' },
      remoteAddress: '10.0.0.1',
    });
    const real = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-forwarded-for': '198.51.100.99, 203.0.113.40' },
      remoteAddress: '10.0.0.1',
    });

    // O IP forjado à esquerda muda; o balde é o mesmo, porque quem conta é o
    // último hop.
    expect(Number(real.headers['x-ratelimit-remaining'])).toBe(
      Number(forged.headers['x-ratelimit-remaining']) - 1,
    );
  });
});

describe('9.S — o CORS declara os métodos que existem', () => {
  /**
   * O achado: `methods: ['GET', 'POST']`, com 2 PUT e 2 DELETE registrados.
   * Funcionava porque toda mutação passa pelo BFF do Next, server-side, onde
   * CORS não se aplica — uma dependência não declarada entre as duas metades.
   */
  it('answers the preflight of a DELETE that exists', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/favorites/NEWS/abc',
      headers: {
        origin: 'https://newra-news-web.vercel.app',
        'access-control-request-method': 'DELETE',
      },
    });

    expect(res.statusCode).toBeLessThan(400);
    expect(String(res.headers['access-control-allow-methods'])).toContain('DELETE');
  });

  it('declares every method the router actually registers', () => {
    const registered = new Set<string>();
    for (const line of app.printRoutes({ commonPrefix: false }).split('\n')) {
      for (const method of line.matchAll(/\b(GET|POST|PUT|DELETE|PATCH)\b/g)) {
        registered.add(method[1] as string);
      }
    }

    for (const method of registered) {
      expect(CORS_METHODS).toContain(method);
    }
  });
});

describe('9.S — a CSP existe (era `contentSecurityPolicy: false`)', () => {
  it('sends a default-src none policy on JSON routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const csp = String(res.headers['content-security-policy']);

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  it('keeps the rest of the helmet set', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

describe('9.S — o `purpose` do JWT escopa, e escopa nos dois sentidos', () => {
  /**
   * O achado: o `purpose` era conferido **dentro do handler** do
   * `/api/auth/upsert` e ignorado em todas as outras rotas. O token de
   * `auth-upsert` — que existe para uma chamada só, no primeiro sign-in —
   * passava no `/api/favorites` exatamente como um token de sessão. Não havia
   * exploração (quem assina os dois é o mesmo servidor), mas escopo conferido
   * num lugar só é convenção, não guarda.
   */
  it('rejects an auth-upsert token on a session route', async () => {
    const token = await signToken({
      sub: 'user-1',
      email: 'reader@test.com',
      purpose: 'auth-upsert',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites/ids',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects a session token on the auth-upsert route', async () => {
    const token = await signToken({ sub: 'user-1', email: 'reader@test.com' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'reader@test.com' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects a token carrying an unknown purpose', async () => {
    const token = await signToken({
      sub: 'user-1',
      email: 'reader@test.com',
      purpose: 'something-else',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites/ids',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('9.S — o 500 não conta o interior do servidor', () => {
  /**
   * O achado: o error handler devolvia `error.message` qualquer que fosse o
   * erro. Erro de Prisma carrega nome de tabela, nome de coluna e trecho de
   * SQL; em falha de conexão, a string de conexão — tudo isso ia para quem
   * chamou, numa rota pública, e nada ia para o log.
   */
  it('replaces the internal message with a request id', async () => {
    const probe = await buildTestApp();
    probe.get('/boom', async () => {
      throw new Error('connect ECONNREFUSED postgres://user:hunter2@db:5432');
    });
    await probe.ready();

    const res = await probe.inject({ method: 'GET', url: '/boom' });
    const body = res.json<{ error: string; requestId?: string }>();

    expect(res.statusCode).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(res.payload).not.toContain('hunter2');
    expect(res.payload).not.toContain('ECONNREFUSED');
    expect(body.requestId).toBeTruthy();

    await probe.close();
  });

  it('still explains a 4xx, which describes the caller and not the server', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/news?limit=999' });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).not.toBe('Internal server error');
  });
});

describe('9.5 — toda resposta é correlacionável', () => {
  it('answers with an x-request-id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('propagates an incoming x-request-id, so the BFF hop stays traceable', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-request-id': 'from-the-bff-42' },
    });

    expect(res.headers['x-request-id']).toBe('from-the-bff-42');
  });
});
