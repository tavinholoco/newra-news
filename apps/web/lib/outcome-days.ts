import type { PipelineRunSummary, RunOutcome } from '@newranews/types';
import { fillCalendarDays } from './series';

/**
 * O desfecho de um **dia**, e não de um run. (§12 do plano de observabilidade,
 * Fase 8)
 *
 * A API deriva o desfecho de cada run que existe (`RunOutcome`); o que ela não
 * sabe dizer é que **nenhum run existe** num dia — e esse é o terceiro estado
 * que em 01/09/2026 não existia em lugar nenhum: o cron estourou o prazo,
 * nenhuma linha foi gravada, e o único sinal foi o briefing ausente na Home.
 * Ausência de linha não é linha de falha, e as duas pedem ações opostas
 * (`NEVER_RAN` é "o disparo não aconteceu"; `FAILED` é "aconteceu e quebrou").
 * Quem sabe dizer ausência é o calendário, e ele mora aqui.
 *
 * `RUNNING` é o dia cujo último run ainda não fechou — hoje, durante o cron.
 */
export type DayOutcome = RunOutcome | 'RUNNING' | 'NEVER_RAN';

export interface OutcomeDay {
  /** O dia UTC, `YYYY-MM-DD` — a mesma chave do `byDay` e do `Article.date`. */
  date: string;
  outcome: DayOutcome;
  /** Do run que representa o dia; vazio quando não há run. */
  degradedBy: number[];
  /** O run que representa o dia, ou `null` em `NEVER_RAN`. */
  run: PipelineRunSummary | null;
}

/** A janela da faixa: 30 quadrados, um por dia UTC, hoje incluído. */
export const OUTCOME_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** O desfecho de um run como a faixa o lê: `null` (ainda `RUNNING`) vira estado. */
function dayOutcomeOf(run: PipelineRunSummary): DayOutcome {
  return run.outcome ?? 'RUNNING';
}

/**
 * Um desfecho por dia UTC da janela, do mais antigo para hoje.
 *
 * **O último run a começar é o que representa o dia.** Pode haver mais de um
 * (o cron das 11:00 e um disparo manual às 16:25), e o painel já chama o mais
 * recente de "último" — é o candidato honesto: se alguém disparou de novo, foi
 * porque o anterior não bastou, e o que vale é o que ficou. A escolha é pelo
 * instante, não pela posição na lista, para não depender da ordem em que a
 * API devolve.
 *
 * **Dia UTC, nunca local.** O `startedAt` chega em ISO; `slice(0, 10)` lê o dia
 * em UTC, como `formatCalendarDay` lê o `byDay`. Agrupar pelo fuso do
 * navegador poria o run das 23:30 UTC no dia seguinte em Tóquio e no anterior
 * no Brasil — a armadilha do `Article.date` em mais uma forma.
 *
 * `now` é o instante que fecha a janela; a faixa é client-only sobre dado de
 * consulta (não há HTML de servidor com que divergir), então lê-lo no render é
 * seguro — a regra do relógio no render vale, como no `PlanPaceLine` do 5c.
 */
export function outcomeByDay(runs: PipelineRunSummary[], now: Date): OutcomeDay[] {
  const latestByDate = new Map<string, PipelineRunSummary>();
  for (const run of runs) {
    const date = run.startedAt.slice(0, 10);
    const current = latestByDate.get(date);
    if (!current || run.startedAt > current.startedAt) latestByDate.set(date, run);
  }

  const points: OutcomeDay[] = [...latestByDate.entries()].map(([date, run]) => ({
    date,
    outcome: dayOutcomeOf(run),
    degradedBy: run.degradedBy,
    run,
  }));

  // `now − 29 dias` como instante: o `fillCalendarDays` pega o dia UTC de cada
  // ponta, e são 30 dias de calendário, hoje incluído. Ele só olha os pontos
  // pelos dias da janela, então um run fora dela fica de fora em vez de
  // esticá-la.
  const start = new Date(now.getTime() - (OUTCOME_WINDOW_DAYS - 1) * DAY_MS);

  return fillCalendarDays(
    points,
    { start: start.toISOString(), end: now.toISOString() },
    (date) => ({ date, outcome: 'NEVER_RAN' as const, degradedBy: [], run: null }),
  );
}

/**
 * O último run que produziu briefing — o "batimento positivo" do §12.
 *
 * Não é `runs[0]`: se o último run falhou, o último **briefing** é o de antes,
 * e é dele que se mede "há quanto tempo". `SUCCESS` é o `status` que só existe
 * depois de o artigo estar gravado (etapa 7), então é a condição, e o
 * `completedAt` é o instante.
 */
export function lastBriefingRun(runs: PipelineRunSummary[]): PipelineRunSummary | null {
  let latest: PipelineRunSummary | null = null;
  for (const run of runs) {
    if (run.status !== 'SUCCESS' || run.completedAt === null) continue;
    if (!latest || run.completedAt > (latest.completedAt as string)) latest = run;
  }
  return latest;
}

/**
 * A partir de quanto tempo sem briefing a idade vira alerta: um dia inteiro.
 *
 * O pipeline é diário (cron das 11:00 UTC); num dia saudável a idade fica
 * abaixo de 24 h o tempo todo. Cruzar as 24 h é o run de hoje não ter chegado
 * na hora em que o de ontem chegou — o que aconteceu em 01/09/2026, e ninguém
 * viu até olhar a Home.
 */
export const BRIEFING_OVERDUE_MS = DAY_MS;
