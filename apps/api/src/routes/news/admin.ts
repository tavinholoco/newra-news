import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { deleteNews } from '../../services/news.service';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import { authPlugin } from '../../plugins/auth';
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
      if (request.user?.role !== 'ADMIN') {
        throw new ForbiddenError('Admin access required');
      }

      const deleted = await deleteNews(request.params.id);
      if (!deleted) throw new NotFoundError('News');

      return { data: { deleted: true, id: request.params.id } };
    },
  );
}
