import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Limite global de 100/min **por cliente**. Rotas que precisam de outro teto
 * declaram `config.rateLimit` (a `/api/events` usa 30/min).
 *
 * ## Por que o `keyGenerator` é explícito
 *
 * O padrão do `@fastify/rate-limit` já é `request.ip` — o que muda tudo é de
 * onde o Fastify tira esse `ip`. **Sem `trustProxy`, `request.ip` é o peer do
 * socket**, e atrás do proxy do Render o peer não é o visitante: é o proxy.
 * Medido em produção em 23/08/2026, três requisições com `X-Forwarded-For`
 * diferentes na mesma janela devolveram `x-ratelimit-remaining` 98, 97 e 96 —
 * **um balde só para a internet inteira**.
 *
 * A consequência era silenciosa e cara: todo o tráfego server-side sai da
 * Vercel, e a ingestão de eventos passa pela rota `/api/events` do Next. Com
 * balde único, o teto de 30/min daquela rota viraria **teto global de
 * ingestão**, e a tela de métricas da Fase 8 passaria a subcontar sem sinal
 * nenhum — 429 num `sendBeacon` não tem retorno que o cliente leia.
 *
 * O `trustProxy` vive no `buildApp` (é opção do servidor, não deste plugin);
 * aqui fica a chave, escrita à mão para que a intenção seja legível e para que
 * a guarda em `tests/plugins/rate-limit-key.test.ts` tenha o que afirmar.
 */
export function rateLimitKey(request: FastifyRequest): string {
  return request.ip;
}

export const rateLimitPlugin = fp(async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: rateLimitKey,
  });
});
