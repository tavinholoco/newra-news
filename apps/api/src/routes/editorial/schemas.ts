import { z } from 'zod';
import type {
  ApiResponse,
  DailyBriefing,
  EditorialStory,
  HomeResponse,
} from '@newranews/types';
import { assertContract } from '../../utils/contract';

const CATEGORIES = [
  'TECHNOLOGY',
  'POLITICS',
  'ECONOMY',
  'SPORTS',
  'SCIENCE',
  'ENTERTAINMENT',
  'WORLD',
  'HEALTH',
] as const;

/**
 * `EditorialStory` — a notícia na perspectiva da composição (§2 dos
 * contratos).
 *
 * `isFeatured` e `isTrending` são opcionais e só aparecem quando verdadeiros:
 * mandá-los como `false` em toda matéria triplicaria o ruído da resposta sem
 * dizer nada que a ausência já não diga.
 */
export const editorialStorySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  dek: z.string().nullable(),
  imageUrl: z.string().nullable(),
  category: z.enum(CATEGORIES),
  source: z.string(),
  sourceUrl: z.string(),
  publishedAt: z.string(),
  updatedAt: z.string().nullable(),
  readingTimeMinutes: z.number().int().nullable(),
  isFeatured: z.boolean().optional(),
  isTrending: z.boolean().optional(),
});

const briefingSourceSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
  newsId: z.string().uuid().nullable(),
});

export const dailyBriefingSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  title: z.string(),
  summary: z.string(),
  sourceCount: z.number().int(),
  readingTimeMinutes: z.number().int(),
  generatedAt: z.string().nullable(),
  aiDisclosure: z.boolean(),
  sources: z.array(briefingSourceSchema),
});

export const homeQuerySchema = z.object({
  /** Reservado: o acervo é único hoje, mas a Home é servida nos dois idiomas. */
  locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
  categories: z.coerce.number().int().min(1).max(8).default(4),
});

export const homeResponseSchema = z.object({
  data: z.object({
    hero: editorialStorySchema.nullable(),
    briefing: dailyBriefingSchema.nullable(),
    topStories: z.array(editorialStorySchema),
    trending: z.array(editorialStorySchema),
    latest: z.array(editorialStorySchema),
    categories: z.array(
      z.object({
        category: z.enum(CATEGORIES),
        stories: z.array(editorialStorySchema),
      }),
    ),
  }),
});

export const trendingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  window: z.enum(['24h', '7d']).default('24h'),
});

export const relatedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(4),
});

export const editorialStoryListSchema = z.object({
  data: z.array(editorialStorySchema),
});

/**
 * As três respostas editoriais contra os tipos que a Home e as listagens leem.
 *
 * `editorialStorySchema` e `dailyBriefingSchema` são conferidos à parte dos
 * envelopes porque são reusados: a `/home`, a `/trending` e a `/news/:id/related`
 * servem a mesma peça, e um campo perdido aqui apareceria em três telas.
 */
assertContract<typeof editorialStorySchema, EditorialStory>(true);
assertContract<typeof dailyBriefingSchema, DailyBriefing>(true);
assertContract<typeof homeResponseSchema, ApiResponse<HomeResponse>>(true);
assertContract<typeof editorialStoryListSchema, ApiResponse<EditorialStory[]>>(true);

export { errorResponseSchema } from '../../utils/schemas';
