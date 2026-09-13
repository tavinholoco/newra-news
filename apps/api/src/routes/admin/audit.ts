import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { listAuditEvents } from '../../services/audit.service';
import {
  auditTrailQuerySchema,
  auditTrailResponseSchema,
  errorResponseSchema,
} from './schemas';

/**
 * A trilha de ação de admin (§9 do plano de observabilidade, 5b).
 *
 * Quem disparou o pipeline, quem apagou o quê — mais recente primeiro. A tabela
 * nasceu no 5a e quem a escreve são as duas rotas de mutação
 * (`POST /api/jobs/daily-pipeline` com `x-actor-id`, `DELETE /api/news/:id`);
 * esta é a leitura, e existe no mesmo PR porque tabela sem leitor é a
 * armadilha que este projeto já pagou duas vezes.
 *
 * Só o `actorId` sai — nenhum e-mail, como a tabela. Quem precisar do nome
 * junta com `User` na tela.
 */
export async function adminAuditRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        summary: 'Admin actions, most recent first',
        tags: ['admin'],
        querystring: auditTrailQuerySchema,
        response: {
          200: auditTrailResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const { days, limit } = request.query;
      return { data: await listAuditEvents({ days, limit }) };
    },
  );
}
