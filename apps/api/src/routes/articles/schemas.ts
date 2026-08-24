import { z } from 'zod';
import type {
  ApiResponse,
  Article,
  ArticleWithSources,
  PaginatedResponse,
} from '@newranews/types';
import { assertContract } from '../../utils/contract';

export const listArticlesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const articleDateParamsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

/**
 * Auditoria da geração (§18.4 do plano V2), vinda da migration
 * `add_daily_briefing_metadata`.
 *
 * **Estava sendo buscada e descartada.** O serviço já lia estas colunas desde a
 * Fase 0.5, mas o schema de resposta era o da V1 — e o `fastify-type-provider-zod`
 * serializa **pelo schema**, então os quatro campos morriam na saída. A §8 pede
 * modelo, versão do prompt e horário de geração na área "como este briefing foi
 * produzido"; sem eles a seção não tem o que exibir.
 *
 * Os três primeiros são nulos nos artigos anteriores à migration: não havia como
 * preenchê-los retroativamente, e a tela precisa desenhar sem eles.
 */
const articleAuditFields = {
  generatedAt: z.string().datetime().nullable(),
  promptVersion: z.string().nullable(),
  modelVersion: z.string().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'FAILED']),
};

export const articleItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  summary: z.string(),
  date: z.string().datetime(),
  newsCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ...articleAuditFields,
});

/**
 * Uma notícia que entrou no briefing, na ordem em que foi enviada à IA.
 *
 * `position` é **0-based** — é o índice do `map` sobre as selecionadas, no
 * pipeline. Numerar a lista na tela pede `position + 1`.
 *
 * `newsId` é ponteiro fraco: nulo quando não resolveu na gravação, e obsoleto
 * depois que o cleanup apaga a `News` aos 30 dias — o briefing vive 90. Por isso
 * `title`, `source` e `sourceUrl` são **cópias** e não um join: a lista de
 * fontes precisa continuar exibível depois que as notícias saírem do acervo.
 */
export const briefingSourceSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
  newsId: z.string().uuid().nullable(),
});

/**
 * O artigo com a lista de fontes — só nos endpoints de **detalhe**.
 *
 * Na listagem seriam ~15 linhas por artigo sem nada as exibindo, e a `/article`
 * pagina de 10 em 10: 150 objetos de peso morto por página.
 */
export const articleWithSourcesSchema = articleItemSchema.extend({
  sources: z.array(briefingSourceSchema),
});

export const listArticlesResponseSchema = z.object({
  data: z.array(articleItemSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const getArticleResponseSchema = z.object({
  data: articleWithSourcesSchema,
});

/**
 * **É a rota onde a deriva já custou um dia de produção** (Fase 5): o serviço
 * carregava os quatro campos de auditoria e as ~15 fontes, o schema era o da V1
 * e o serializador descartava tudo em silêncio, com a `docs/api.md` descrevendo
 * o comportamento certo. As duas linhas abaixo teriam reprovado o `typecheck`
 * naquele dia.
 */
assertContract<typeof listArticlesResponseSchema, PaginatedResponse<Article>>(true);
assertContract<typeof getArticleResponseSchema, ApiResponse<ArticleWithSources>>(true);

export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;
export type ListArticlesResponse = z.infer<typeof listArticlesResponseSchema>;
export type ArticleDateParams = z.infer<typeof articleDateParamsSchema>;
export type GetArticleResponse = z.infer<typeof getArticleResponseSchema>;

export { errorResponseSchema } from '../../utils/schemas';
