import { z } from 'zod';
import type { ApiResponse, AuditTrail, ErrorSummary } from '@newranews/types';
import { assertContract } from '../../utils/contract';
import { AUDIT_LIST_DEFAULT, AUDIT_LIST_MAX } from '../../services/audit.service';

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

assertContract<typeof errorSummaryResponseSchema, ApiResponse<ErrorSummary>>(true);
assertContract<typeof auditTrailResponseSchema, ApiResponse<AuditTrail>>(true);

export { errorResponseSchema } from '../../utils/schemas';
