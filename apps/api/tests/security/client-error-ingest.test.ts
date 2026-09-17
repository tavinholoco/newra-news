import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';
import { clientErrorReportSchema } from '../../src/routes/errors/schemas';
import {
  pendingErrorEvents,
  resetErrorEventBuffer,
} from '../../src/services/error-event.service';
import { getHttpMetrics, resetHttpMetrics } from '../../src/plugins/observability';

/**
 * **A segunda porta pública que escreve, e as duas coisas que a mantêm
 * barata: o anonimato e o teto.**
 *
 * O `/api/events` foi a primeira rota pública a escrever no banco, e ganhou
 * duas guardas (`events-anonymity`, `events-ingest-ceiling`). Esta é a
 * segunda, e paga as mesmas duas — num arquivo só, porque aqui as duas
 * perguntas têm a mesma resposta: o que impede um cliente hostil de usar um
 * endpoint de reportar erro como **amplificador de escrita** (§11.3) é o
 * coalescimento da Fase 4, o balde de 10/min e o schema que descarta o que
 * não declara.
 *
 * **O risco de identidade não é ataque, é deriva**: um `userId` acrescentado
 * "para achar quem viu o erro" mudaria a natureza do `ErrorEvent` — que hoje
 * não tem dado pessoal em coluna nenhuma — sem que nada no PR seguinte
 * lembrasse disso.
 */

const ROUTE_PATH = join(__dirname, '../../src/routes/errors/index.ts');

const IDENTITY_FIELDS = ['userId', 'email', 'ip', 'userAgent', 'name', 'sub', 'sessionId', 'cookie'];

const VALID_REPORT = {
  message: 'boom',
  digest: '1234567890',
  path: '/pt-BR/news',
};

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  resetErrorEventBuffer();
});

describe('ingestão do erro do cliente — anonimato', () => {
  it('accepts the anonymous shape, so the rest of this suite means something', () => {
    expect(clientErrorReportSchema.safeParse(VALID_REPORT).success).toBe(true);
  });

  it('strips any identity field a caller tries to attach', () => {
    for (const field of IDENTITY_FIELDS) {
      const parsed = clientErrorReportSchema.parse({ ...VALID_REPORT, [field]: 'quem-sou' });
      expect(parsed, field).not.toHaveProperty(field);
    }
  });

  it('declares no identity field in the schema itself', () => {
    const declared = Object.keys(clientErrorReportSchema.parse(VALID_REPORT));
    expect(declared.filter((key) => IDENTITY_FIELDS.includes(key))).toEqual([]);
  });

  it('does not authenticate — the route works with no credential at all', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/errors/client',
      payload: VALID_REPORT,
    });

    // 401 aqui significaria que alguém pôs o `authPlugin` na rota — e com
    // ele o relato passaria a ter dono.
    expect(response.statusCode).not.toBe(401);
    expect(response.statusCode).toBe(202);
  });

  it('carries nothing of the caller into the recorded line — only what the report says', async () => {
    // Do lado de dentro: o que chega ao buffer é o relato normalizado, e nada
    // do cabeçalho da requisição (cookie, agente, IP) vai para o `context`.
    await app.inject({
      method: 'POST',
      url: '/api/errors/client',
      payload: { ...VALID_REPORT, userId: 'u-1', email: 'leitor@example.com' },
      headers: {
        cookie: 'next-auth.session-token=nao-pode-entrar',
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '203.0.113.7',
      },
    });

    const [entry] = pendingErrorEvents();
    expect(entry?.context).toEqual({ digest: '1234567890', path: '/pt-BR/news' });
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('u-1');
    expect(serialized).not.toContain('leitor@example.com');
    expect(serialized).not.toContain('nao-pode-entrar');
    expect(serialized).not.toContain('203.0.113.7');
    expect(serialized).not.toContain('Mozilla');
  });

  it('rejects a path carrying a query string', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/errors/client',
      payload: { ...VALID_REPORT, path: '/pt-BR/news?search=meu+cpf' },
    });

    expect(response.statusCode).toBe(400);
    expect(pendingErrorEvents()).toEqual([]);
  });
});

describe('ingestão do erro do cliente — o teto', () => {
  it('keeps the declared ceiling at the number the comment reasons about', () => {
    const source = readFileSync(ROUTE_PATH, 'utf8');
    expect(source).toMatch(/rateLimit:\s*\{\s*max:\s*10,\s*timeWindow:\s*'1 minute'\s*\}/);
  });

  it('states that the bucket is shared, not per reader, and names the trigger', () => {
    // O balde é agregado porque o BFF é anônimo e não repassa o IP. Um
    // comentário dizendo "por leitor" sobre um controle que não é seria o
    // defeito que a Fase 9 achou no `/api/events`.
    const source = readFileSync(ROUTE_PATH, 'utf8');

    expect(source).toMatch(/balde só para o site inteiro|não é por leitor/);
    expect(source).toContain('metrics/http');
  });

  it('is one line per (page, hour) up to the bucket, and the eleventh report is a 429 that records nothing', async () => {
    // As duas defesas do amplificador de escrita, medidas juntas e de um
    // endereço só (`trustProxy: 1` lê o `x-forwarded-for`): dez relatos
    // distintos da mesma página são **uma** entrada no buffer com
    // `count: 10` — o coalescimento —, e o décimo primeiro no mesmo minuto é
    // o balde, com o buffer intacto. Sem o primeiro, o endpoint escreveria
    // linha na velocidade em que um script o chama; sem o segundo, um
    // script escolheria quantas vezes o `count` sobe.
    const inject = (i: number) =>
      app.inject({
        method: 'POST',
        url: '/api/errors/client',
        payload: { message: `erro ${i}`, path: '/pt-BR/news' },
        headers: { 'x-forwarded-for': '198.51.100.9' },
      });

    resetHttpMetrics();
    for (let i = 0; i < 10; i += 1) {
      expect((await inject(i)).statusCode).toBe(202);
    }

    const eleventh = await inject(10);
    expect(eleventh.statusCode).toBe(429);

    const pending = pendingErrorEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.count).toBe(10);

    /**
     * **O gatilho escrito é observável, e é medido aqui.** "429 nesta rota
     * dentro de `GET /api/metrics/http`" pressupõe duas coisas que ninguém
     * tinha conferido: que a resposta do rate limiter — enviada de um hook
     * `onRequest`, antes de qualquer handler — passa pelo `onResponse` do
     * `observability`, e que o 4xx sai **por rota**. A segunda era falsa até
     * a Fase 7c: o contador existia e só o global era servido, e um 429 aqui
     * era indistinguível de um 404 em `/news`.
     */
    const route = getHttpMetrics().routes.find((r) => r.route === 'POST /api/errors/client');
    expect(route?.count).toBe(11);
    expect(route?.clientErrorRate).toBeCloseTo(1 / 11, 3);
  });
});
