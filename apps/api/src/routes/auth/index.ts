import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { upsertUser } from '../../services/user.service';
import { UnauthorizedError } from '../../utils/errors';
import { authPlugin } from '../../plugins/auth';
import { upsertBodySchema, upsertResponseSchema } from './schemas';

export async function authRoutes(app: FastifyInstance) {
  await app.register(authPlugin);

  app.withTypeProvider<ZodTypeProvider>().post(
    '/upsert',
    {
      schema: {
        body: upsertBodySchema,
        response: { 200: upsertResponseSchema },
      },
    },
    async (request) => {
      // Token com purpose 'auth-upsert' e e-mail do corpo batendo com o do JWT
      // (evita que um token de usuário comum chame este endpoint para outro e-mail)
      if (
        request.user?.purpose !== 'auth-upsert' ||
        request.user.email !== request.body.email.trim().toLowerCase()
      ) {
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
