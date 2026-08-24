import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { upsertUser } from '../../services/user.service';
import { UnauthorizedError } from '../../utils/errors';
import { authPlugin } from '../../plugins/auth';
import { upsertBodySchema, upsertResponseSchema } from './schemas';

export async function authRoutes(app: FastifyInstance) {
  // Token de uso único do primeiro sign-in: o `purpose` é conferido no plugin,
  // que recusa aqui o token de sessão e recusa nas outras rotas o token daqui.
  await app.register(authPlugin, { purpose: 'auth-upsert' });

  app.withTypeProvider<ZodTypeProvider>().post(
    '/upsert',
    {
      schema: {
        body: upsertBodySchema,
        response: { 200: upsertResponseSchema },
      },
    },
    async (request) => {
      // O `purpose` já foi conferido no plugin; o que sobra para o handler é a
      // ligação entre o token e o corpo — sem ela, um token válido criaria
      // usuário para outro e-mail.
      if (request.user?.email !== request.body.email.trim().toLowerCase()) {
        throw new UnauthorizedError('Invalid or missing token');
      }

      const user = await upsertUser({
        email: request.body.email,
        name: request.body.name,
        image: request.body.image,
      });

      return {
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        },
      };
    },
  );
}
