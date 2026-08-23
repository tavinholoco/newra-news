import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  sendDailyNewsletter,
} from '../../services/newsletter.service';
import { assertJobSecret } from '../../utils/job-secret';
import {
  subscribeBodySchema,
  subscribeResponseSchema,
  unsubscribeQuerySchema,
  unsubscribeResponseSchema,
  sendNewsletterResponseSchema,
  errorResponseSchema,
} from './schemas';

export async function newsletterRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/subscribe',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        body: subscribeBodySchema,
        response: { 200: subscribeResponseSchema },
      },
    },
    async (request) => {
      const subscriber = await subscribeToNewsletter(request.body.email);
      return {
        data: {
          ...subscriber,
          createdAt: subscriber.createdAt.toISOString(),
          updatedAt: subscriber.updatedAt.toISOString(),
        },
      };
    },
  );

  typed.get(
    '/unsubscribe',
    {
      schema: {
        querystring: unsubscribeQuerySchema,
        response: { 200: unsubscribeResponseSchema },
      },
    },
    async (request) => {
      const unsubscribed = await unsubscribeFromNewsletter(request.query.token);
      return { data: { unsubscribed } };
    },
  );

  typed.post(
    '/send',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        response: {
          200: sendNewsletterResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      assertJobSecret(request);
      const result = await sendDailyNewsletter();
      return { data: result };
    },
  );
}
