import type { FastifyReply } from 'fastify';

/**
 * `Cache-Control` para as respostas editoriais.
 *
 * **Nenhuma rota da API definia cache antes desta** — os contratos da Fase 0
 * anotam isso explicitamente, e a decisão de onde ele mora ficou em aberto. A
 * escolha aqui é **header por rota, através deste helper**, e não um hook
 * `onSend` global:
 *
 * - um hook aplicaria política a rotas que não deveriam ter nenhuma. As rotas
 *   autenticadas (`/favorites`, `/metrics/dashboard`) devolvem dado por
 *   usuário; um `s-maxage` num proxy compartilhado ali seria vazamento entre
 *   sessões, não otimização;
 * - o call site fica explícito: dá para ler numa rota se ela é cacheável sem
 *   procurar um plugin;
 * - a string mora num lugar só, então não há como uma rota escrever
 *   `s-maxage=300` e outra `s-max-age=300`.
 *
 * `s-maxage=300` vale para o CDN, não para o browser. A ISR de 3600s da home
 * continua; os 300s existem para o `revalidatePath` on-demand do cron
 * (`/api/cron/daily-news`) surtir efeito em minutos e não em uma hora.
 * `stale-while-revalidate` serve a cópia velha enquanto busca a nova, para o
 * primeiro leitor depois da expiração não pagar a consulta.
 */
export const EDITORIAL_CACHE_CONTROL =
  'public, s-maxage=300, stale-while-revalidate=3600';

export function withEditorialCache(reply: FastifyReply): FastifyReply {
  return reply.header('Cache-Control', EDITORIAL_CACHE_CONTROL);
}
