import { prisma } from '@newranews/database';
import type { PlanHoursReading } from '@newranews/types';
import { z } from 'zod';
import { AppError } from '../utils/errors';
import { baseLogger } from '../utils/logger';
import { writeAuditEvent, type AuditAction } from './audit.service';
import {
  getMonthUptimeSeconds,
  startOfUtcMonth,
  toPlanHours,
} from './uptime.service';

/**
 * **A leitura do Billing — Fase 13 do plano de observabilidade, 13b (§23).**
 *
 * O que fecha: o arco das horas da `/admin` dividia as horas **desta** API pelo
 * teto do **workspace** — e o workspace tem um segundo serviço free, o
 * `NetsheetEngine`, que em 05/10/2026 respondia por ~74 % das horas (124,27 h
 * no Billing contra 34,9 h do `DailyUptime`). Setembro estourou em 753,4 h com
 * o arco mostrando folga.
 *
 * ## Por que o número entra digitado — decidido pelo dono em 07/10/2026
 *
 * O Render **não expõe cobrança por API**: as horas free aparecem só no painel
 * de Billing, e só o total do workspace. O único sinal automático é a Metrics
 * API (`instance-count`), que ninguém confirmou que marca zero quando um
 * serviço free dorme — e a chave da API do Render **não tem escopo**: abre a
 * conta inteira (variáveis de ambiente com o `DATABASE_URL`, deploy, exclusão),
 * em todos os workspaces. Pô-la no processo que a internet alcança, ou no CI,
 * custa mais que o número compra. O dono lê o Billing e digita; a tela
 * extrapola entre uma leitura e outra, e diz de quando é a leitura.
 *
 * ## A linha de auditoria é o dado — sem migration
 *
 * Uma leitura é, por definição, uma ação de admin com ator e hora: a linha
 * `plan.hours_recorded` do `AuditEvent` **é** a leitura, com `{ workspaceHours,
 * apiHours }` no `context`. Uma tabela própria guardaria as mesmas quatro
 * colunas e pediria migration, rota de leitura e expurgo próprios. A retenção
 * de 365 dias sobra: só a leitura do mês corrente é lida.
 *
 * ## As duas pontas do mesmo instante
 *
 * A parte dos outros serviços é `workspaceHours − apiHours`, e só é honesta se
 * as duas forem do mesmo instante. Por isso a parte desta API é **gravada junto**
 * — reconstruí-la depois a partir do `DailyUptime` daria o dia, não a hora. Ela
 * é a soma do banco, que fica até um tique do heartbeat (5 min) atrás do
 * processo; o erro cai nos outros serviços, e é de no máximo 0,08 h.
 */

/**
 * O teto da entrada. O pool para em 750 h (setembro marcou 753,4 com o atraso
 * da suspensão), então mil é folga de sobra — e recusa o `12427` digitado no
 * lugar de `124,27`, que é o erro que este teto existe para pegar.
 */
export const MAX_WORKSPACE_HOURS = 1_000;

/** O literal da ação, tipado contra o tuple da auditoria. */
const READING_ACTION: AuditAction = 'plan.hours_recorded';

/** O `context` de uma leitura — o mesmo formato na escrita e na leitura. */
const readingContextSchema = z.object({
  workspaceHours: z.number().finite().min(0),
  apiHours: z.number().finite().min(0),
});

export interface RecordPlanHoursReadingInput {
  /** `User.id` de quem leu o Billing. */
  actorId: string;
  workspaceHours: number;
  requestId: string | null;
  now?: Date;
}

/**
 * Grava a leitura. **Lança** — na recusa (400) e na falha do banco: aqui a
 * escrita é a ação, e responder 201 sobre nada seria mentira.
 */
export async function recordPlanHoursReading(
  input: RecordPlanHoursReadingInput,
): Promise<PlanHoursReading> {
  const now = input.now ?? new Date();
  const apiHours = toPlanHours(await getMonthUptimeSeconds(now));

  if (input.workspaceHours < apiHours) {
    throw new AppError(
      `The reading is below the hours this API already recorded this month (${apiHours} h)`,
      400,
      {
        code: 'PLAN_READING_BELOW_API',
        category: 'validation',
        context: { workspaceHours: input.workspaceHours, apiHours },
      },
    );
  }

  const { createdAt } = await writeAuditEvent({
    actorId: input.actorId,
    action: 'plan.hours_recorded',
    targetId: null,
    outcome: 'recorded',
    requestId: input.requestId,
    context: { workspaceHours: input.workspaceHours, apiHours },
  });

  return {
    readAt: createdAt.toISOString(),
    workspaceHours: input.workspaceHours,
    apiHours,
  };
}

/**
 * A leitura mais recente **do mês de calendário de `now`** — o Billing zera no
 * dia 1º, e a leitura de setembro não fala de outubro. `null` sem leitura.
 *
 * Lança quando o banco recusa (quem chama decide: a saturação vira `null`
 * inteira, como as horas desta API). Uma linha cujo `context` não é uma
 * leitura é ignorada com `warn` — só esta API grava a ação, então isso seria
 * contrato quebrado entre dois pontos do mesmo arquivo, e a tela cai para
 * "só esta API" em vez de desenhar horas inventadas.
 */
export async function getLatestPlanHoursReading(now: Date = new Date()): Promise<PlanHoursReading | null> {
  const row = await prisma.auditEvent.findFirst({
    where: { action: READING_ACTION, createdAt: { gte: startOfUtcMonth(now) } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, context: true },
  });
  if (!row) return null;

  const parsed = readingContextSchema.safeParse(row.context);
  if (!parsed.success) {
    baseLogger.warn(
      { readAt: row.createdAt.toISOString() },
      '[plan-hours] ignoring a reading whose context is not a reading',
    );
    return null;
  }

  return {
    readAt: row.createdAt.toISOString(),
    workspaceHours: parsed.data.workspaceHours,
    apiHours: parsed.data.apiHours,
  };
}
