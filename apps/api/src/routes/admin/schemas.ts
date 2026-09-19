import { z } from 'zod';
import type {
  ApiResponse,
  AuditTrail,
  ErrorSummary,
  InvariantReport,
  SourceHealthReport,
} from '@newranews/types';
import { assertContract } from '../../utils/contract';
import { AUDIT_LIST_DEFAULT, AUDIT_LIST_MAX } from '../../services/audit.service';
import { invariantRunSchema } from '../../services/invariants.service';
import {
  SOURCE_HEALTH_WINDOW_DEFAULT_DAYS,
  SOURCE_HEALTH_WINDOW_MAX_DAYS,
} from '../../services/source-health.service';

/**
 * As duas leituras da aba de segurança (§9 do plano de observabilidade, 5b).
 *
 * **O schema é o contrato**: o serializador do `fastify-type-provider-zod`
 * descarta o que não está declarado, sem erro — foi assim que a auditoria do
 * briefing ficou invisível por um dia. Por isso os dois têm `assertContract`
 * contra o tipo compartilhado, e o `shared-type-contract.test.ts` cobra que
 * continuem tendo.
 */

const errorOriginSchema = z.enum(['API', 'PIPELINE', 'WEB', 'INVARIANT']);
const errorSeveritySchema = z.enum(['WARN', 'ERROR', 'FATAL']);

export const errorSummaryQuerySchema = z.object({
  window: z.enum(['24h', '7d']).default('24h'),
});

const errorGroupSchema = z.object({
  fingerprint: z.string(),
  origin: errorOriginSchema,
  severity: errorSeveritySchema,
  code: z.string(),
  category: z.string(),
  route: z.string().nullable(),
  statusCode: z.number().int().nullable(),
  message: z.string(),
  count: z.number().int(),
  hours: z.number().int(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  lastRequestId: z.string().nullable(),
  pipelineLogId: z.string().nullable(),
});

export const errorSummarySchema = z.object({
  window: z.object({
    key: z.enum(['24h', '7d']),
    hours: z.number().int(),
    since: z.string(),
    until: z.string(),
  }),
  total: z.number().int(),
  distinctFingerprints: z.number().int(),
  byCategory: z.array(z.object({ category: z.string(), count: z.number().int() })),
  bySeverity: z.array(z.object({ severity: errorSeveritySchema, count: z.number().int() })),
  byOrigin: z.array(z.object({ origin: errorOriginSchema, count: z.number().int() })),
  groups: z.array(errorGroupSchema),
  truncated: z.boolean(),
});

export const errorSummaryResponseSchema = z.object({ data: errorSummarySchema });

export const auditTrailQuerySchema = z.object({
  // 365 é a retenção: pedir mais devolveria uma janela que o expurgo já
  // esvaziou, e a tela mostraria queda onde houve apagamento.
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(AUDIT_LIST_MAX).default(AUDIT_LIST_DEFAULT),
});

export const auditEventSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string(),
  action: z.string(),
  targetId: z.string().nullable(),
  outcome: z.string().nullable(),
  requestId: z.string().nullable(),
  context: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
});

export const auditTrailSchema = z.object({
  window: z.object({ days: z.number().int(), since: z.string() }),
  total: z.number().int(),
  events: z.array(auditEventSchema),
});

export const auditTrailResponseSchema = z.object({ data: auditTrailSchema });

/**
 * A saúde por fonte (§15 do plano de observabilidade, Fase 11 — PR 11b).
 *
 * O enum tem **três** valores, e o web deriva "não tentada" pela ausência de
 * linha num dia — o schema não declara um quarto valor que a API nunca emite.
 */
export const sourceHealthQuerySchema = z.object({
  // O teto é a retenção: pedir mais devolveria dias que o expurgo já esvaziou.
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(SOURCE_HEALTH_WINDOW_MAX_DAYS)
    .default(SOURCE_HEALTH_WINDOW_DEFAULT_DAYS),
});

const sourceKindSchema = z.enum(['RSS', 'AGGREGATOR']);
const sourceOutcomeSchema = z.enum(['OK', 'EMPTY', 'FAILED']);

export const sourceDaySchema = z.object({
  day: z.string(),
  outcome: sourceOutcomeSchema,
  fetched: z.number().int(),
  kept: z.number().int(),
  latencyMs: z.number().int().nullable(),
  failureReason: z.string().nullable(),
  pipelineLogId: z.string().nullable(),
});

export const sourceSeriesSchema = z.object({
  source: z.string(),
  kind: sourceKindSchema,
  days: z.array(sourceDaySchema),
});

export const sourceHealthReportSchema = z.object({
  window: z.object({ days: z.number().int(), since: z.string(), until: z.string() }),
  sources: z.array(sourceSeriesSchema),
});

export const sourceHealthResponseSchema = z.object({ data: sourceHealthReportSchema });

/**
 * As invariantes (§10 do plano de observabilidade, Fase 6).
 *
 * O schema do relatório é **o mesmo com que a etapa 9.5 grava e a leitura
 * parseia** (`invariantRunSchema`, no service) mais os dois campos que vêm do
 * evento — é assim que "o que sai pela rota é o que foi gravado" deixa de ser
 * promessa. `data` é `null` antes do primeiro run com a etapa: "nenhuma
 * verificação ainda" é estado, não erro.
 */
export const invariantReportSchema = invariantRunSchema.extend({
  checkedAt: z.string(),
  pipelineLogId: z.string(),
});

export const invariantReportResponseSchema = z.object({ data: invariantReportSchema.nullable() });

assertContract<typeof errorSummaryResponseSchema, ApiResponse<ErrorSummary>>(true);
assertContract<typeof auditTrailResponseSchema, ApiResponse<AuditTrail>>(true);
assertContract<typeof sourceHealthResponseSchema, ApiResponse<SourceHealthReport>>(true);
assertContract<typeof invariantReportResponseSchema, ApiResponse<InvariantReport | null>>(true);

export { errorResponseSchema } from '../../utils/schemas';
