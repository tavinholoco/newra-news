import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { renormalizeStoredNews } from '../../services/news-renormalizer.service';
import { assertJobSecret } from '../../utils/job-secret';
import {
  renormalizeBodySchema,
  renormalizeResponseSchema,
  errorResponseSchema,
} from './schemas';

/**
 * Reaplica as regras de ingestão ao acervo já gravado.
 *
 * **`dryRun` é o padrão.** Gravar exige `{"dryRun": false}` explícito no corpo,
 * e a resposta do ensaio traz a amostra das reclassificações justamente para
 * ser lida antes disso. É mutação em massa de conteúdo publicado: o caminho
 * seguro tem de ser o que se toma por omissão.
 *
 * **`categoryMode` é `clear-only` por padrão**, e pelo mesmo motivo: medido
 * contra o acervo de produção, remover rótulo que a evidência não sustenta
 * acerta sempre, e atribuir rótulo novo a partir de um corpo longo erra perto
 * de metade das vezes. Ver `CategoryMode` no serviço.
 *
 * Fica atrás do `JOB_SECRET`, como o `daily-pipeline`, e não do guard de ADMIN:
 * é operação de manutenção do pipeline, não ação de produto. Por isso também
 * não ganhou botão no painel — o raio de alcance não combina com um clique.
 */
export async function renormalizeJobRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/renormalize-news',
    {
      // Mesmo teto do `daily-pipeline`. O que protege esta rota é o
      // `JOB_SECRET` mais o `dryRun` padrão; o limitador só evita marteladas.
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        body: renormalizeBodySchema,
        response: {
          200: renormalizeResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      assertJobSecret(request);

      const report = await renormalizeStoredNews({
        dryRun: request.body.dryRun,
        limit: request.body.limit,
        sources: request.body.sources,
        categoryMode: request.body.categoryMode,
      });

      return { data: report };
    },
  );
}
