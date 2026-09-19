import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { recordAuditEvent } from '../../services/audit.service';
import { triggerPipeline } from '../../services/pipeline.service';
import { AppError } from '../../utils/errors';
import { assertJobSecret } from '../../utils/job-secret';
import { jobTriggerResponseSchema, errorResponseSchema } from './schemas';

/**
 * O cabeçalho pelo qual o ator do disparo manual chega até aqui.
 *
 * **A API não vê quem clicou, e foi medido ao abrir a Fase 5:** a cadeia é BFF
 * (sessão ADMIN) → `GET /api/cron/daily-news` (`CRON_SECRET`) →
 * `POST /api/jobs/daily-pipeline` (`JOB_SECRET`), e o disparo chega **sem
 * usuário nenhum**. Quem sabe quem clicou é o BFF, e é ele que põe o
 * `User.id` neste cabeçalho; o cron do Next só o repassa. O cron da Vercel não
 * o manda, e o disparo agendado **não** produz linha de auditoria — só um
 * humano com sessão ADMIN produz.
 *
 * **É cabeçalho, e não corpo, por dois motivos medidos.** O primeiro salto
 * (BFF → cron) é um `GET`, que não carrega corpo. E um `body` neste `POST`
 * quebraria todo chamador que hoje não manda nenhum: o validador recebe `null`
 * quando não há corpo, e `.default({})` do Zod só cobre `undefined`. Não é um
 * schema de `headers` do Fastify pela mesma família de armadilha: o
 * `validatorCompiler` do type provider devolve o objeto **parseado** e o
 * Fastify o põe no lugar de `request.headers` — um `z.object` ali apagaria o
 * `authorization`.
 *
 * **A confiança é a do `JOB_SECRET`.** Só quem o tem chega a ler este
 * cabeçalho, e quem o tem já pode disparar o pipeline à vontade — o ator é uma
 * afirmação de um chamador que já é de confiança, não uma credencial.
 */
export const ACTOR_ID_HEADER = 'x-actor-id';

const actorIdSchema = z.string().uuid();

/**
 * O ator, se veio — ou 400 se veio errado.
 *
 * Um valor malformado só pode ser bug **nosso** (o BFF é o único que escreve o
 * cabeçalho), e a alternativa — ignorar em silêncio — seria disparar o
 * pipeline e perder a linha de auditoria sem sinal nenhum: a falha muda que a
 * Fase 4 existe para acabar. Daí `category: 'internal'` num 400, pela regra da
 * Fase 3: quando categoria e status discordam sobre a gravidade, ganha a
 * categoria.
 */
function actorIdOf(request: FastifyRequest): string | undefined {
  const raw = request.headers[ACTOR_ID_HEADER];
  if (raw === undefined) return undefined;

  const parsed = actorIdSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(`Invalid ${ACTOR_ID_HEADER} header`, 400, {
      code: 'ACTOR_ID_INVALID',
      category: 'internal',
    });
  }
  return parsed.data;
}

export async function jobsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/daily-pipeline',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        response: {
          200: jobTriggerResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      assertJobSecret(request);
      // Depois do segredo, de propósito: o cabeçalho só significa alguma coisa
      // vindo de quem já provou ser nosso.
      const actorId = actorIdOf(request);

      // O desfecho vem do serviço: ele sabe se criou o run ou se devolveu o
      // de hoje. A rota não recalcula nada — reescrever a regra aqui daria
      // duas verdades sobre a mesma coisa.
      const trigger = await triggerPipeline();

      if (actorId !== undefined) {
        // `targetId` só quando este clique criou o run: nos outros dois
        // desfechos o id é de um run que já existia, e vai no `context` — a
        // linha diz que a pessoa clicou, e que nada foi disparado.
        await recordAuditEvent({
          actorId,
          action: 'pipeline.triggered',
          targetId: trigger.outcome === 'started' ? trigger.pipelineId : null,
          outcome: trigger.outcome,
          requestId: request.id,
          context: { pipelineId: trigger.pipelineId, startedAt: trigger.startedAt },
        });
      }

      return trigger;
    },
  );
}
