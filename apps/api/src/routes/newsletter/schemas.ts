import { z } from 'zod';
import type { ApiResponse, Subscriber } from '@newranews/types';
import { assertContract } from '../../utils/contract';

const subscriberItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  status: z.enum(['ACTIVE', 'UNSUBSCRIBED']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const subscribeBodySchema = z.object({
  email: z.string().email(),
});

export const subscribeResponseSchema = z.object({
  data: subscriberItemSchema,
});

export const unsubscribeQuerySchema = z.object({
  token: z.string().min(1),
});

export const unsubscribeResponseSchema = z.object({
  data: z.object({ unsubscribed: z.boolean() }),
});

export const sendNewsletterResponseSchema = z.object({
  data: z.object({
    total: z.number().int(),
    sent: z.number().int(),
    failed: z.number().int(),
  }),
});

assertContract<typeof subscribeResponseSchema, ApiResponse<Subscriber>>(true);

export { errorResponseSchema } from '../../utils/schemas';
