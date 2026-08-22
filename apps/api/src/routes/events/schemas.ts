import { z } from 'zod';
import {
  AD_FORMATS,
  AD_PLACEMENTS,
  CONTENT_TYPES,
  EVENT_SOURCES,
  PRODUCT_EVENT_BATCH_MAX,
  SEARCH_QUERY_MAX_LENGTH,
  SHARE_CHANNELS,
  Category,
  type ProductEvent,
} from '@newranews/types';

// `Category` de `@newranews/types` e nao o do Prisma: este valor vai para o
// `payload` JSON, nunca para uma coluna enum. Validar contra o do Prisma
// daria a uniao de literais, que o TypeScript recusa contra o enum
// compartilhado -- e a assercao de deriva abaixo pegou isso na primeira
// execucao. A ponte entre os dois enums continua onde sempre esteve, no
// `editorial.mapper`, e aqui nao ha ponte a fazer.
const categorySchema = z.nativeEnum(Category);
const sourceSchema = z.enum(EVENT_SOURCES);
const contentTypeSchema = z.enum(CONTENT_TYPES);

/**
 * O que `track()` anexa, validado com o mesmo rigor do payload.
 *
 * **`path` recusa query string.** A query carrega o termo de busca, e o termo
 * já tem regra própria de higiene abaixo — deixá-lo entrar por aqui seria a
 * mesma informação por uma porta sem porteiro.
 */
const baseSchema = z.object({
  sessionId: z.string().uuid(),
  locale: z.string().min(2).max(10),
  path: z
    .string()
    .min(1)
    .max(512)
    .refine((value) => !value.includes('?'), {
      message: 'path must not carry a query string',
    }),
  occurredAt: z.string().datetime(),
});

/**
 * A união discriminada dos 14 eventos (§3 dos slots).
 *
 * `discriminatedUnion` e não `union`: com ela o Zod escolhe o ramo pelo `type`
 * e devolve o erro do campo que faltou. Um `union` simples devolveria os
 * catorze erros de uma vez, e ninguém descobriria qual era o evento.
 */
const payloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('homepage_view') }),
  z.object({
    type: z.literal('story_open'),
    storyId: z.string().min(1).max(64),
    category: categorySchema,
    position: z.number().int().min(0).max(500),
    source: sourceSchema,
  }),
  z.object({
    type: z.literal('briefing_open'),
    briefingId: z.string().min(1).max(64),
    date: z.string().min(1).max(32),
    source: sourceSchema,
  }),
  z.object({
    type: z.literal('category_view'),
    category: categorySchema,
    origin: sourceSchema,
  }),
  z.object({
    type: z.literal('search'),
    // O truncamento acontece no cliente; aqui é o teto que o servidor aceita,
    // e ele existe porque o cliente é editável.
    query: z.string().max(SEARCH_QUERY_MAX_LENGTH),
    resultCount: z.number().int().min(0),
  }),
  z.object({
    type: z.enum(['article_scroll_25', 'article_scroll_50', 'article_scroll_90']),
    contentId: z.string().min(1).max(64),
    contentType: contentTypeSchema,
  }),
  z.object({
    type: z.literal('favorite_add'),
    storyId: z.string().min(1).max(64),
    category: categorySchema,
    origin: sourceSchema,
  }),
  z.object({
    type: z.literal('share'),
    contentId: z.string().min(1).max(64),
    contentType: contentTypeSchema,
    channel: z.enum(SHARE_CHANNELS),
  }),
  z.object({ type: z.literal('newsletter_signup'), origin: sourceSchema }),
  z.object({
    type: z.literal('ad_view'),
    placement: z.enum(AD_PLACEMENTS),
    format: z.enum(AD_FORMATS),
  }),
  z.object({
    type: z.literal('ad_click'),
    placement: z.enum(AD_PLACEMENTS),
    format: z.enum(AD_FORMATS),
  }),
  z.object({
    type: z.literal('subscription_intent'),
    origin: sourceSchema,
    plan: z.string().min(1).max(32),
  }),
]);

export const productEventSchema = z.intersection(baseSchema, payloadSchema);

/**
 * **A guarda contra a deriva entre o Zod e o tipo compartilhado.**
 *
 * Os dois descrevem o mesmo contrato em linguagens diferentes: o tipo em
 * `packages/types` é o que o web escreve, e este schema é o que a API aceita.
 * Um campo acrescentado só de um lado passa pelo build dos dois e só aparece
 * como 400 em produção. Esta linha não gera código nenhum — ela falha o
 * `typecheck` no instante em que os dois discordarem.
 */
export type SchemaMatchesSharedType = z.infer<
  typeof productEventSchema
> extends ProductEvent
  ? ProductEvent extends z.infer<typeof productEventSchema>
    ? true
    : never
  : never;
const _schemaMatchesSharedType: SchemaMatchesSharedType = true;
void _schemaMatchesSharedType;

/**
 * O corpo aceito: **sempre um lote**, mesmo de um evento só.
 *
 * `track()` enfileira e despacha com `sendBeacon`, que não tem retorno e não
 * deve ser chamado uma vez por clique. Uma forma só de corpo também evita dois
 * caminhos de validação para a mesma coisa.
 */
export const ingestEventsBodySchema = z.object({
  events: z.array(productEventSchema).min(1).max(PRODUCT_EVENT_BATCH_MAX),
});

export const ingestEventsResponseSchema = z.object({
  data: z.object({ accepted: z.number().int() }),
});

export const errorResponseSchema = z.object({ error: z.string() });
