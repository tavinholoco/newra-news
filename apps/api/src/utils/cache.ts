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
 *
 * ## O que este cabeçalho **não** faz hoje — medido, não suposto
 *
 * A §11.3 mandava aplicar a mesma política à `/api/news`, "a mais chamada do
 * acervo". A medição contra produção em 24/08/2026 derrubou a proposta:
 *
 * ```
 * GET /api/home   → cache-control: public, s-maxage=300, stale-while-revalidate=3600
 *                   cf-cache-status: DYNAMIC        server: cloudflare
 * ```
 *
 * **Há um Cloudflare na frente do Render, e ele responde `DYNAMIC`** — resposta
 * JSON não é elegível a cache por padrão, e as regras de cache daquele
 * Cloudflare são do Render, não deste projeto. Somando os três consumidores
 * possíveis:
 *
 * - **o Cloudflare do Render** não guarda (`DYNAMIC`, medido);
 * - **o cache de dados do Next** decide por `next.revalidate`, e ignora este
 *   cabeçalho;
 * - **o navegador** lê `max-age`, que esta política não declara — `s-maxage` é
 *   para cache compartilhado.
 *
 * Ou seja: **o cabeçalho está correto e não é lido por ninguém.** Fica onde
 * está, porque declarar a política certa custa zero e é o que vale no dia em
 * que houver cache compartilhado; mas **estendê-lo para mais rotas não teria
 * acelerado nada**, e é por isso que a `/api/news` continua sem ele.
 *
 * O cache que existe de verdade neste produto está do lado da Vercel, e quem o
 * controla é o `revalidate` das páginas — foi lá que a §11.3 achou o problema
 * real (as duas telas de leitura renderizando a cada requisição).
 */
export const EDITORIAL_CACHE_CONTROL =
  'public, s-maxage=300, stale-while-revalidate=3600';

export function withEditorialCache(reply: FastifyReply): FastifyReply {
  return reply.header('Cache-Control', EDITORIAL_CACHE_CONTROL);
}
