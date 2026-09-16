import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getLatestInvariantReport } from '../../services/invariants.service';
import { errorResponseSchema, invariantReportResponseSchema } from './schemas';

/**
 * O último relatório de invariantes (§10 do plano de observabilidade, Fase 6).
 *
 * **Lê o último evento da etapa 9.5 — nunca roda a suíte.** Atualizar a aba
 * de segurança não pode disparar doze consultas agregadas numa instância de
 * 0.1 vCPU; a suíte roda uma vez por run, e é o pipeline quem paga. O que a
 * rota responde é o que a etapa gravou, com a hora e o run em que rodou.
 *
 * `data: null` é "nenhuma verificação ainda" — o estado do primeiro deploy,
 * antes de o primeiro run com a etapa acontecer. É diferente de 404 (a rota
 * não existe na API que está no ar, armadilha 37) e de 500 (o `context` do
 * evento não parseia): a tela desenha três coisas diferentes.
 *
 * A proteção é do grupo (`routes/admin/index.ts`): esta rota não registra
 * `authPlugin` nem chama `requireAdmin`, e é assim que nasce protegida.
 */
export async function adminInvariantsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        summary: 'The latest invariants report — the stage 9.5 event of the most recent run',
        tags: ['admin'],
        response: {
          200: invariantReportResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async () => {
      return { data: await getLatestInvariantReport() };
    },
  );
}
