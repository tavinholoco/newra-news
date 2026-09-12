import type { FastifyRequest } from 'fastify';

/**
 * O balde de tudo que não casou com rota nenhuma.
 *
 * É chave em **dois** lugares que precisam concordar: o mapa de métricas de
 * HTTP (`plugins/observability.ts`) e o `route` do `ErrorEvent`. Se um dia um
 * dos dois escrever `'unknown'`, o balde se parte em dois e nenhuma guarda
 * acusa — por isso a string mora aqui, uma vez.
 */
export const UNMATCHED_ROUTE = 'unmatched';

/**
 * O **padrão** da rota (`/api/news/:id`), nunca a URL crua.
 *
 * É o campo que o `ErrorEvent` usa como peça do fingerprint e que o mapa de
 * métricas usa como chave — nos dois, cardinalidade é tamanho de tabela, e a
 * URL daria uma linha por id. Existia em seis cópias antes da verificação
 * pós-merge da Fase 4; o `unmatched` é o que elas tinham de concordar sobre.
 *
 * `routeOptions.url` é indefinido antes de o roteador decidir — no `onRequest`
 * de um caminho que não existe, no `setNotFoundHandler` — e é aí que o balde
 * entra.
 */
export function routePatternOf(request: FastifyRequest): string {
  return request.routeOptions?.url ?? UNMATCHED_ROUTE;
}
