import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getSourceHealthReport } from '../../services/source-health.service';
import {
  errorResponseSchema,
  sourceHealthQuerySchema,
  sourceHealthResponseSchema,
} from './schemas';

/**
 * A saúde de cada fonte, um dia de cada vez (§15 do plano de observabilidade,
 * Fase 11 — PR 11b).
 *
 * A série por fonte na janela — `fetched`, `kept`, desfecho, latência, o run
 * que escreveu a linha — para o painel "Fontes" da aba Métricas responder as
 * três perguntas que hoje não têm resposta: "há quantos dias a
 * Superinteressante está fora?", "esta fonte entrega menos do que
 * entregava?", "vale a pena trocar este provedor?". A tabela nasceu no 11a e
 * o pipeline a escreve neste PR; esta é a leitura, no mesmo PR, porque tabela
 * sem leitor é a armadilha que este projeto já pagou.
 *
 * A API devolve o que a tabela tem: só os dias com linha. Médias, variação,
 * sequência de falhas e o dia "não tentado" são derivados no web, como o
 * desfecho por dia da Fase 8.
 *
 * A proteção é do grupo (`routes/admin/index.ts`): esta rota não registra
 * `authPlugin` nem chama `requireAdmin`, e é assim que nasce protegida.
 */
export async function adminSourcesRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        summary: 'Per-source health over the window, one line per (source, day)',
        tags: ['admin'],
        querystring: sourceHealthQuerySchema,
        response: {
          200: sourceHealthResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      return { data: await getSourceHealthReport({ days: request.query.days }) };
    },
  );
}
