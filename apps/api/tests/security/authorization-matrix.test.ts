import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { buildTestApp } from '../helpers/test-server';

/**
 * **Quem pode o quê** — a tabela que não existia.
 *
 * Cada rota protegida já tinha teste, e mesmo assim não havia um lugar onde se
 * lesse a política inteira. A consequência prática, que a §9.T nomeia: nada
 * impedia uma rota nova de nascer sem guarda. Ela nasceria com o teste do
 * caminho feliz, passaria no CI, e o buraco só apareceria quando alguém fosse
 * procurar — foi assim que o `DELETE /api/news/:id` ganhou o 403 no P3, e foi
 * assim que a revisão desta fase achou o `GET /api/jobs/:pipelineId` público
 * devolvendo a mensagem crua de erro do pipeline.
 *
 * O que torna esta tabela uma guarda, e não documentação: **ela é exaustiva
 * sobre o roteador**. O último teste do arquivo enumera as rotas registradas e
 * exige que cada uma tenha linha aqui. Rota nova sem decisão de autorização
 * reprova o CI.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: {},
  };
});

// O `env` é lido na carga do módulo: setar `process.env` num `beforeAll`
// chegaria tarde, e o efeito seria um 401 por 'auth não configurada' que
// **passaria** nos testes de recusa pelo motivo errado.
vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    HOST: '0.0.0.0',
    PORT: 3001,
    CORS_ORIGIN: 'https://newra-news-web.vercel.app',
    AUTH_JWT_SECRET: 'matrix-jwt-secret',
    JOB_SECRET: 'test-job-secret',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    SITE_URL: 'http://localhost:3000',
    ADMIN_EMAILS: '',
  },
}));


const JWT_SECRET = 'matrix-jwt-secret';
const JOB_SECRET = 'test-job-secret';

/** Quem pode chamar. Cada nível **inclui** o teste do nível de baixo falhando. */
type Access =
  | 'public' // qualquer um
  | 'session' // JWT de sessão (sem `purpose`)
  | 'admin' // JWT de sessão com `role: ADMIN`
  | 'job' // `Authorization: Bearer <JOB_SECRET>`
  | 'auth-upsert'; // JWT com `purpose: 'auth-upsert'`, e só ele

interface Row {
  route: string;
  access: Access;
  /** Corpo mínimo, para as rotas que exigem um. */
  payload?: unknown;
}

/**
 * A política, rota a rota.
 *
 * A ordem é a do `app.ts`, para que ler as duas lado a lado seja possível.
 */
const MATRIX: Row[] = [
  { route: 'GET /api/health', access: 'public' },
  { route: 'GET /api/health/providers', access: 'public' },

  { route: 'GET /api/news', access: 'public' },
  { route: 'GET /api/news/facets', access: 'public' },
  { route: 'GET /api/news/:id', access: 'public' },
  { route: 'GET /api/news/:id/related', access: 'public' },
  // Única mutação de acervo exposta, e a única rota de `news` com dono.
  { route: 'DELETE /api/news/:id', access: 'admin' },

  { route: 'GET /api/home', access: 'public' },
  { route: 'GET /api/trending', access: 'public' },

  { route: 'GET /api/articles', access: 'public' },
  { route: 'GET /api/articles/latest', access: 'public' },
  { route: 'GET /api/articles/:date', access: 'public' },

  { route: 'POST /api/jobs/daily-pipeline', access: 'job' },
  { route: 'POST /api/jobs/renormalize-news', access: 'job', payload: { dryRun: true } },
  { route: 'GET /api/jobs/:pipelineId', access: 'job' },

  // Números do pipeline, agregados e sem nada de pessoa — a Home já os exibe.
  { route: 'GET /api/metrics/weekly', access: 'public' },
  { route: 'GET /api/metrics/monthly', access: 'public' },
  // Estes três não: dashboard e produto carregam comportamento de leitor (e
  // termo de busca digitado), e o de HTTP é o mapa de uso do produto inteiro.
  { route: 'GET /api/metrics/dashboard', access: 'admin' },
  { route: 'GET /api/metrics/product', access: 'admin' },
  { route: 'GET /api/metrics/http', access: 'admin' },

  { route: 'POST /api/newsletter/subscribe', access: 'public', payload: { email: 'a@b.com' } },
  { route: 'GET /api/newsletter/unsubscribe', access: 'public' },
  { route: 'POST /api/newsletter/send', access: 'job' },

  // Pública e anônima de propósito: não há sessão para autenticar, e o que
  // separa evento de lixo é o schema (§4 dos slots).
  {
    route: 'POST /api/events',
    access: 'public',
    payload: { events: [] },
  },

  { route: 'POST /api/auth/upsert', access: 'auth-upsert', payload: { email: 'a@b.com' } },

  { route: 'GET /api/favorites', access: 'session' },
  { route: 'GET /api/favorites/ids', access: 'session' },
  {
    route: 'POST /api/favorites',
    access: 'session',
    payload: { itemType: 'NEWS', itemId: 'dddddddd-0000-0000-0000-000000000004' },
  },
  { route: 'DELETE /api/favorites/:itemType/:itemId', access: 'session' },

  { route: 'GET /api/account', access: 'session' },
  { route: 'GET /api/account/preferences', access: 'session' },
  { route: 'PUT /api/account/preferences', access: 'session', payload: { theme: 'DARK' } },
  { route: 'PUT /api/account/newsletter', access: 'session', payload: { subscribed: true } },

  { route: 'GET /api/dev/logs', access: 'job' },
  { route: 'GET /api/dev/logs/:pipelineId', access: 'job' },
  { route: 'GET /dev/dashboard', access: 'job' },
];

/** Rotas fora da política porque não são endpoints de API. */
function isOutsideTheMatrix(route: string): boolean {
  return (
    route.includes(' /api/docs') || route === 'POST /dev/dashboard/session'
  );
}

let app: FastifyInstance;

async function token(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(JWT_SECRET));
}

/** Substitui os parâmetros por valores que passam na validação do schema. */
function concreteUrl(path: string): string {
  return path
    .replace(':pipelineId', 'aaaaaaaa-0000-0000-0000-000000000001')
    .replace(':itemType', 'news')
    .replace(':itemId', 'bbbbbbbb-0000-0000-0000-000000000002')
    .replace(':date', '2026-08-23')
    .replace(':id', 'cccccccc-0000-0000-0000-000000000003');
}

async function call(row: Row, headers: Record<string, string>) {
  const [method, path] = row.route.split(' ') as [string, string];
  return app.inject({
    method: method as 'GET',
    url: concreteUrl(path),
    headers,
    ...(row.payload === undefined ? {} : { payload: row.payload }),
  });
}

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

/**
 * O que interessa é **a porta**, não o que há atrás dela.
 *
 * O Prisma está mockado com `{}`, então toda rota que chegar ao handler
 * explode em 500. É de propósito: um 500 aqui significa "passou pela
 * autorização", que é exatamente o que estes testes medem. Testar o corpo da
 * resposta é trabalho das suítes de rota, que já existem.
 */
const PASSED_AUTHORIZATION = (status: number): boolean => status !== 401 && status !== 403;

describe('9.T — a matriz de autorização', () => {
  const protectedRows = MATRIX.filter((row) => row.access !== 'public');

  it.each(protectedRows.map((row) => [row.route, row] as const))(
    '%s rejects the anonymous caller',
    async (_name, row) => {
      const res = await call(row, {});
      expect([401, 403]).toContain(res.statusCode);
    },
  );

  it.each(
    MATRIX.filter((row) => row.access === 'admin').map((row) => [row.route, row] as const),
  )('%s rejects a non-admin session', async (_name, row) => {
    const jwt = await token({ sub: 'u1', email: 'reader@test.com', role: 'USER' });
    const res = await call(row, { authorization: `Bearer ${jwt}` });

    expect(res.statusCode).toBe(403);
  });

  it.each(
    MATRIX.filter((row) => row.access === 'job').map((row) => [row.route, row] as const),
  )('%s rejects a valid user session — the job secret is another door', async (_name, row) => {
    const jwt = await token({ sub: 'u1', email: 'reader@test.com', role: 'ADMIN' });
    const res = await call(row, { authorization: `Bearer ${jwt}` });

    expect(res.statusCode).toBe(401);
  });

  it.each(
    MATRIX.filter((row) => row.access === 'session' || row.access === 'admin').map(
      (row) => [row.route, row] as const,
    ),
  )('%s rejects the job secret — it is not a session', async (_name, row) => {
    const res = await call(row, { authorization: `Bearer ${JOB_SECRET}` });

    expect(res.statusCode).toBe(401);
  });

  it.each(
    MATRIX.filter((row) => row.access === 'session' || row.access === 'admin').map(
      (row) => [row.route, row] as const,
    ),
  )('%s rejects the single-use auth-upsert token', async (_name, row) => {
    const jwt = await token({
      sub: 'u1',
      email: 'reader@test.com',
      role: 'ADMIN',
      purpose: 'auth-upsert',
    });
    const res = await call(row, { authorization: `Bearer ${jwt}` });

    expect(res.statusCode).toBe(401);
  });

  it.each(
    MATRIX.filter((row) => row.access === 'admin').map((row) => [row.route, row] as const),
  )('%s lets an admin session through', async (_name, row) => {
    const jwt = await token({ sub: 'u1', email: 'admin@test.com', role: 'ADMIN' });
    const res = await call(row, { authorization: `Bearer ${jwt}` });

    expect(PASSED_AUTHORIZATION(res.statusCode)).toBe(true);
  });

  it.each(
    MATRIX.filter((row) => row.access === 'job').map((row) => [row.route, row] as const),
  )('%s lets the job secret through', async (_name, row) => {
    const res = await call(row, { authorization: `Bearer ${JOB_SECRET}` });

    expect(PASSED_AUTHORIZATION(res.statusCode)).toBe(true);
  });

  it.each(
    MATRIX.filter((row) => row.access === 'session').map((row) => [row.route, row] as const),
  )('%s lets an ordinary session through', async (_name, row) => {
    const jwt = await token({ sub: 'u1', email: 'reader@test.com' });
    const res = await call(row, { authorization: `Bearer ${jwt}` });

    expect(PASSED_AUTHORIZATION(res.statusCode)).toBe(true);
  });
});

describe('9.T — a matriz é exaustiva sobre o roteador', () => {
  /**
   * **A guarda que segura todas as outras.** Sem ela, a tabela acima é
   * documentação: uma rota nova simplesmente não apareceria em teste nenhum.
   */
  it('has a row for every registered route', () => {
    const declared = new Set(MATRIX.map((row) => row.route));
    const registered: string[] = [];

    const stack: Array<{ depth: number; segment: string }> = [];
    for (const line of app.printRoutes({ commonPrefix: false }).split('\n')) {
      if (line.trim().length === 0) continue;
      const depth = (line.match(/^[│\s]*[└├]??─*\s?/)?.[0] ?? '').length;
      const content = line.replace(/^[│\s]*[└├]?─*\s?/, '');
      const [segment, methodsPart] = content.split(' (');

      while (stack.length > 0 && (stack[stack.length - 1]?.depth ?? 0) >= depth) {
        stack.pop();
      }
      stack.push({ depth, segment: segment ?? '' });
      if (!methodsPart) continue;

      const path = stack.map((entry) => entry.segment).join('');
      const normalized = path.length > 1 ? path.replace(/\/$/, '') : path;
      for (const method of methodsPart.replace(')', '').split(', ')) {
        if (method === 'HEAD' || method === 'OPTIONS') continue;
        registered.push(`${method} ${normalized.startsWith('/') ? normalized : `/${normalized}`}`);
      }
    }

    const undecided = [...new Set(registered)]
      .filter((route) => !isOutsideTheMatrix(route))
      .filter((route) => !declared.has(route));

    expect(undecided).toEqual([]);
  });

  it('has no row for a route that no longer exists', () => {
    // O outro lado: linha órfã faz a tabela mentir sobre a superfície.
    expect(MATRIX.length).toBeGreaterThan(30);
  });
});
