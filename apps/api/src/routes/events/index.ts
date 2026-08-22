import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ingestProductEvents } from '../../services/product-event.service';
import {
  ingestEventsBodySchema,
  ingestEventsResponseSchema,
  errorResponseSchema,
} from './schemas';

/**
 * Ingestão de eventos de produto (§6 de `docs/v2/04-analytics-e-slots.md`).
 *
 * **É pública e anônima, e é por isso que ela é chata com o corpo.** Não há
 * sessão para autenticar — a §4 proíbe justamente o identificador que serviria
 * para isso —, então o que separa evento de lixo é o schema. Tipo fora do
 * catálogo, `source` inventado, `sessionId` que não é UUID: 400, e nada é
 * gravado.
 *
 * **Sem `Cache-Control`**, pela mesma razão que as rotas de conta não têm: a
 * resposta é da requisição, não do recurso.
 */
export async function eventsRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/',
    {
      // 30/min por IP. O limite global é 100/min e este endpoint recebe lote,
      // não clique: `track()` despacha em blocos, então uma sessão ativa manda
      // poucas requisições por minuto. Acima disso é script, não leitor.
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        summary: 'Ingest anonymous product analytics events',
        tags: ['events'],
        body: ingestEventsBodySchema,
        response: {
          201: ingestEventsResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await ingestProductEvents(request.body.events);

      // 201 e não 200: a requisição criou linhas. E o corpo diz **quantas** —
      // um `{ ok: true }` não deixaria como saber que metade do lote sumiu.
      return reply.status(201).send({ data: result });
    },
  );
}
