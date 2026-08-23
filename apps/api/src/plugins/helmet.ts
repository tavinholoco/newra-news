import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';

/**
 * CSP de **API JSON**: `default-src 'none'`.
 *
 * Até a Fase 9 isto era `contentSecurityPolicy: false`, herdado do template. A
 * decisão da revisão foi ligar a política mais restritiva que existe, porque é
 * exatamente a que cabe aqui: uma resposta `application/json` não carrega
 * script, estilo, imagem nem fonte, então nenhuma fonte precisa ser permitida.
 *
 * O que a política protege não é o JSON — é o que um browser faria com uma
 * resposta desta origem servida como documento (o painel `/dev/dashboard` é
 * HTML de verdade). `frame-ancestors 'none'` impede o enquadramento,
 * `base-uri`/`form-action` fecham as duas reescritas clássicas.
 *
 * **A única página HTML da API declara a sua própria política**, por resposta,
 * com nonce — ver `routes/dev/dashboard.ts`. Política de página não vive aqui
 * porque afrouxar o global para caber uma página é como o projeto perdeu o
 * `contentSecurityPolicy: false` em primeiro lugar.
 */
export const API_CSP_DIRECTIVES = {
  defaultSrc: ["'none'"],
  baseUri: ["'none'"],
  formAction: ["'none'"],
  frameAncestors: ["'none'"],
} as const;

export const helmetPlugin = fp(async function helmetPlugin(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': [...API_CSP_DIRECTIVES.defaultSrc],
        'base-uri': [...API_CSP_DIRECTIVES.baseUri],
        'form-action': [...API_CSP_DIRECTIVES.formAction],
        'frame-ancestors': [...API_CSP_DIRECTIVES.frameAncestors],
      },
    },
  });
});
