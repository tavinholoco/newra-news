import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

/**
 * As duas métricas técnicas que a §26 do plano promete — **error rate** e **API
 * latency** — e que até a Fase 9 ninguém produzia.
 *
 * A §9.5 punha a decisão como bifurcação: medir ou riscar da lista. Medir saiu
 * mais barato que riscar: um `onResponse`, um contador por rota e um
 * histograma por bucket. O que **não** foi feito, e é a parte que importa
 * declarar: nada disso é persistido.
 *
 * ## Por que em memória, e o número que muda isso
 *
 * A alternativa era gravar por requisição num modelo novo do Prisma. Seria uma
 * escrita a mais em toda requisição de leitura para responder a uma pergunta
 * que se faz uma vez por semana — e a tabela sem leitor é uma armadilha que
 * este projeto já pagou (§21). Em memória, o custo é um `Map` e a leitura é
 * exata para o processo que está no ar.
 *
 * O preço é honesto e está escrito na resposta: **a janela zera a cada deploy e
 * a cada hibernação** (o plano free do Render dorme com ~15 min sem tráfego),
 * e com mais de uma instância cada uma responde a sua. Isso basta para "a API
 * está devolvendo erro agora?" e não basta para tendência entre semanas.
 *
 * **O gatilho para persistir:** mais de uma instância no Render, ou a primeira
 * pergunta que exija comparar duas semanas. Antes disso, persistir é inventar
 * leitor.
 */

/** Fronteiras do histograma, em ms. A última é implícita (`+Inf`). */
export const LATENCY_BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000] as const;

export interface RouteStats {
  /** Padrão da rota (`/api/news/:id`), nunca a URL — senão vira cardinalidade infinita. */
  route: string;
  count: number;
  errors: number;
  clientErrors: number;
  totalMs: number;
  maxMs: number;
  /** Contagem por bucket de `LATENCY_BUCKETS_MS`, mais um final para o resto. */
  buckets: number[];
}

export interface HttpMetricsSnapshot {
  since: string;
  uptimeSeconds: number;
  totalRequests: number;
  errorRate: number;
  clientErrorRate: number;
  latencyMs: { avg: number; p50: number; p95: number; p99: number; max: number };
  routes: Array<{
    route: string;
    count: number;
    errorRate: number;
    avgMs: number;
    p95Ms: number;
    maxMs: number;
  }>;
}

const stats = new Map<string, RouteStats>();
let startedAt = new Date();

/** Zera a janela. Existe para o teste — em produção quem zera é o deploy. */
export function resetHttpMetrics(): void {
  stats.clear();
  startedAt = new Date();
}

function emptyStats(route: string): RouteStats {
  return {
    route,
    count: 0,
    errors: 0,
    clientErrors: 0,
    totalMs: 0,
    maxMs: 0,
    buckets: new Array<number>(LATENCY_BUCKETS_MS.length + 1).fill(0),
  };
}

export function recordHttpResponse(
  route: string,
  statusCode: number,
  durationMs: number,
): void {
  const entry = stats.get(route) ?? emptyStats(route);
  entry.count += 1;
  if (statusCode >= 500) entry.errors += 1;
  else if (statusCode >= 400) entry.clientErrors += 1;
  entry.totalMs += durationMs;
  entry.maxMs = Math.max(entry.maxMs, durationMs);

  const found = LATENCY_BUCKETS_MS.findIndex((limit) => durationMs <= limit);
  const bucket = found === -1 ? LATENCY_BUCKETS_MS.length : found;
  entry.buckets[bucket] = (entry.buckets[bucket] ?? 0) + 1;

  stats.set(route, entry);
}

/**
 * Percentil a partir do histograma.
 *
 * É **o limite superior do bucket** em que o percentil cai, não o valor exato —
 * guardar as amostras para responder exato seria guardar memória proporcional
 * ao tráfego. Um p95 que diz "≤ 500 ms" responde a pergunta que se faz dele.
 */
export function percentileFromBuckets(buckets: number[], percentile: number): number {
  const total = buckets.reduce((sum, n) => sum + n, 0);
  if (total === 0) return 0;

  const target = Math.ceil(total * percentile);
  let seen = 0;
  for (let i = 0; i < buckets.length; i++) {
    seen += buckets[i] ?? 0;
    if (seen >= target) {
      return LATENCY_BUCKETS_MS[i] ?? Number(LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1]);
    }
  }
  return Number(LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1]);
}

const ratio = (part: number, whole: number): number =>
  whole === 0 ? 0 : Number((part / whole).toFixed(4));

export function getHttpMetrics(now: Date = new Date()): HttpMetricsSnapshot {
  const all = [...stats.values()];
  const totalRequests = all.reduce((sum, r) => sum + r.count, 0);
  const totalErrors = all.reduce((sum, r) => sum + r.errors, 0);
  const totalClientErrors = all.reduce((sum, r) => sum + r.clientErrors, 0);
  const totalMs = all.reduce((sum, r) => sum + r.totalMs, 0);
  const merged = new Array<number>(LATENCY_BUCKETS_MS.length + 1).fill(0);
  for (const r of all) {
    r.buckets.forEach((n, i) => {
      merged[i] = (merged[i] ?? 0) + n;
    });
  }

  return {
    since: startedAt.toISOString(),
    uptimeSeconds: Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000)),
    totalRequests,
    errorRate: ratio(totalErrors, totalRequests),
    clientErrorRate: ratio(totalClientErrors, totalRequests),
    latencyMs: {
      avg: totalRequests === 0 ? 0 : Math.round(totalMs / totalRequests),
      p50: percentileFromBuckets(merged, 0.5),
      p95: percentileFromBuckets(merged, 0.95),
      p99: percentileFromBuckets(merged, 0.99),
      max: all.reduce((max, r) => Math.max(max, r.maxMs), 0),
    },
    routes: all
      .map((r) => ({
        route: r.route,
        count: r.count,
        errorRate: ratio(r.errors, r.count),
        avgMs: r.count === 0 ? 0 : Math.round(r.totalMs / r.count),
        p95Ms: percentileFromBuckets(r.buckets, 0.95),
        maxMs: r.maxMs,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

/**
 * Correlação de requisição + coleta.
 *
 * O `x-request-id` sai em **toda** resposta, inclusive nos 500: sem ele, um
 * erro relatado por quem consome não tem como ser ligado à linha do log — e é
 * exatamente num 500 que a mensagem para o cliente deixou de dizer o que
 * aconteceu (ver o error handler em `app.ts`).
 */
export const observabilityPlugin = fp(async function observabilityPlugin(
  app: FastifyInstance,
) {
  app.addHook('onRequest', async (request, reply) => {
    // Quem gera o id e o `genReqId` do `buildApp` (e ele que o pino usa em toda
    // linha de log); aqui ele so vai para a resposta.
    reply.header('x-request-id', request.id);
  });

  app.addHook('onResponse', async (request, reply) => {
    // `routeOptions.url` é o **padrão** (`/api/news/:id`). A URL crua traria um
    // id por linha, e o mapa cresceria sem teto.
    const route = request.routeOptions?.url ?? 'unmatched';
    recordHttpResponse(
      `${request.method} ${route}`,
      reply.statusCode,
      reply.elapsedTime,
    );
  });
});
