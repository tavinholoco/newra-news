import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireSubject } from '../../plugins/auth';
import { recordPlanHoursReading } from '../../services/plan-hours.service';
import {
  errorResponseSchema,
  planHoursReadingBodySchema,
  planHoursReadingResponseSchema,
} from './schemas';

/**
 * A leitura do Billing do Render (§23 do plano de observabilidade, 13b).
 *
 * O dono lê no painel do Render o total de horas free do **workspace** e o
 * digita na `/admin`; esta rota guarda a leitura junto das horas desta API no
 * mesmo instante (`plan-hours.service.ts` diz por que o número entra
 * digitado). É a **única escrita** do grupo `/api/admin`, e herda dele a
 * proteção — sessão com papel ADMIN.
 *
 * `201`, e não `200`: a resposta é a linha criada. O ator é quem está na
 * sessão (`requireSubject`), conferido **antes** de gravar — leitura sem
 * dono não é leitura.
 */
export async function adminPlanHoursRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        summary: 'Record a Render Billing reading of the workspace free hours',
        tags: ['admin'],
        body: planHoursReadingBodySchema,
        response: {
          201: planHoursReadingResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const actorId = requireSubject(request);

      const reading = await recordPlanHoursReading({
        actorId,
        workspaceHours: request.body.workspaceHours,
        requestId: request.id,
      });

      return reply.status(201).send({ data: reading });
    },
  );
}
