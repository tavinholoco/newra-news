import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { AppError, NotFoundError } from '../../src/utils/errors';

/**
 * **A fiação da §7 — o handler global, o `setNotFoundHandler`, e o `catch` do
 * `authPlugin`.**
 *
 * O `error-taxonomy.test.ts` prova que cada erro sabe dizer o que é e em que
 * nível quer ser escrito. Nada ali prova que **alguém escreve**: trocar o corpo
 * do handler por um `return reply.status(...).send(...)` mudo deixaria aquele
 * arquivo inteiro verde e reabriria o buraco que esta fase existe para fechar.
 * É a armadilha 28 do §17 — guarda sobre a peça pede a segunda asserção sobre
 * quem a liga.
 *
 * A montagem lê o log de verdade: um pino em `trace` escrevendo num vetor, no
 * lugar do `baseLogger`, com o serializer real. O Fastify dá a cada requisição
 * um `child()` dele, então o que este arquivo mede é exatamente o caminho de
 * produção — nível, campos e redação.
 */

const captured = vi.hoisted(() => {
  const lines: Array<Record<string, unknown>> = [];
  return {
    lines,
    stream: {
      write(chunk: string) {
        lines.push(JSON.parse(chunk) as Record<string, unknown>);
      },
    },
  };
});

vi.mock('../../src/utils/logger', async () => {
  const actual =
    await vi.importActual<typeof import('../../src/utils/logger')>('../../src/utils/logger');
  const { default: pino } = await import('pino');

  return {
    ...actual,
    baseLogger: pino(
      {
        level: 'trace',
        serializers: { err: actual.redactingErrSerializer },
        mixin: actual.pipelineLogMixin,
      },
      captured.stream,
    ),
  };
});

// O `env` é lido na carga do módulo. Sem `AUTH_JWT_SECRET`, `verifyAuthJwt`
// recusaria todo token por 'auth não configurada' e o teste do token inválido
// passaria pelo motivo errado — a armadilha que o `CLAUDE.md` registra desde a
// Fase 9.
vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    HOST: '0.0.0.0',
    PORT: 3001,
    CORS_ORIGIN: 'https://newra-news-web.vercel.app',
    AUTH_JWT_SECRET: 'test-auth-jwt-secret',
    JOB_SECRET: 'test-job-secret',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    SITE_URL: 'http://localhost:3000',
    ADMIN_EMAILS: '',
  },
}));

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

const LEVELS: Record<number, string> = { 20: 'debug', 30: 'info', 40: 'warn', 50: 'error' };

/** As linhas que o handler escreveu, sem a linha de acesso do `onResponse`. */
function appErrorLines(): Array<Record<string, unknown>> {
  return captured.lines.filter((line) => line.msg !== 'request completed');
}

function levelOf(line: Record<string, unknown> | undefined): string | undefined {
  return line === undefined ? undefined : LEVELS[line.level as number];
}

let app: FastifyInstance;

beforeAll(async () => {
  const { buildApp } = await import('../../src/app');
  app = await buildApp();

  app.get('/probe/app-error-500', async () => {
    throw new AppError('the archive did not answer', 500, {
      category: 'database',
      cause: new Error('connect ECONNREFUSED postgres://user:hunter2@db:5432'),
      context: { stage: 'renormalize', attempt: 3 },
    });
  });
  app.get('/probe/not-found', async () => {
    throw new NotFoundError('News');
  });
  app.get('/probe/forbidden', async () => {
    const { requireAdmin } = await import('../../src/plugins/auth');
    requireAdmin({ user: { role: 'USER' } } as never);
  });
  app.get('/probe/raw-500', async () => {
    throw new Error('connect ECONNREFUSED postgres://user:hunter2@db:5432');
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  captured.lines.length = 0;
});

describe('§7 — o handler global tem quatro ramos, e três deles são novos', () => {
  it('logs an AppError of 500 — o buraco que a fase fecha', async () => {
    const res = await app.inject({ method: 'GET', url: '/probe/app-error-500' });
    const [line] = appErrorLines();

    expect(res.statusCode).toBe(500);
    expect(levelOf(line)).toBe('error');
    expect((line?.err as { code?: string } | undefined)?.code).toBe('INTERNAL');
    expect((line?.err as { category?: string } | undefined)?.category).toBe('database');
    // O padrão da rota, nunca a URL crua: é o campo que a Fase 4 usa, e ali
    // cardinalidade é tamanho de tabela.
    expect(line?.route).toBe('/probe/app-error-500');
  });

  it('sends a 404 to debug, and still answers 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/probe/not-found' });
    const [line] = appErrorLines();

    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toBe('News not found');
    expect(levelOf(line)).toBe('debug');
    expect((line?.err as { code?: string } | undefined)?.code).toBe('NOT_FOUND');
  });

  it('sends an authorization denial to warn', async () => {
    const res = await app.inject({ method: 'GET', url: '/probe/forbidden' });
    const [line] = appErrorLines();

    expect(res.statusCode).toBe(403);
    expect(levelOf(line)).toBe('warn');
    expect((line?.err as { code?: string } | undefined)?.code).toBe('ADMIN_REQUIRED');
  });

  it('keeps the 9.S rule for an error the server did not choose', async () => {
    const res = await app.inject({ method: 'GET', url: '/probe/raw-500' });
    const [line] = appErrorLines();
    const body = res.json<{ error: string; requestId?: string }>();

    expect(res.statusCode).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(body.requestId).toBeTruthy();
    expect(res.payload).not.toContain('hunter2');
    expect(levelOf(line)).toBe('error');
  });
});

describe('§7 — o que o handler escreve passa pelo redator', () => {
  it('redacts the DSN password carried by the cause, and keeps the diagnosis', async () => {
    await app.inject({ method: 'GET', url: '/probe/app-error-500' });
    const [line] = appErrorLines();
    const err = line?.err as { cause?: { name?: string; message?: string } } | undefined;

    // O `cause` é onde o diagnóstico mora — o undici lança `fetch failed` e o
    // `ECONNREFUSED` está só ali dentro (achado da Fase 7a). Serializá-lo sem
    // redigir seria devolver o vazamento que a Fase 1 fechou.
    expect(err?.cause?.message).toContain('ECONNREFUSED');
    expect(JSON.stringify(line)).not.toContain('hunter2');
  });

  it('carries the context, scrubbed and flat', async () => {
    await app.inject({ method: 'GET', url: '/probe/app-error-500' });
    const [line] = appErrorLines();
    const err = line?.err as { context?: Record<string, unknown> } | undefined;

    expect(err?.context).toEqual({ stage: 'renormalize', attempt: 3 });
  });
});

describe('§7 — o caminho não registrado responde o contrato do projeto', () => {
  /**
   * O padrão do Fastify devolvia
   * `{"message":"Route GET:/api/nao-existe not found","error":"Not Found","statusCode":404}`
   * — três campos onde a `docs/api.md` promete um, e o caminho pedido ecoado de
   * volta no corpo.
   */
  it('answers a single-field body, and does not echo the path', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    const body = res.json<Record<string, unknown>>();

    expect(res.statusCode).toBe(404);
    expect(Object.keys(body)).toEqual(['error']);
    expect(res.payload).not.toContain('nao-existe');
  });

  it('does not drown the signal — a probing bot is not a warning', async () => {
    await app.inject({ method: 'GET', url: '/api/nao-existe' });

    expect(levelOf(appErrorLines()[0])).toBe('debug');
  });
});

describe('§7 — o `catch` do authPlugin deixa de engolir', () => {
  /**
   * O `preHandler` do `authPlugin` recusava com `catch { return reply.status(401) }`:
   * a mesma família dos quatro `catch` vazios que a Fase 7a fechou no BFF, e o
   * pior deles, porque `AUTH_JWT_SECRET` ausente faz **todo** token ser
   * recusado com a mesma frase — indistinguível de um token expirado, e sem uma
   * linha em lugar nenhum. Esta variável já falhou em silêncio em produção.
   */
  it('writes a line when a token is refused, without changing the answer', async () => {
    const token = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('outro-segredo'));

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites/ids',
      headers: { authorization: `Bearer ${token}` },
    });
    const [line] = appErrorLines();

    expect(res.statusCode).toBe(401);
    expect(res.json<{ error: string }>().error).toBe('Invalid or missing token');
    expect(levelOf(line)).toBe('warn');
    expect((line?.err as { code?: string } | undefined)?.code).toBe('AUTH_TOKEN_INVALID');
    // O `preHandler` roda **depois** do roteamento, então `routeOptions` já
    // está preenchido ali. É afirmação sobre a ordem de hooks do Fastify, e
    // afirmação dessas se mede: sem ela, a linha diria `unmatched` para uma
    // rota que casou, e nada acusaria.
    expect(line?.route).toBe('/api/favorites/ids');
  });

  /**
   * **Token válido, identidade errada — e isso não é "token inválido".**
   *
   * `POST /api/auth/upsert` é a **única** rota que cria usuário. O `purpose` já
   * passou pelo plugin e a assinatura confere; o que falha aqui é o token de
   * uma pessoa sendo usado para criar a conta de outra. Sob o mesmo `code` de
   * um token expirado, o evento mais sensível da API ficaria enterrado no
   * balde de maior volume do sistema — que é a versão por `code` do que a
   * regra de nível evita por `level`.
   */
  it('separates a valid token used for another identity', async () => {
    const token = await new SignJWT({
      sub: 'user-1',
      email: 'reader@test.com',
      purpose: 'auth-upsert',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('test-auth-jwt-secret'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/upsert',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'outra-pessoa@test.com', name: 'Outra' },
    });
    const [line] = appErrorLines();

    expect(res.statusCode).toBe(401);
    expect(levelOf(line)).toBe('warn');
    expect((line?.err as { code?: string } | undefined)?.code).toBe(
      'AUTH_SUBJECT_MISMATCH',
    );
  });

  /**
   * **Sessão assinada por nós que não serve para nada, e é defeito nosso.**
   *
   * Chegar aqui exige ter passado pela verificação de assinatura, e quem assina
   * é o BFF — forjar exigiria o `AUTH_JWT_SECRET`. Então um token sem `sub` ou
   * sem `email` significa que **nós** emitimos uma sessão inutilizável (o
   * `api-proxy.ts` assina `email: session.user.email ?? ''`), e o leitor fica
   * logado com toda rota de conta respondendo 401. Categoria `internal`, e por
   * isso `error`.
   */
  it('separates a session we signed ourselves that carries no subject', async () => {
    const token = await new SignJWT({ email: 'reader@test.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('test-auth-jwt-secret'));

    const res = await app.inject({
      method: 'GET',
      url: '/api/favorites/ids',
      headers: { authorization: `Bearer ${token}` },
    });
    const [line] = appErrorLines();

    expect(res.statusCode).toBe(401);
    expect((line?.err as { code?: string } | undefined)?.code).toBe(
      'AUTH_SESSION_INCOMPLETE',
    );
    expect(levelOf(line)).toBe('error');
  });

  it('refuses a request with no Authorization header, and says so', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/favorites/ids' });
    const [line] = appErrorLines();

    expect(res.statusCode).toBe(401);
    expect(levelOf(line)).toBe('warn');
    expect((line?.err as { code?: string } | undefined)?.code).toBe('AUTH_TOKEN_INVALID');
    // Recusa sem exceção não inventa um `cause` vazio — o campo só existe
    // quando houve um erro de baixo.
    expect(line?.err).not.toHaveProperty('cause');
  });
});

describe('§7 — o formulário de senha do painel dev deixa rastro', () => {
  /**
   * **`authn_fail` é o evento canônico do vocabulário de log do OWASP** que o
   * §3.2 deste plano cita, e o `POST /dev/dashboard/session` — **o único
   * formulário de senha do produto**, alcançável de fora — não escrevia nada.
   * Ele responde **303**, então nem a linha de acesso do `observability.ts`
   * ajudava: 303 < 400, e saía em `info` junto do tráfego normal. Alguém
   * tentando adivinhar o `JOB_SECRET` produzia uma sequência de "request
   * completed" e mais nada.
   */
  it('logs a failed secret, and still answers 303 so the reload does not resend it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/dev/dashboard/session',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'secret=chute-errado',
    });
    const [line] = appErrorLines();

    // O contrato da resposta não muda: 303 e a página de erro, como antes.
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe('/dev/dashboard?failed=1');
    expect(levelOf(line)).toBe('warn');
    expect((line?.err as { code?: string } | undefined)?.code).toBe(
      'DASHBOARD_SECRET_INVALID',
    );
  });

  it('never lets the attempted secret reach the log', async () => {
    await app.inject({
      method: 'POST',
      url: '/dev/dashboard/session',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'secret=chute-errado',
    });

    // Registrar a tentativa **não** é registrar o que foi tentado: um palpite
    // errado de hoje é a senha certa de outro sistema.
    expect(JSON.stringify(appErrorLines())).not.toContain('chute-errado');
  });

  it('says nothing when the form is simply opened without a credential', async () => {
    // Abrir a página sem cookie é o caminho **normal** — é assim que se chega
    // ao formulário. Uma linha por visita ensinaria a ignorar o log.
    const res = await app.inject({ method: 'GET', url: '/dev/dashboard' });

    expect(res.statusCode).toBe(401);
    expect(appErrorLines()).toEqual([]);
  });

  it('logs the bearer door of the panel when a credential is presented and rejected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/dev/dashboard',
      headers: { authorization: 'Bearer segredo-errado' },
    });
    const [line] = appErrorLines();

    expect(res.statusCode).toBe(401);
    expect((line?.err as { code?: string } | undefined)?.code).toBe('JOB_SECRET_INVALID');
    expect(levelOf(line)).toBe('warn');
  });
});
