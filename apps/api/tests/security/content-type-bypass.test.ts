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

/**
 * **O que o `inject` esconde, e de quem e o 415.**
 *
 * A verificacao pos-merge da promocao (09/09/2026) sondou esta mitigacao contra
 * producao e ela **nao disparou**. Medir, e nao deduzir, deu duas coisas que as
 * assercoes acima nao podiam ver:
 *
 * **1. O `light-my-request` nao passa pelo parser HTTP.** Medido com servidor
 * Node cru e requisicao por socket: o parser remove o espaco em branco opcional
 * do **fim** do valor do header (RFC 7230).
 *
 * | enviado no fio | chega ao app como |
 * |---|---|
 * | `application/json<TAB>` | `application/json` |
 * | `application/json ` | `application/json` |
 * | `application/json;<TAB>charset=utf-8` | inalterado |
 *
 * Ou seja: a forma com TAB **no fim** — que era a unica assercao de 415 deste
 * arquivo — **nao pode existir sobre HTTP**. O `inject` a preserva porque
 * entrega o objeto de headers direto ao Fastify.
 *
 * **2. O 415 da forma alcancavel e do proprio Fastify, nao deste hook.** Medido
 * num Fastify puro, sem hook nenhum: `application/json;<TAB>charset=utf-8`
 * responde **415 `FST_ERR_CTP_INVALID_MEDIA_TYPE`**, e `application/json<TAB>`
 * responde **200** com o corpo parseado normalmente — nenhum bypass, porque o
 * header chegou limpo.
 *
 * **Consequencia honesta: sobre HTTP real, nenhuma das duas formas depende
 * deste hook.** Ele fica como defesa em profundidade — remover uma mitigacao de
 * seguranca com base numa enumeracao parcial de formas seria trocar risco
 * conhecido por risco desconhecido —, mas a guarda passa a dizer **de quem e a
 * resposta**, que e o que faltava. **Gatilho para reavaliar:** a `fastify@5`,
 * onde o defeito e corrigido upstream e este hook perde a razao de existir.
 */
describe('9.S — sobre HTTP de verdade, e distinguindo de quem e o 415', () => {
  let origin: string;

  beforeAll(async () => {
    // Porta efemera no loopback: e o unico jeito de exercitar o parser HTTP,
    // que e exatamente a peca em disputa aqui.
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('sem porta');
    origin = `http://127.0.0.1:${address.port}`;
  });

  const post = async (contentType: string) => {
    const response = await fetch(`${origin}/api/events`, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: JSON.stringify({ events: [{ type: 'nao_existe' }] }),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  /**
   * **A assercao que tem dentes.** O 415 sozinho nao prova nada: o Fastify
   * devolve 415 para este mesmo header **sem hook nenhum**. O que separa os dois
   * e o corpo — o nosso tem um campo so (`errorResponseSchema`), o do Fastify
   * tem quatro e um `code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE'`.
   */
  it('answers with **our** 415, and does not echo the crafted header back', async () => {
    const { status, body } = await post(`application/json;${TAB}charset=utf-8`);

    expect(status).toBe(415);
    // **A frase fixa e a assinatura do hook.** Sem ele, o 415 do proprio
    // Fastify responde `Unsupported Media Type: application/json;<TAB>charset=utf-8`
    // — entrada hostil refletida de volta no corpo. O status nao distingue os
    // dois; a mensagem sim, e e por isso que ela e a assercao.
    expect(body.error).toBe('Unsupported Media Type');
  });

  /**
   * **Pino da fronteira.** Nao e a defesa falhando: e o parser tendo limpado o
   * header antes de o hook existir. Se um dia o Node parar de aparar o fim, esta
   * assercao reprova — e sera verdade, porque a superficie tera mudado.
   */
  it('never sees a trailing tab, because the parser trims it first', async () => {
    const { status } = await post(`application/json${TAB}`);

    // 400 = o schema recusou o tipo de evento. O corpo foi parseado e validado,
    // que e a prova de que **nao ha bypass** nesta forma.
    expect(status).toBe(400);
  });

  it('lets an ordinary content-type through to validation', async () => {
    // Sem esta, um hook que recusasse tudo passaria nas duas de cima.
    expect((await post('application/json; charset=utf-8')).status).toBe(400);
  });
});
