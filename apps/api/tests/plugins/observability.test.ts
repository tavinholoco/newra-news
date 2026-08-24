import { describe, it, expect, beforeEach } from 'vitest';
import {
  LATENCY_BUCKETS_MS,
  getHttpMetrics,
  percentileFromBuckets,
  recordHttpResponse,
  resetHttpMetrics,
} from '../../src/plugins/observability';

/**
 * A §26 do plano lista **error rate** e **API latency** como métricas técnicas
 * de sucesso da V2, e uma varredura por `latency`, `responseTime`, `errorRate`,
 * `p95` e `onResponse` no `apps/api/src` não devolvia nada: existia
 * observabilidade rica do *pipeline* e zero da *API como serviço*.
 *
 * A §9.5 punha a decisão como bifurcação — **medir ou riscar da lista**, porque
 * número prometido sem produtor é a armadilha da tabela sem leitor invertida.
 * Medir saiu mais barato. Estes testes cobrem a aritmética; a integração com o
 * Fastify (o `onResponse` e o `x-request-id`) está em
 * `tests/security/server-hardening.test.ts`.
 */

beforeEach(() => {
  resetHttpMetrics();
});

describe('9.5 — error rate', () => {
  it('counts only 5xx as server error', () => {
    recordHttpResponse('GET /api/news', 200, 10);
    recordHttpResponse('GET /api/news', 404, 10);
    recordHttpResponse('GET /api/news', 500, 10);
    recordHttpResponse('GET /api/news', 503, 10);

    const snapshot = getHttpMetrics();

    expect(snapshot.errorRate).toBe(0.5);
    // 4xx é resposta certa a pedido errado; misturar as duas faria o número
    // subir com tráfego de robô e descer com bug de servidor.
    expect(snapshot.clientErrorRate).toBe(0.25);
  });

  it('reports zero — and says the window is empty — before any request', () => {
    const snapshot = getHttpMetrics();

    expect(snapshot.totalRequests).toBe(0);
    expect(snapshot.errorRate).toBe(0);
    // Sem `since`, um `errorRate: 0` logo depois do deploy pareceria saúde e
    // seria só ausência de amostra.
    expect(snapshot.since).toBeTruthy();
  });
});

describe('9.5 — latência', () => {
  it('places a sample in the first bucket it fits', () => {
    const buckets = new Array<number>(LATENCY_BUCKETS_MS.length + 1).fill(0);
    buckets[0] = 100;

    expect(percentileFromBuckets(buckets, 0.95)).toBe(LATENCY_BUCKETS_MS[0]);
  });

  it('falls into the overflow bucket above the last boundary', () => {
    recordHttpResponse('GET /api/home', 200, 9_000);

    const snapshot = getHttpMetrics();

    expect(snapshot.latencyMs.p95).toBe(
      LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1],
    );
    // O `max` é o valor real, e é ele que denuncia o cold start do Render —
    // o percentil só sabe dizer "acima do último balde".
    expect(snapshot.latencyMs.max).toBe(9_000);
  });

  it('answers zero for a percentile with no samples', () => {
    expect(percentileFromBuckets([0, 0, 0], 0.95)).toBe(0);
  });

  it('lets the tail show up in the p99 while the p50 stays fast', () => {
    // 95 respostas rapidas e 5 lentas: o p95 ainda cai no primeiro balde
    // (a 95a amostra e rapida), e e o **p99** que enxerga a cauda. E a razao
    // de a resposta trazer os tres — um p95 sozinho esconderia as cinco.
    for (let i = 0; i < 95; i++) recordHttpResponse('GET /api/news', 200, 10);
    for (let i = 0; i < 5; i++) recordHttpResponse('GET /api/news', 200, 4_000);

    const { latencyMs } = getHttpMetrics();

    expect(latencyMs.p50).toBe(LATENCY_BUCKETS_MS[0]);
    expect(latencyMs.p99).toBeGreaterThan(latencyMs.p50);
    expect(latencyMs.max).toBe(4_000);
  });
});

describe('9.5 — a chave é o padrão da rota, não a URL', () => {
  it('keeps one row per route pattern', () => {
    // `GET /api/news/:id` e não `/api/news/<uuid>`: a URL crua traria uma linha
    // por notícia, e o mapa cresceria sem teto — o defeito clássico de
    // cardinalidade em métrica.
    recordHttpResponse('GET /api/news/:id', 200, 10);
    recordHttpResponse('GET /api/news/:id', 200, 20);

    const snapshot = getHttpMetrics();

    expect(snapshot.routes).toHaveLength(1);
    expect(snapshot.routes[0]?.count).toBe(2);
    expect(snapshot.routes[0]?.avgMs).toBe(15);
  });

  it('sorts the busiest route first', () => {
    recordHttpResponse('GET /api/home', 200, 10);
    recordHttpResponse('GET /api/news', 200, 10);
    recordHttpResponse('GET /api/news', 200, 10);

    expect(getHttpMetrics().routes[0]?.route).toBe('GET /api/news');
  });

  it('reports the error rate per route, not only globally', () => {
    recordHttpResponse('GET /api/home', 500, 10);
    recordHttpResponse('GET /api/news', 200, 10);

    const byRoute = Object.fromEntries(
      getHttpMetrics().routes.map((row) => [row.route, row.errorRate]),
    );

    expect(byRoute['GET /api/home']).toBe(1);
    expect(byRoute['GET /api/news']).toBe(0);
  });
});
