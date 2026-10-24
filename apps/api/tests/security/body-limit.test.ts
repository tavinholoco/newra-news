import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PRODUCT_EVENT_BATCH_MAX, SEARCH_QUERY_MAX_LENGTH } from '@newranews/types';
import { REQUEST_BODY_LIMIT_BYTES } from '../../src/app';
import { ingestEventsBodySchema } from '../../src/routes/events/schemas';
import { buildTestApp } from '../helpers/test-server';

/**
 * **O teto do corpo é a mitigação da GHSA-mrhx-c7xc-m3w5, e é ele que a
 * mantém aceita** (24/10/2026).
 *
 * O `zod@3` guarda uma issue por elemento inválido de um array, sem teto, e a
 * validação roda antes da autenticação. Com o 1 MB padrão do Fastify, um
 * `[0,0,0,…]` custava ~250 MB numa instância de 512 MB (medido). O aceite em
 * `docs/security-advisories.md` diz "mitigado na porta" — e é esta suíte que
 * reprova se a porta abrir: o limite subir, o maior lote legítimo deixar de
 * caber, ou a recusa passar a acontecer depois do validador.
 */

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

/** Um array de `0` serializado num corpo de `bytes` (aprox.) — o ataque medido. */
function zeroArrayBody(bytes: number): string {
  const count = Math.floor((bytes - '{"events":[]}'.length) / 2);
  return `{"events":[${Array(count).fill('0').join(',')}]}`;
}

/** O maior lote legítimo: 20 eventos com cada campo no tamanho máximo. */
function largestLegitimateBatch(): string {
  const event = {
    sessionId: '11111111-2222-3333-4444-555555555555',
    locale: 'pt-BR-xxxxx'.slice(0, 10),
    path: `/${'p'.repeat(511)}`,
    occurredAt: '2026-10-24T12:00:00.000Z',
    type: 'search',
    query: 'q'.repeat(SEARCH_QUERY_MAX_LENGTH),
    resultCount: 999_999,
  };
  return JSON.stringify({ events: Array(PRODUCT_EVENT_BATCH_MAX).fill(event) });
}

describe('o teto do corpo de requisição', () => {
  it('is wired into the server at 64 KB, not the 1 MB default', () => {
    expect(REQUEST_BODY_LIMIT_BYTES).toBeLessThanOrEqual(64 * 1024);
    expect(app.initialConfig.bodyLimit).toBe(REQUEST_BODY_LIMIT_BYTES);
  });

  it('fits the largest legitimate batch of events with room to spare', () => {
    const body = largestLegitimateBatch();

    // O lote é válido — senão este tamanho não mediria nada.
    expect(ingestEventsBodySchema.safeParse(JSON.parse(body)).success).toBe(true);
    expect(body.length * 2).toBeLessThan(REQUEST_BODY_LIMIT_BYTES);
  });

  it('refuses an oversized array with 413 before validation, on the anonymous ingest route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/events',
      headers: { 'content-type': 'application/json' },
      payload: zeroArrayBody(REQUEST_BODY_LIMIT_BYTES * 2),
    });

    expect(res.statusCode).toBe(413);
  });

  it('refuses it with 413 on a session route too — the parser runs before the auth check', async () => {
    // A validação (e o parser antes dela) roda antes do `preHandler` do
    // `authPlugin`: sem o teto, uma rota protegida também validava o array
    // inteiro de quem não tem sessão.
    const res = await app.inject({
      method: 'PUT',
      url: '/api/account/preferences',
      headers: { 'content-type': 'application/json' },
      payload: zeroArrayBody(REQUEST_BODY_LIMIT_BYTES * 2),
    });

    expect(res.statusCode).toBe(413);
  });

  it('bounds what the validator can be made to allocate at the limit', () => {
    // O pior corpo que passa pela porta: um elemento a cada dois bytes, e duas
    // issues por elemento (a interseção do evento valida as duas metades) —
    // uma issue por byte. Medido em 24/10: ~65 mil issues, ~27 MB, contra
    // ~1 milhão e ~465 MB com o 1 MB padrão.
    const parsed = ingestEventsBodySchema.safeParse(
      JSON.parse(zeroArrayBody(REQUEST_BODY_LIMIT_BYTES)),
    );

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.length).toBeLessThanOrEqual(REQUEST_BODY_LIMIT_BYTES);
  });
});
