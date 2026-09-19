import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { deleteNews } from '../../services/news.service';
import { recordAuditEvent } from '../../services/audit.service';
import { NotFoundError } from '../../utils/errors';
import { authPlugin, requireAdmin, requireSubject } from '../../plugins/auth';
import {
  newsParamsSchema,
  deleteNewsResponseSchema,
  errorResponseSchema,
} from './schemas';

export async function newsAdminRoutes(app: FastifyInstance) {
  // authPlugin encapsulado aqui: só esta rota exige JWT (o GET /:id público
  // vive em routes/news/[id].ts, fora deste contexto)
  await app.register(authPlugin);

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:id',
    {
      schema: {
        params: newsParamsSchema,
        response: {
          200: deleteNewsResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      // O JWT é assinado pelo frontend com o role vindo da sessão (que segue
      // ADMIN_EMAILS); só ADMIN pode deletar notícias.
      requireAdmin(request);
      // O ator antes da ação: sessão sem `sub` recusa **antes** de apagar,
      // porque uma exclusão que não pode ser atribuída é o que a trilha existe
      // para impedir.
      const actorId = requireSubject(request);

      const deleted = await deleteNews(request.params.id);

      /**
       * **Quem apagou o quê — a trilha da Fase 5.** Até aqui `request.user.sub`
       * chegava a este handler e morria com a resposta; a linha de log do Render
       * era o único outro registro. A linha sai nos dois desfechos, e o
       * `outcome` separa "clicou" de "aconteceu": um 404 aqui é um admin
       * tentando apagar o que já não existe, e isso também é ação.
       *
       * `await`, e não fire-and-forget: a escrita nunca lança (ver o service)
       * e o banco acabou de responder ao `delete` — o custo é uma ida a mais
       * ao mesmo banco, e o ganho é o teste poder afirmar que a linha existe
       * quando a resposta sai.
       */
      await recordAuditEvent({
        actorId,
        action: 'news.deleted',
        targetId: request.params.id,
        outcome: deleted ? 'deleted' : 'not-found',
        requestId: request.id,
      });

      if (!deleted) throw new NotFoundError('News');

      return { data: { deleted: true, id: request.params.id } };
    },
  );
}
