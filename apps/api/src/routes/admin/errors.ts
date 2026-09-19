import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getErrorSummary } from '../../services/error-summary.service';
import {
  errorResponseSchema,
  errorSummaryQuerySchema,
  errorSummaryResponseSchema,
} from './schemas';

/**
 * O `ErrorEvent`, agrupado, para a aba de segurança (§9 do plano de
 * observabilidade, 5b).
 *
 * A Fase 4 gravou a falha; ninguém a lia. Esta é a primeira porta que devolve
 * "o que está quebrado agora": uma linha por fingerprint na janela, com
 * contagem, visto por último, rota, mensagem e o `lastRequestId` que torna um
 * relato de fora pesquisável no log — mais as três distribuições (categoria,
 * severidade, origem) que a tela desenha em rosquinha.
 *
 * A proteção é do grupo (`routes/admin/index.ts`): esta rota não registra
 * `authPlugin` nem chama `requireAdmin`, e é assim que nasce protegida.
 */
export async function adminErrorsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        summary: 'Recorded failures, grouped by fingerprint, for the admin panel',
        tags: ['admin'],
        querystring: errorSummaryQuerySchema,
        response: {
          200: errorSummaryResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      return { data: await getErrorSummary(request.query.window) };
    },
  );
}
