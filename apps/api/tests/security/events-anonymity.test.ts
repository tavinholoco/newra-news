import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';
import { productEventSchema } from '../../src/routes/events/schemas';

/**
 * **Identidade no payload de evento reprova — a guarda que a §11.S pediu.**
 *
 * A rota de eventos é a única pública que **escreve** no banco, e ela é anônima
 * por decisão de produto, não por descuido: sem sessão, sem JWT e sem
 * identificador entre visitas. É o que sustenta o legítimo interesse da §4 em
 * vez de exigir consentimento, e é o que define o que a tabela `ProductEvent`
 * é juridicamente.
 *
 * **O risco não é ataque, é deriva.** Um `userId` acrescentado "para melhorar a
 * métrica" muda a natureza da tabela inteira, e nada no PR seguinte lembraria
 * disso. Aqui o `sessionId` — que é aleatório, vive em `sessionStorage` e morre
 * ao fechar a aba — é a única coisa parecida com um identificador, e é
 * justamente a fronteira que separa medição anônima de dado pessoal.
 */

const IDENTITY_FIELDS = ['userId', 'email', 'ip', 'userAgent', 'name', 'sub'];

const VALID_EVENT = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  locale: 'pt-BR',
  path: '/pt-BR',
  occurredAt: '2026-08-24T12:00:00.000Z',
  type: 'homepage_view' as const,
};

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('ingestão de eventos — anonimato', () => {
  it('accepts the anonymous shape, so the rest of this suite means something', () => {
    // A asserção de caminho feliz. Sem ela, um schema quebrado faria todas as
    // recusas abaixo passarem pelo motivo errado — a armadilha que o
    // `CLAUDE.md` registra e que já mordeu as guardas de `purpose` na Fase 9.
    expect(productEventSchema.safeParse(VALID_EVENT).success).toBe(true);
  });

  it('strips any identity field a caller tries to attach', () => {
    for (const field of IDENTITY_FIELDS) {
      const parsed = productEventSchema.parse({ ...VALID_EVENT, [field]: 'quem-sou' });
      // `z.object` sem `.passthrough()` descarta o que não declara: o campo não
      // chega ao `payload` gravado. É por isso que a asserção é sobre o
      // resultado do parse, e não sobre o status da resposta.
      expect(parsed).not.toHaveProperty(field);
    }
  });

  it('declares no identity field in the schema itself', () => {
    const declared = Object.keys(productEventSchema.parse(VALID_EVENT));
    expect(declared.filter((key) => IDENTITY_FIELDS.includes(key))).toEqual([]);
  });

  it('does not authenticate — the route works with no credential at all', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: { events: [VALID_EVENT] },
    });

    // 401 aqui significaria que alguém pôs o `authPlugin` na rota, e com ele
    // a medição passaria a ter dono.
    expect(response.statusCode).not.toBe(401);
  });

  it('rejects a path carrying a query string', async () => {
    // A query carrega o termo de busca, que tem regra de higiene própria em
    // `sanitizeSearchQuery`. Deixá-lo entrar por `path` seria a mesma
    // informação por uma porta sem porteiro.
    const response = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: { events: [{ ...VALID_EVENT, path: '/pt-BR/news?search=meu+cpf' }] },
    });

    expect(response.statusCode).toBe(400);
  });
});
