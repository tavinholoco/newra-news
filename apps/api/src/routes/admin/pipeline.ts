import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  getDevLogDetail,
  getDevLogs,
} from '../../services/pipeline-event.service';
import { NotFoundError } from '../../utils/errors';
import {
  devLogDetailResponseSchema,
  devLogsQuerySchema,
  devLogsResponseSchema,
} from '../dev/schemas';
// Do arquivo em que ele mora, e não pela reexportação do `dev/schemas`: o que
// esta rota compartilha com o painel dev são os schemas do pipeline, e mais nada.
import { errorResponseSchema } from '../../utils/schemas';

/**
 * O pipeline diário, para quem consegue entrar. (§6 do plano de observabilidade)
 *
 * **Zero tabela nova, zero consulta nova.** `getDevLogs` e `getDevLogDetail`
 * são os mesmos desde a Fase 9, e os dois schemas de resposta também — o que a
 * Fase 2 acrescenta é **a porta**. O dono do produto não conseguia ver, de
 * nenhuma superfície em que conseguisse entrar, que o run de ontem falhou na
 * etapa 6, o que o erro dizia, ou que ele falha há três dias: o dado existia e
 * só o `JOB_SECRET` o alcançava.
 *
 * ## Por que um prefixo `/api/admin` novo, e não mais uma rota em `/api/metrics`
 *
 * Porque **`authPlugin` e `requireAdmin` registram uma vez no grupo**, e isso
 * faz de "tudo sob `/api/admin` é ADMIN" uma garantia **estrutural** em vez de
 * hábito por rota. É o mesmo argumento que o `admin/layout.tsx` faz do lado do
 * web, e ele tem guarda dos dois lados: aqui, o
 * `authorization-matrix.test.ts` enumera o `printRoutes()`, filtra o prefixo e
 * cobra `access: 'admin'` de cada rota.
 *
 * **Desde a Fase 5 o grupo é `routes/admin/index.ts`**, e não este arquivo:
 * com três subgrupos sob o prefixo, as duas linhas de proteção moram no pai e
 * os filhos herdam o `preHandler`. Este arquivo não registra auth nenhuma —
 * e é assim que deve ser lido: rota aqui nasce protegida porque está aqui.
 *
 * O efeito colateral bom é que o caminho do BFF e o da API finalmente têm o
 * mesmo nome: `/api/admin/pipeline/runs` dos dois lados.
 *
 * ## O `/api/dev/*` fica intacto, e é decisão
 *
 * Acesso por segredo é o caminho que funciona **quando não há sessão** — e isso
 * importa mais justamente quando o que quebrou é o provedor de sessão. As duas
 * portas dão na mesma consulta e devolvem a mesma forma; duplicar o schema para
 * a porta nova criaria dois lugares para descrever o mesmo `PipelineLog`.
 *
 * Rate limit: o global de 100/min. O teto de 60/min do `/api/dev/logs` existe
 * porque aquela porta é alcançável com um segredo e sem sessão; esta já custa
 * um JWT de admin válido.
 */
export async function adminPipelineRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/runs',
    {
      schema: {
        summary: 'Pipeline runs for the admin panel',
        tags: ['admin'],
        querystring: devLogsQuerySchema,
        response: {
          200: devLogsResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const { status, since, limit } = request.query;
      const logs = await getDevLogs({ status, sinceDays: since, limit });

      return {
        data: { runs: logs.runs, recentErrors: logs.recentErrors },
        meta: { total: logs.total },
      };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/runs/:pipelineId',
    {
      schema: {
        summary: 'One pipeline run, with its per-stage events',
        tags: ['admin'],
        params: z.object({ pipelineId: z.string().uuid() }),
        response: {
          200: devLogDetailResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const { pipelineId } = request.params;
      const detail = await getDevLogDetail(pipelineId);
      if (!detail) throw new NotFoundError('Pipeline');

      return { data: detail };
    },
  );
}
