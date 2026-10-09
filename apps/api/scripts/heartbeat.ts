import { appendFileSync } from 'node:fs';

/**
 * **O batimento de fora** — 13.1 do plano de observabilidade (§23), 07/10/2026.
 *
 * Em setembro os três incidentes caros foram descobertos **de fora**: a
 * suspensão do Render (19/09 → 01/10, doze dias sem briefing) por uma sonda
 * manual, a cota de imagem por um advisory, as advisories pelo CI. As três abas
 * do admin dizem tudo o que aconteceu — para quem as abre —, e o que mede mora
 * dentro da API: quando ela cai, o painel cai junto. **Nada avisava ninguém.**
 *
 * Este script roda num runner do GitHub, uma vez por dia, depois da janela do
 * cron (`.github/workflows/heartbeat.yml`). Ele faz as perguntas abaixo, escreve
 * a resposta no resumo do job e **sai com 1 se alguma falhou — o job reprovado
 * é o e-mail** que o GitHub manda. Sem segredo novo, sem serviço de terceiro e
 * sem custo.
 *
 * 1. **o site responde** — a Home `/pt-BR` em 200;
 * 2. **a API responde, e se não, por quê** — `503` com `x-render-routing:
 *    suspend` é o Render suspendendo (as horas do workspace acabaram), que pede
 *    uma ação diferente de um timeout;
 * 3. **o briefing de hoje existe** (`GET /api/articles/latest`, dia UTC) — o
 *    sinal que cobre todos os outros: API suspensa, cron que não a acordou,
 *    portão que bloqueou, pipeline que morreu;
 * 4. **as duas Homes mostram o briefing de hoje** — extensão da §23, e o motivo
 *    tem data: em 07/10 o briefing existia e a Home `/pt-BR` passou a tarde com
 *    o da véspera. O 13a′ conserta pelo cron; quando ele desiste, a única marca
 *    é a linha `cron.daily-news.warm`, que a Vercel guarda por uma hora. Esta
 *    pergunta a transforma em e-mail;
 * 5. **o login fecha hoje** (13.7, 09/10/2026) — a sonda do par de JWT que o
 *    cron pergunta depois do run (`/api/health/auth` do web, guardada pela
 *    ISR). Os fluxos com login do Smoke ficam desligados por decisão do dono:
 *    o `NEXTAUTH_SECRET` de produção no CI daria a qualquer dependência
 *    comprometida uma sessão de admin. O defeito que eles pegariam — a API
 *    recusar a assinatura da Vercel, todo leitor logado em 401 — chega aqui
 *    sem segredo nenhum: é lido do cache da Vercel, e não acorda a API;
 * 6. **o próprio batimento continua agendado** — o GitHub desliga workflow
 *    agendado de repositório público depois de 60 dias sem atividade, e o
 *    batimento não conta como atividade. O aviso sai aos 45.
 *
 * **Uma causa, uma linha.** Sem a API, o briefing não é perguntado; sem o
 * briefing de hoje, nem a Home nem o login são culpados — o cron só pergunta
 * depois de um run em `SUCCESS`.
 *
 * **A sonda da API é a série que o 13.3 precisa, de graça**: a duração e se foi
 * ela que acordou a API (o `uptime` do `/api/health` menor que a própria espera)
 * saem no resumo e numa linha estável do log (`heartbeat api_ms=… woke=…`). O
 * preço foi feito antes de escrever, como o §17 manda: uma acordada por dia são
 * ~15 min de instância, ~7,5 h/mês contra as 750.
 *
 * **Roda com o Node sozinho** (`node apps/api/scripts/heartbeat.ts`, que apaga
 * os tipos sem compilar): sem `pnpm install`, o alerta tem um motivo a menos
 * para falhar. Por isso o arquivo não importa nada do projeto, só usa tipos
 * apagáveis e não usa `import.meta` — o mesmo arquivo é tipado pelo `tsc` do
 * pacote, que o lê como CommonJS.
 */

export const DEFAULT_SITE_URL = 'https://newra-news-web.vercel.app';
export const DEFAULT_API_URL = 'https://newra-news-api.onrender.com';

/** As Homes que o leitor abre — a do 07/10 era a `/pt-BR`, com a `/en` fresca. */
export const HOME_LOCALES = ['pt-BR', 'en'] as const;

/** Cobre a acordada medida em outubro (~52 s) com folga. */
export const API_PROBE_TIMEOUT_MS = 120_000;

/** Uma página guardada responde em décimos; o prazo é para a que regenera. */
export const PAGE_TIMEOUT_MS = 60_000;

/** A pausa antes da segunda sonda — a mesma do cron diante da borda do Render. */
export const API_RETRY_PAUSE_MS = 15_000;

/**
 * Quinze dias antes do desligamento: tempo para um push qualquer. O GitHub
 * conta a atividade do repositório; o `pushed_at` é o último push a qualquer
 * branch.
 */
export const ACTIVITY_WARN_DAYS = 45;

/** Folga para dizer que a sonda acordou a API: o processo nasceu durante a espera. */
const WOKE_SLACK_MS = 15_000;

const DAY_MS = 86_400_000;

export interface Probe {
  /** `null` quando não houve resposta (timeout ou transporte). */
  status: number | null;
  ms: number;
  headers: Record<string, string>;
  body: string;
}

export interface Observation {
  now: Date;
  /** Por idioma; a `/pt-BR` é também a pergunta "o site responde?". */
  homes: Record<string, Probe>;
  /** Uma ou duas sondas do `/api/health`. */
  api: Probe[];
  /** `null` quando a API não respondeu — o briefing não é perguntado. */
  latest: Probe | null;
  /** A rota `/api/health/auth` do **site** — o resultado da sonda do cron. */
  authProbe: Probe | null;
  /** O `pushed_at` do repositório, ou `null` fora do GitHub Actions. */
  repoPushedAt: string | null;
}

export type CheckId = 'site' | 'api' | 'briefing' | 'home' | 'login' | 'activity' | 'rehearsal';

export interface EvaluateOptions {
  /**
   * **O ensaio do alerta** (07/10/2026, a pedido do dono): pergunta tudo de
   * verdade e reprova de propósito. Uma execução verde não gera e-mail — o
   * certo, com "só falhas" ligado —, então ela prova que o job roda, não que o
   * alerta chega. Só o disparo manual o pede (`rehearse_failure` no
   * `heartbeat.yml`); o agendamento não tem entrada nenhuma.
   */
  rehearsal?: boolean;
}

export interface Check {
  id: CheckId;
  state: 'ok' | 'fail' | 'skipped';
  summary: string;
  /** O que fazer — só nas que falharam. */
  action?: string;
}

export interface Verdict {
  ok: boolean;
  today: string;
  checks: Check[];
  apiProbe: { ms: number; woke: boolean | null; status: number | null; attempts: number };
}

type ApiState = 'up' | 'suspended' | 'refused' | 'unreachable' | 'error';

function apiState(probe: Probe): ApiState {
  if (probe.status === 200) return 'up';
  if (probe.status === null) return 'unreachable';
  if (probe.status === 503 && /suspend/i.test(probe.headers['x-render-routing'] ?? '')) {
    return 'suspended';
  }
  if (probe.status === 429) return 'refused';
  return 'error';
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function uptimeSeconds(probe: Probe): number | null {
  const parsed = parseJson(probe.body) as { uptime?: unknown } | null;
  return typeof parsed?.uptime === 'number' ? parsed.uptime : null;
}

interface AuthProbeBody {
  ok: boolean;
  reason: string;
  status: number | null;
  checkedAt: string;
}

/** O corpo da sonda do login, ou `null` se a página não é uma sonda. */
function authProbeBody(probe: Probe | null): AuthProbeBody | null {
  if (probe?.status !== 200) return null;
  const parsed = parseJson(probe.body) as Partial<AuthProbeBody> | null;
  if (typeof parsed?.ok !== 'boolean' || typeof parsed.checkedAt !== 'string') return null;
  return {
    ok: parsed.ok,
    reason: typeof parsed.reason === 'string' ? parsed.reason : 'desconhecido',
    status: typeof parsed.status === 'number' ? parsed.status : null,
    checkedAt: parsed.checkedAt,
  };
}

function latestDate(probe: Probe): string | null {
  const parsed = parseJson(probe.body) as { data?: { date?: unknown } } | null;
  const date = parsed?.data?.date;
  return typeof date === 'string' ? date.slice(0, 10) : null;
}

const describeProbe = (probe: Probe) =>
  probe.status === null ? `sem resposta em ${probe.ms} ms` : `${probe.status} em ${probe.ms} ms`;

/** O veredito — puro, sobre o que foi observado. */
export function evaluate(o: Observation, options: EvaluateOptions = {}): Verdict {
  const today = o.now.toISOString().slice(0, 10);
  const checks: Check[] = [];

  // 1. O site.
  const site = o.homes['pt-BR'];
  checks.push(
    site?.status === 200
      ? { id: 'site', state: 'ok', summary: `/pt-BR ${describeProbe(site)}` }
      : {
          id: 'site',
          state: 'fail',
          summary: `/pt-BR ${site ? describeProbe(site) : 'não pedida'}`,
          action:
            'A Vercel não serviu a Home. O painel da Vercel diz se é o deploy, a cota do Hobby ou a plataforma.',
        },
  );

  // 2. A API — o desfecho é o da última sonda; a duração é a da primeira.
  const last = o.api[o.api.length - 1];
  const first = o.api[0];
  const state: ApiState = last ? apiState(last) : 'unreachable';
  const answered = o.api.find((probe) => probe.status === 200);
  const uptime = answered ? uptimeSeconds(answered) : null;
  const woke = answered && uptime !== null ? uptime * 1000 <= answered.ms + WOKE_SLACK_MS : null;
  const tries = o.api.map(describeProbe).join(' → ');

  if (state === 'up') {
    checks.push({
      id: 'api',
      state: 'ok',
      summary: `/api/health ${tries}${woke ? ' — esta sonda acordou a API' : ''}`,
    });
  } else if (state === 'suspended') {
    checks.push({
      id: 'api',
      state: 'fail',
      summary: `o Render suspendeu a API (503, x-render-routing: suspend)`,
      action:
        'As horas do workspace acabaram (ou o serviço foi suspenso): Render → Billing. Nada no código resolve; o site segue no ar pela ISR, congelado, e o cron de amanhã vai falhar.',
    });
  } else {
    checks.push({
      id: 'api',
      state: 'fail',
      summary: `/api/health ${tries}${state === 'refused' ? ' — a borda recusou (429)' : ''}`,
      action:
        'A API não respondeu de fora. Sonde de novo; se repetir, o log do Render diz se o processo subiu (e a armadilha 45, se for 429).',
    });
  }

  // 3. O briefing de hoje.
  const newest = o.latest?.status === 200 ? latestDate(o.latest) : null;
  if (state !== 'up' || o.latest === null) {
    checks.push({ id: 'briefing', state: 'skipped', summary: 'sem a API, não dá para perguntar' });
  } else if (newest === today) {
    checks.push({ id: 'briefing', state: 'ok', summary: `briefing de ${today} no ar` });
  } else {
    checks.push({
      id: 'briefing',
      state: 'fail',
      summary:
        o.latest.status === 404
          ? 'nenhum briefing na API'
          : `o briefing mais novo é de ${newest ?? 'data ilegível'}, não de ${today}`,
      action:
        'O run de hoje não gravou briefing. A faixa de desfechos da /admin diz em que etapa parou; o log do cron (`cron.daily-news`) na Vercel diz se ele acordou a API.',
    });
  }

  // 4. As Homes mostram o briefing de hoje.
  const briefingOk = checks.find((c) => c.id === 'briefing')?.state === 'ok';
  if (!briefingOk) {
    checks.push({ id: 'home', state: 'skipped', summary: 'depende do briefing de hoje' });
  } else {
    const stale = HOME_LOCALES.filter((locale) => {
      const home = o.homes[locale];
      return !(home?.status === 200 && home.body.includes(`/${locale}/article/${today}`));
    });
    checks.push(
      stale.length === 0
        ? { id: 'home', state: 'ok', summary: `as Homes mostram o briefing de ${today}` }
        : {
            id: 'home',
            state: 'fail',
            summary: `o briefing de hoje existe e a Home em ${stale.map((l) => `/${l}`).join(', ')} não o mostra`,
            action:
              'É o 13.12: o cron invalidou e a regeneração não pegou. Procure `cron.daily-news.warm` no log da Vercel da hora do cron; o botão da /admin, com o run do dia fechado, regenera o conjunto sem rodar nada.',
          },
    );
  }

  // 5. O login — a sonda do par de JWT que o cron pergunta depois do run.
  if (!briefingOk) {
    checks.push({ id: 'login', state: 'skipped', summary: 'depende do briefing de hoje' });
  } else {
    const body = authProbeBody(o.authProbe);
    const day = body?.checkedAt.slice(0, 10);
    if (body === null) {
      checks.push({
        id: 'login',
        state: 'fail',
        summary: `/api/health/auth ${o.authProbe ? describeProbe(o.authProbe) : 'não pedida'} — não é a sonda`,
        action:
          'A rota da sonda no web não respondeu com o resultado. O log da Vercel da hora do cron diz se ela falhou ao regenerar.',
      });
    } else if (!body.ok) {
      checks.push({
        id: 'login',
        state: 'fail',
        summary: `a API recusou a sonda do login (${body.reason}${body.status === null ? '' : `, ${body.status}`}) em ${day}`,
        action:
          '401 é o par `AUTH_JWT_SECRET` divergente entre a Vercel e o Render: todo leitor logado está recebendo 401. Confira que os dois valores são iguais nos dois painéis. `not-configured` é a variável ausente na Vercel; `unreachable`, a API sem responder ao cron.',
      });
    } else if (day !== today) {
      checks.push({
        id: 'login',
        state: 'fail',
        summary: `a sonda do login mais nova é de ${day}, não de ${today}`,
        action:
          'O cron não regenerou a sonda hoje. Procure `cron.daily-news.warm` no log da Vercel da hora do cron; o botão da /admin, com o run do dia fechado, refaz o conjunto.',
      });
    } else {
      checks.push({ id: 'login', state: 'ok', summary: `a API aceitou a sonda do login em ${today}` });
    }
  }

  // 6. O próprio agendamento.
  const pushedAt = o.repoPushedAt === null ? Number.NaN : new Date(o.repoPushedAt).getTime();
  if (!Number.isFinite(pushedAt)) {
    // Fora do GitHub Actions, ou a leitura do `pushed_at` falhou: um alarme
    // falso sobre o próprio alarme ensinaria a ignorar o e-mail.
    checks.push({ id: 'activity', state: 'skipped', summary: 'último push desconhecido' });
  } else {
    const days = Math.floor((o.now.getTime() - pushedAt) / DAY_MS);
    checks.push(
      days <= ACTIVITY_WARN_DAYS
        ? { id: 'activity', state: 'ok', summary: `último push há ${days} dia(s)` }
        : {
            id: 'activity',
            state: 'fail',
            summary: `último push há ${days} dias — o GitHub desliga este agendamento aos 60`,
            action: `Faltam ${Math.max(0, 60 - days)} dia(s). Qualquer push no repositório reinicia a contagem.`,
          },
    );
  }

  // 7. O ensaio — por último, depois de as seis serem respondidas de verdade.
  if (options.rehearsal) {
    checks.push({
      id: 'rehearsal',
      state: 'fail',
      summary: 'ensaio: esta execução reprova de propósito, para o e-mail do alerta chegar',
      action:
        'Nada a consertar. Confira que o e-mail chegou; se não, as notificações de Actions da conta (Settings → Notifications → Actions → falhas, por e-mail).',
    });
  }

  return {
    ok: checks.every((c) => c.state !== 'fail'),
    today,
    checks,
    apiProbe: {
      ms: first?.ms ?? 0,
      woke,
      status: last?.status ?? null,
      attempts: o.api.length,
    },
  };
}

const ICON: Record<Check['state'], string> = { ok: '✅', fail: '❌', skipped: '➖' };

/** O resumo do job, em Markdown. A sonda da API sai sempre — é a série do 13.3. */
export function renderSummary(v: Verdict): string {
  const rows = v.checks.map((c) => `| ${ICON[c.state]} | \`${c.id}\` | ${c.summary} |`);
  const actions = v.checks
    .filter((c) => c.state === 'fail' && c.action)
    .map((c) => `- **\`${c.id}\`** — ${c.action}`);
  const woke = v.apiProbe.woke === null ? 'não se sabe' : v.apiProbe.woke ? 'sim' : 'não';

  return [
    `## Batimento — ${v.today} ${v.ok ? '✅' : '❌'}`,
    '',
    '| | Pergunta | Resposta |',
    '|---|---|---|',
    ...rows,
    '',
    `**Sonda da API:** ${v.apiProbe.ms} ms na primeira tentativa (${v.apiProbe.attempts} no total); acordou a API: ${woke}.`,
    ...(actions.length > 0 ? ['', '### O que fazer', '', ...actions] : []),
    '',
  ].join('\n');
}

export interface ObserveOptions {
  fetch: typeof fetch;
  siteUrl: string;
  apiUrl: string;
  now: () => Date;
  pause: (ms: number) => Promise<void>;
  repoPushedAt: string | null;
}

async function get(fetchFn: typeof fetch, url: string, timeoutMs: number): Promise<Probe> {
  const started = Date.now();
  try {
    const res = await fetchFn(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'newra-news-heartbeat' },
      redirect: 'follow',
    });
    const body = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return { status: res.status, ms: Date.now() - started, headers, body };
  } catch {
    // Timeout ou transporte: a sonda conta como "sem resposta", e o veredito
    // diz qual pergunta ficou sem ela.
    return { status: null, ms: Date.now() - started, headers: {}, body: '' };
  }
}

/** Observa — só `GET`, e a API só depois das Homes (que não a acordam). */
export async function observe(opts: ObserveOptions): Promise<Observation> {
  const homes: Record<string, Probe> = {};
  for (const locale of HOME_LOCALES) {
    homes[locale] = await get(opts.fetch, `${opts.siteUrl}/${locale}`, PAGE_TIMEOUT_MS);
  }

  const api: Probe[] = [await get(opts.fetch, `${opts.apiUrl}/api/health`, API_PROBE_TIMEOUT_MS)];
  const firstState = apiState(api[0] as Probe);
  // A suspensão não passa com o tempo; o resto pode (a acordada, a borda).
  if (firstState !== 'up' && firstState !== 'suspended') {
    await opts.pause(API_RETRY_PAUSE_MS);
    api.push(await get(opts.fetch, `${opts.apiUrl}/api/health`, API_PROBE_TIMEOUT_MS));
  }

  const up = apiState(api[api.length - 1] as Probe) === 'up';
  const latest = up
    ? await get(opts.fetch, `${opts.apiUrl}/api/articles/latest`, PAGE_TIMEOUT_MS)
    : null;

  // Do **site**, guardada pela ISR: lê o que o cron perguntou, não pergunta.
  const authProbe = await get(opts.fetch, `${opts.siteUrl}/api/health/auth`, PAGE_TIMEOUT_MS);

  return { now: opts.now(), homes, api, latest, authProbe, repoPushedAt: opts.repoPushedAt };
}

export interface MainDeps {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  now: () => Date;
  pause: (ms: number) => Promise<void>;
  appendSummary: (file: string, text: string) => void;
  log: (line: string) => void;
}

/** Observa, julga, escreve o resumo e devolve o código de saída. */
export async function main(deps: MainDeps): Promise<number> {
  const observation = await observe({
    fetch: deps.fetch,
    siteUrl: deps.env.HEARTBEAT_SITE_URL ?? DEFAULT_SITE_URL,
    apiUrl: deps.env.HEARTBEAT_API_URL ?? DEFAULT_API_URL,
    now: deps.now,
    pause: deps.pause,
    repoPushedAt: deps.env.REPO_PUSHED_AT || null,
  });
  // Exatamente `"true"`: o disparo manual sem marcar manda `"false"`, e o
  // agendamento, vazio.
  const verdict = evaluate(observation, { rehearsal: deps.env.HEARTBEAT_REHEARSAL === 'true' });

  for (const check of verdict.checks) {
    deps.log(`${check.state.padEnd(7)} ${check.id.padEnd(8)} ${check.summary}`);
  }
  // A linha estável que a série de acordadas (13.3) lê depois, por grep.
  const woke = verdict.apiProbe.woke === null ? 'unknown' : String(verdict.apiProbe.woke);
  deps.log(
    `heartbeat api_ms=${verdict.apiProbe.ms} woke=${woke} status=${verdict.apiProbe.status ?? 'none'} attempts=${verdict.apiProbe.attempts}`,
  );

  const summaryFile = deps.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) deps.appendSummary(summaryFile, renderSummary(verdict));

  return verdict.ok ? 0 : 1;
}

if ((process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scripts/heartbeat.ts')) {
  main({
    env: process.env,
    fetch: globalThis.fetch,
    now: () => new Date(),
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    appendSummary: (file, text) => appendFileSync(file, text),
    log: (line) => process.stdout.write(`${line}\n`),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`heartbeat crashed: ${String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
