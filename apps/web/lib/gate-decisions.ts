import type { ErrorGroup, PipelineRunSummary } from '@newranews/types';

/**
 * As decisões dos dois portões do pipeline, lidas do que já existe. (§13.3 do
 * plano de observabilidade, Fase 9)
 *
 * A literatura pede o sinal: *registre toda decisão de guarda e observe a
 * deriva — mudança súbita na taxa de aprovação, ou na distribuição dos
 * motivos de recusa, costuma preceder um bypass que funciona.* A API grava
 * cada bloqueio como `ErrorEvent` com `code: PIPELINE_GATE_BLOCKED` e o motivo
 * no `route` (`stage-6.5:unanchored-url`), e lista os runs; **nenhuma rota
 * nova** — a taxa e a distribuição são derivadas aqui, como o `degradedStreak`
 * da Fase 8 e as médias da Fase 11.
 *
 * **A janela é a de 7 dias do `GET /api/admin/errors`**, porque é a do
 * gatilho do §16 ("taxa de aprovação < 90 % em 7 dias"); os runs vêm da
 * listagem de 30 dias, recortados ao mesmo `since`.
 */

/** O código que a API grava num bloqueio de portão — literal também do lado da API. */
export const GATE_BLOCKED_CODE = 'PIPELINE_GATE_BLOCKED';

/** Abaixo disto a taxa de aprovação vira alerta (§16). */
export const APPROVAL_TRIGGER = 0.9;

/**
 * Os checks cujo primeiro bloqueio, sozinho, merece olhar no mesmo dia (§16):
 * uma URL no briefing, viesse ela do texto do material (`copied-url` — o
 * caminho clássico da injeção) ou de lugar nenhum (`unanchored-url`).
 */
export const SAME_DAY_CHECKS = ['unanchored-url', 'copied-url'] as const;

export type GateOfRoute = 'entry' | 'exit';

export interface GateMotive {
  gate: GateOfRoute;
  /** O check, como a API o nomeia: `volume`, `unanchored-url`, … */
  check: string;
  /** Ocorrências na janela — bloqueios que falharam o dia mais os que o Groq recuperou. */
  count: number;
  /** Só os que falharam o dia (`ERROR` e `FATAL`). */
  blocked: number;
}

export interface GateDecisions {
  /** Runs fechados na janela — o denominador. */
  runs: number;
  /** Bloqueios que falharam o dia (`ERROR`/`FATAL`). */
  blocked: number;
  /** Bloqueios de qualidade que o provider de reserva recuperou (`WARN`). */
  recovered: number;
  /** `1 − blocked / runs`; `null` sem run na janela — a taxa de zero runs não é 100 %. */
  approvalRate: number | null;
  /** Por motivo, do mais frequente ao menos. */
  motives: GateMotive[];
}

/**
 * `stage-6.5:unanchored-url` → `{ gate: 'exit', check: 'unanchored-url' }`.
 * `null` para qualquer outra forma de `route` — o normalizador do lado da
 * API já garante que só um check declarado entra ali.
 */
export function parseGateRoute(route: string | null): { gate: GateOfRoute; check: string } | null {
  if (route === null) return null;
  const match = /^stage-(5\.5|6\.5):([a-z-]+)$/.exec(route);
  if (!match) return null;
  return { gate: match[1] === '5.5' ? 'entry' : 'exit', check: match[2] as string };
}

/**
 * As decisões da janela.
 *
 * `groups` são os grupos do `GET /api/admin/errors` (qualquer janela — o
 * filtro pelo código é daqui); `runs` a listagem de runs; `since` o início
 * da janela dos erros, em ISO. Só runs **fechados** contam no denominador:
 * o que está `RUNNING` ainda não passou pelos portões.
 */
export function gateDecisions(
  groups: ErrorGroup[],
  runs: PipelineRunSummary[],
  since: string,
): GateDecisions {
  const sinceMs = new Date(since).getTime();
  const closed = runs.filter((run) => run.status !== 'RUNNING' && new Date(run.startedAt).getTime() >= sinceMs);

  const byMotive = new Map<string, GateMotive>();
  let blocked = 0;
  let recovered = 0;

  for (const group of groups) {
    if (group.code !== GATE_BLOCKED_CODE) continue;
    const parsed = parseGateRoute(group.route);
    if (parsed === null) continue;

    const failedTheDay = group.severity !== 'WARN';
    if (failedTheDay) blocked += group.count;
    else recovered += group.count;

    const key = `${parsed.gate}:${parsed.check}`;
    const motive = byMotive.get(key) ?? { ...parsed, count: 0, blocked: 0 };
    motive.count += group.count;
    if (failedTheDay) motive.blocked += group.count;
    byMotive.set(key, motive);
  }

  const motives = [...byMotive.values()].sort((a, b) => b.count - a.count || a.check.localeCompare(b.check));
  const approvalRate = closed.length === 0 ? null : Math.max(0, 1 - blocked / closed.length);

  return { runs: closed.length, blocked, recovered, approvalRate, motives };
}

export type GateAlert =
  | { kind: 'low-approval'; rate: number }
  | { kind: 'url-block'; count: number };

/**
 * Os dois gatilhos do §16, como alerta: a taxa abaixo de 90 % em 7 dias, e
 * **qualquer** bloqueio por URL no briefing — evento único, que merece olhar
 * no mesmo dia, mesmo que a taxa esteja em 99 %.
 */
export function gateAlerts(decisions: GateDecisions): GateAlert[] {
  const alerts: GateAlert[] = [];
  const urlBlocks = decisions.motives
    .filter((m) => m.gate === 'exit' && (SAME_DAY_CHECKS as readonly string[]).includes(m.check))
    .reduce((sum, m) => sum + m.count, 0);
  if (urlBlocks > 0) {
    alerts.push({ kind: 'url-block', count: urlBlocks });
  }
  if (decisions.approvalRate !== null && decisions.approvalRate < APPROVAL_TRIGGER) {
    alerts.push({ kind: 'low-approval', rate: decisions.approvalRate });
  }
  return alerts;
}
