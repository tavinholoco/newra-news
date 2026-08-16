import { z } from 'zod';

export const upsertBodySchema = z.object({
  email: z.string().email(),
  // OAuth providers (Google/GitHub) podem enviar name/image nulos
  name: z.string().max(200).nullable().optional(),
  image: z.string().max(2000).nullable().optional(),
});

export const upsertResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    image: z.string().nullable(),
    role: z.enum(['USER', 'ADMIN']),
  }),
});

export { errorResponseSchema } from '../../utils/schemas';
