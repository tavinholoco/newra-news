import type { FastifyInstance } from 'fastify';
import { authPlugin, requireAdmin } from '../../plugins/auth';
import { adminAuditRoutes } from './audit';
import { adminErrorsRoutes } from './errors';
import { adminPipelineRoutes } from './pipeline';

/**
 * **Tudo sob `/api/admin` é ADMIN, e a garantia é deste arquivo.**
 *
 * A Fase 2 abriu o prefixo com uma rota só, e o `authPlugin` + `requireAdmin`
 * moravam em `pipeline.ts`. Com a Fase 5 são três grupos de rota, e repetir as
 * duas linhas em cada um seria voltar ao hábito por rota que o prefixo existe
 * para acabar. Elas registram **uma vez, aqui**, e os filhos herdam o
 * `preHandler` — hook de contexto pai vale para todo `register` abaixo dele.
 *
 * `authPlugin` não encapsula (o `fp()` do export default marca a função com
 * `skip-override`), então o `preHandler` dele entra **neste** contexto — o de
 * `adminRoutes` — e alcança `pipeline`, `errors` e `audit`, e só eles. A
 * guarda continua a mesma: `authorization-matrix.test.ts` enumera o
 * `printRoutes()`, filtra o prefixo e cobra `access: 'admin'` de cada linha.
 *
 * Rate limit: o global de 100/min, para todas — cada uma já custa um JWT de
 * admin válido.
 */
export async function adminRoutes(app: FastifyInstance) {
  await app.register(authPlugin);
  app.addHook('preHandler', async (request) => {
    requireAdmin(request);
  });

  await app.register(adminPipelineRoutes, { prefix: '/pipeline' });
  await app.register(adminErrorsRoutes, { prefix: '/errors' });
  await app.register(adminAuditRoutes, { prefix: '/audit' });
}
