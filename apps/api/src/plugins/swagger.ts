import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import { env } from '../config/env';

/** Prefixo da UI interativa. Fora dele nada de estático é servido. */
export const DOCS_ROUTE_PREFIX = '/api/docs';

/**
 * A UI do Swagger é servida? Em produção, **não**.
 *
 * A revisão da Fase 9 encontrou a UI pública com o `servers` do documento
 * anunciando `http://0.0.0.0:3001` — o endereço de bind, não o endereço
 * público. Ou seja: uma vitrine que dava o endereço errado, e que ninguém
 * podia usar para chamar nada.
 *
 * A decisão foi fechar a UI em produção e consertar o `servers`, e não o
 * contrário, por duas razões. A primeira é que a UI não é o contrato — o
 * contrato é a `docs/api.md`, e desde esta fase há guarda de deriva contra ela
 * (`tests/routes/api-docs-drift.test.ts`). A segunda é que a UI é a única coisa
 * que arrasta `@fastify/static` para dentro do processo: as duas advisories
 * **high** de travessia de caminho e de bypass de route guard daquele pacote
 * (corrigidas só na major 10, presa aqui pela `@fastify/swagger-ui` 4) deixam
 * de ser alcançáveis em produção com a UI desregistrada.
 *
 * O documento OpenAPI continua sendo **gerado sempre** — é dele que sai a
 * enumeração de rotas usada pelas guardas.
 */
export function isDocsUiEnabled(nodeEnv: string = env.NODE_ENV): boolean {
  return nodeEnv !== 'production';
}

/**
 * A URL que o documento anuncia.
 *
 * `API_PUBLIC_URL` quando existe; senão o bind local, que é o certo em
 * desenvolvimento e era o errado em produção.
 */
export function openApiServerUrl(): string {
  return env.API_PUBLIC_URL ?? `http://${env.HOST}:${env.PORT}`;
}

/** CSP da UI: assets próprios, e o inline que o bundle do Swagger exige. */
const DOCS_CSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; base-uri 'none'; frame-ancestors 'none'";

export const swaggerPlugin = fp(async function swaggerPlugin(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Newra News API',
        description: 'API do portal de notícias Newra News',
        version: '1.0.0',
      },
      servers: [{ url: openApiServerUrl() }],
    },
    transform: jsonSchemaTransform,
  });

  if (!isDocsUiEnabled()) return;

  await app.register(swaggerUi, {
    routePrefix: DOCS_ROUTE_PREFIX,
  });

  // A CSP global é `default-src 'none'`, que é a certa para JSON e mata a UI.
  // Afrouxar o global para caber uma página foi como o projeto ficou sem CSP
  // nenhuma; então a exceção é por resposta, e só sob o prefixo da UI.
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith(DOCS_ROUTE_PREFIX)) {
      reply.header('content-security-policy', DOCS_CSP);
    }
  });
});
