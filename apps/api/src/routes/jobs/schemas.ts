import { z } from 'zod';

export const jobTriggerResponseSchema = z.object({
  status: z.literal('started'),
  pipelineId: z.string().uuid(),
});

export type JobTriggerResponse = z.infer<typeof jobTriggerResponseSchema>;

export const pipelineStatusResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: z.enum(['RUNNING', 'SUCCESS', 'FAILED']),
    newsCount: z.number().int(),
    articleId: z.string().uuid().nullable(),
    error: z.string().nullable(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
  }),
});

export type PipelineStatusResponse = z.infer<typeof pipelineStatusResponseSchema>;

const categorySchema = z.enum([
  'TECHNOLOGY',
  'POLITICS',
  'ECONOMY',
  'SPORTS',
  'SCIENCE',
  'ENTERTAINMENT',
  'WORLD',
  'HEALTH',
]);

/**
 * `dryRun` tem default `true` **no schema**, e não só no serviço.
 *
 * Corpo vazio, corpo sem a chave e corpo com `{"dryRun": true}` têm de
 * significar a mesma coisa: não grave nada. Deixar o default só na camada de
 * baixo faria a rota depender de a chave chegar como `undefined` e não como
 * `null` — distinção que ninguém quer descobrir gravando em produção.
 */
export const renormalizeBodySchema = z
  .object({
    dryRun: z.boolean().default(true),
    limit: z.coerce.number().int().min(1).max(10_000).optional(),
    sources: z.array(z.string().min(1)).optional(),
    categoryMode: z.enum(['clear-only', 'all']).default('clear-only'),
  })
  .default({});

export const renormalizeResponseSchema = z.object({
  data: z.object({
    dryRun: z.boolean(),
    scanned: z.number().int(),
    textChanged: z.number().int(),
    categoryChanged: z.number().int(),
    categorySkipped: z.number().int(),
    transitions: z.array(
      z.object({
        from: categorySchema,
        to: categorySchema,
        count: z.number().int(),
      }),
    ),
    sample: z.array(
      z.object({
        id: z.string().uuid(),
        title: z.string(),
        from: categorySchema,
        to: categorySchema,
      }),
    ),
  }),
});

export type RenormalizeResponse = z.infer<typeof renormalizeResponseSchema>;

export { errorResponseSchema } from '../../utils/schemas';
