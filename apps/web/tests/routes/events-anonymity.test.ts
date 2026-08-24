import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POST } from '@/app/api/events/route';

/**
 * **A rota de eventos é anônima de propósito, e o risco não é ataque: é deriva.**
 *
 * Ela existe sem sessão, sem JWT e sem cabeçalho de identificação porque a §4
 * de `docs/v2/04-analytics-e-slots.md` diz que a medição é *cookieless* e sem
 * identificador entre visitas — é isso que sustenta o legítimo interesse em vez
 * de exigir consentimento, e é isso que torna a tabela `ProductEvent` o que ela
 * é juridicamente.
 *
 * Um `userId` acrescentado "para melhorar a métrica" mudaria a natureza da
 * tabela inteira, e ninguém no PR seguinte se lembraria disso. Esta guarda é o
 * que faz a mudança aparecer.
 *
 * O outro lado — o schema da API recusando campo de identidade no payload —
 * está em `apps/api`, e é lá que ele tem de estar: esta rota **repassa** o
 * corpo, não o valida.
 */

/**
 * O fonte **sem comentário**, e essa foi a terceira vez nesta fase que a
 * distinção decidiu se a guarda funcionava. A rota explica no próprio JSDoc por
 * que **não** usa `proxyToApi`; um regex sobre o arquivo cru lê essa frase como
 * uso e reprova o que está certo — do mesmo jeito que, nas outras duas, leu um
 * comentário como declaração e aprovou o que estava errado.
 */
const ROUTE_SOURCE = readFileSync(
  join(__dirname, '../../app/api/events/route.ts'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/events do BFF — anonimato', () => {
  it('does not import anything that resolves an identity', () => {
    // `getServerSession` e `signAuthJwt` são as duas portas de identidade deste
    // app. Nenhuma delas pode aparecer aqui — nem por engano, nem "só para o
    // log".
    expect(ROUTE_SOURCE).not.toMatch(/getServerSession|signAuthJwt|authOptions/);
    expect(ROUTE_SOURCE).not.toMatch(/from 'next\/headers'|cookies\(\)/);
  });

  it('does not use proxyToApi — that one demands a session by design', () => {
    expect(ROUTE_SOURCE).not.toMatch(/proxyToApi/);
  });

  it('forwards only the body and a content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      json: vi.fn().mockResolvedValue({ data: { accepted: 1 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await POST(
      new Request('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({ events: [] }),
        headers: {
          cookie: 'next-auth.session-token=nao-pode-passar',
          'x-forwarded-for': '203.0.113.7',
          'user-agent': 'Mozilla/5.0',
          authorization: 'Bearer nao-pode-passar',
        },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    // O cabeçalho de identidade mais óbvio, o IP do leitor e o agente: nenhum
    // atravessa. O `x-request-id` do `proxyToApi` também não vem para cá — ele
    // correlaciona uma chamada de conta, e aqui não há conta a correlacionar.
    expect(Object.keys(headers).map((key) => key.toLowerCase())).toEqual([
      'content-type',
    ]);
  });

  it('answers 502 without leaking why, when the API does not respond', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED 1.2.3.4')));

    const res = await POST(
      new Request('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({ events: [] }),
      }),
    );

    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('ECONNREFUSED');
  });
});
