import { z } from 'zod';
import { categorySchema } from '../news/schemas';

export const themePreferenceSchema = z.enum(['LIGHT', 'DARK', 'SYSTEM']);

export const preferencesSchema = z.object({
  categories: z.array(categorySchema),
  theme: themePreferenceSchema,
});

/**
 * Corpo do `PUT`: os dois campos são opcionais, e **campo ausente não é campo
 * apagado**. A tela pode salvar só o que o leitor mexeu sem que a escolha
 * anterior desapareça junto.
 */
export const updatePreferencesBodySchema = z
  .object({
    categories: z.array(categorySchema).max(8).optional(),
    theme: themePreferenceSchema.optional(),
  })
  .refine(
    (body) => body.categories !== undefined || body.theme !== undefined,
    { message: 'Nothing to update' },
  );

export const preferencesResponseSchema = z.object({ data: preferencesSchema });

export const newsletterStatusSchema = z.object({
  subscribed: z.boolean(),
  /** O e-mail inscrito, que pode não ser o do login. */
  email: z.string().email().nullable(),
});

export const updateNewsletterBodySchema = z.object({
  subscribed: z.boolean(),
});

export const newsletterStatusResponseSchema = z.object({
  data: newsletterStatusSchema,
});

export const accountOverviewResponseSchema = z.object({
  data: z.object({
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      name: z.string().nullable(),
      image: z.string().nullable(),
      role: z.enum(['USER', 'ADMIN']),
      createdAt: z.string().datetime(),
    }),
    preferences: preferencesSchema,
    newsletter: newsletterStatusSchema,
    saved: z.object({
      news: z.number().int(),
      articles: z.number().int(),
    }),
  }),
});

export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBodySchema>;
export type UpdateNewsletterBody = z.infer<typeof updateNewsletterBodySchema>;

export { errorResponseSchema } from '../../utils/schemas';
