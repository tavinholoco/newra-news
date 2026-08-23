import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';

/**
 * GHSA — "Fastify's Content-Type header tab character allows body validation
 * bypass", **high**, corrigida só na `fastify@5.7.2`.
 *
 * A API está na `fastify@4.29.1`, e subir de major na revisão de backend
 * seria mexer na fundação no meio da certificação (é a decisão registrada na
 * §9.S: a major fica para a Fase 12, com a suíte inteira como rede). O que
 * **não** ficou para depois foi o caminho: um `content-type` com tab é
 * recusado na porta, e este teste é o que mantém isso fechado.
 *
 * Por que na porta e não no parser: o defeito é o parser **não reconhecer** o
 * tipo e a requisição seguir por outro caminho. Recusar antes de escolher
 * parser não depende de saber qual caminho é o furado.
 */
vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: { productEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } },
  };
});

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

const TAB = String.fromCharCode(9);

describe('9.S — content-type com tab não entra', () => {
  it('rejects a body whose content-type carries a tab character', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { 'content-type': `application/json${TAB}` },
      payload: JSON.stringify({ events: [{ type: 'nao_existe' }] }),
    });

    expect(res.statusCode).toBe(415);
  });

  it('still accepts the ordinary content-type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ events: [{ type: 'nao_existe' }] }),
    });

    // 400 (schema recusou o tipo de evento), e não 415: o caminho normal segue
    // chegando à validação, que é o ponto.
    expect(res.statusCode).toBe(400);
  });

  it('accepts a content-type with parameters and ordinary whitespace', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      payload: JSON.stringify({ events: [{ type: 'nao_existe' }] }),
    });

    expect(res.statusCode).toBe(400);
  });
});
