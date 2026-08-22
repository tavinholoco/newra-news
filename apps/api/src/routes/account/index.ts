import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  getAccountOverview,
  getPreferences,
  updatePreferences,
} from '../../services/account.service';
import {
  findSubscriberForUser,
  subscribeUser,
  unsubscribeUser,
} from '../../services/newsletter.service';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { authPlugin } from '../../plugins/auth';
import {
  accountOverviewResponseSchema,
  errorResponseSchema,
  newsletterStatusResponseSchema,
  preferencesResponseSchema,
  updateNewsletterBodySchema,
  updatePreferencesBodySchema,
} from './schemas';

/**
 * O ecossistema de conta (§19 do plano V2).
 *
 * Toda rota daqui responde **por usuário** e por isso nenhuma leva
 * `Cache-Control` — é o que `utils/cache.ts` documenta como motivo de o header
 * ser por rota e não um hook global.
 */
export async function accountRoutes(app: FastifyInstance) {
  await app.register(authPlugin);

  const sessionOf = (user?: { sub?: string; email?: string }) => {
    if (!user?.sub || !user.email) throw new UnauthorizedError('Invalid or missing token');
    return { userId: user.sub, email: user.email };
  };

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        response: { 200: accountOverviewResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const { userId } = sessionOf(request.user);
      const overview = await getAccountOverview(userId);
      if (!overview) throw new NotFoundError('User');

      return {
        data: {
          ...overview,
          user: {
            ...overview.user,
            createdAt: overview.user.createdAt.toISOString(),
          },
        },
      };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/preferences',
    { schema: { response: { 200: preferencesResponseSchema } } },
    async (request) => {
      const { userId } = sessionOf(request.user);
      return { data: await getPreferences(userId) };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    '/preferences',
    {
      schema: {
        body: updatePreferencesBodySchema,
        response: { 200: preferencesResponseSchema },
      },
    },
    async (request) => {
      const { userId } = sessionOf(request.user);
      return { data: await updatePreferences(userId, request.body) };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    '/newsletter',
    {
      schema: {
        body: updateNewsletterBodySchema,
        response: { 200: newsletterStatusResponseSchema },
      },
    },
    async (request) => {
      const { userId, email } = sessionOf(request.user);

      if (request.body.subscribed) {
        const subscriber = await subscribeUser(userId, email);
        return { data: { subscribed: true, email: subscriber.email } };
      }

      await unsubscribeUser(userId, email);
      // Relê em vez de assumir: quem nunca se inscreveu continua sem e-mail
      // nenhum a mostrar, e quem cancelou vê qual endereço saiu da lista.
      const subscriber = await findSubscriberForUser(userId, email);

      return {
        data: {
          subscribed: subscriber?.status === 'ACTIVE',
          email: subscriber?.email ?? null,
        },
      };
    },
  );
}
