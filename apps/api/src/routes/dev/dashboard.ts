import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { checkAllProviders } from '../../services/health.service';
import type { ProvidersHealth } from '../../services/health.service';
import { getDevLogs } from '../../services/pipeline-event.service';
import type { DevLogSummary, DevLogsResult } from '../../services/pipeline-event.service';
import {
  DASHBOARD_COOKIE_NAME,
  DASHBOARD_SESSION_TTL_SECONDS,
  assertJobSecret,
  isValidDashboardToken,
  issueDashboardToken,
  readCookie,
  secretsMatch,
} from '../../utils/job-secret';
import { env } from '../../config/env';

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatUtc(iso: string): string {
  return iso.replace('T', ' ').slice(0, 19);
}

function statusBadge(status: string): string {
  const color =
    status === 'SUCCESS' || status === 'ok'
      ? 'var(--ok)'
      : status === 'FAILED' || status === 'invalid'
        ? 'var(--err)'
        : 'var(--warn)';
  return `<span class="badge" style="background:${color}">${escapeHtml(status)}</span>`;
}

function runRow(run: DevLogSummary): string {
  const errorCell = run.error
    ? `<details><summary>ver erro</summary><pre>${escapeHtml(run.error)}</pre></details>`
    : '<span class="muted">—</span>';
  return `<tr>
    <td class="mono">${escapeHtml(formatUtc(run.startedAt))}</td>
    <td>${statusBadge(run.status)}</td>
    <td class="num">${run.newsCount}</td>
    <td class="num">${run.durationSeconds !== null ? `${run.durationSeconds}s` : '—'}</td>
    <td class="num">${run.eventCount}</td>
    <td class="num">${run.errorStage !== null ? escapeHtml(String(run.errorStage)) : '—'}</td>
    <td>${errorCell}</td>
  </tr>`;
}

function providerBadges(providers: ProvidersHealth): string {
  return Object.entries(providers)
    .map(
      ([name, status]) =>
        `<div class="provider"><strong>${escapeHtml(name)}</strong> ${statusBadge(status)}</div>`,
    )
    .join('');
}

export function renderDashboardHtml(
  logs: DevLogsResult,
  providers: ProvidersHealth,
  nonce: string,
): string {
  const runsRows = logs.runs.map(runRow).join('');
  const errorsRows = logs.recentErrors.map(runRow).join('');
  const emptyRow =
    '<tr><td colspan="7" class="muted">Nenhum run registrado ainda.</td></tr>';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Newra News — Dev Dashboard</title>
<style nonce="${nonce}">
  :root {
    --bg: #0f1115; --panel: #171a21; --border: #262b36; --text: #e6e8ee;
    --muted: #8b93a5; --ok: #1f7a3d; --err: #9c2b2b; --warn: #8a6d1a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: var(--bg); color: var(--text);
         font: 14px/1.5 system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 10px; }
  .sub { color: var(--muted); font-size: 12px; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
  .panel { background: var(--panel); border: 1px solid var(--border);
           border-radius: 8px; padding: 16px; }
  .provider { display: flex; justify-content: space-between; align-items: center;
              padding: 6px 0; border-bottom: 1px solid var(--border); }
  .provider:last-child { border-bottom: none; }
  .table-wrap { overflow-x: auto; background: var(--panel);
                border: 1px solid var(--border); border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; min-width: 720px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  tr:last-child td { border-bottom: none; }
  .badge { color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 11px;
           font-weight: 600; display: inline-block; }
  .num { text-align: right; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .muted { color: var(--muted); }
  pre { white-space: pre-wrap; word-break: break-word; margin: 6px 0 0; font-size: 12px; }
  summary { cursor: pointer; color: #7aa2f7; }
</style>
</head>
<body>
  <h1>🔧 Dev Dashboard — Pipeline</h1>
  <div class="sub">Auto-refresh a cada 30s · servido pela API (dev-only, <code>JOB_SECRET</code>)</div>

  <h2>Status dos providers</h2>
  <div class="grid"><div class="panel">${providerBadges(providers)}</div></div>

  <h2>Últimos runs (${logs.runs.length})</h2>
  <div class="table-wrap"><table>
    <thead><tr>
      <th>Início (UTC)</th><th>Status</th><th class="num">Notícias</th>
      <th class="num">Duração</th><th class="num">Eventos</th>
      <th class="num">Falha etapa</th><th>Erro</th>
    </tr></thead>
    <tbody>${runsRows || emptyRow}</tbody>
  </table></div>

  <h2>Erros recentes (${logs.recentErrors.length})</h2>
  <div class="table-wrap"><table>
    <thead><tr>
      <th>Início (UTC)</th><th>Status</th><th class="num">Notícias</th>
      <th class="num">Duração</th><th class="num">Eventos</th>
      <th class="num">Falha etapa</th><th>Erro</th>
    </tr></thead>
    <tbody>${errorsRows || emptyRow}</tbody>
  </table></div>
</body>
</html>`;
}

/**
 * CSP da pagina, por resposta.
 *
 * A global e `default-src 'none'`, que e a certa para JSON e mata qualquer
 * HTML. Esta pagina declara o que ela de fato usa: o proprio estilo inline,
 * autorizado por nonce, e o POST do formulario de entrada.
 */
function dashboardCsp(nonce: string): string {
  return [
    "default-src 'none'",
    `style-src 'nonce-${nonce}'`,
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function renderLoginHtml(nonce: string, failed: boolean): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Newra News — Dev Dashboard</title>
<style nonce="${nonce}">
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #0f1115; color: #e6e8ee; font: 14px/1.5 system-ui, sans-serif; }
  form { background: #171a21; border: 1px solid #262b36; border-radius: 8px;
         padding: 24px; width: min(360px, 90vw); }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p { color: #8b93a5; font-size: 12px; margin: 0 0 16px; }
  input, button { width: 100%; padding: 9px 12px; border-radius: 6px; font: inherit; }
  input { background: #0f1115; border: 1px solid #262b36; color: #e6e8ee; margin-bottom: 12px; }
  button { background: #7aa2f7; border: 0; color: #0f1115; font-weight: 600; cursor: pointer; }
  .err { color: #f07178; font-size: 12px; margin: 0 0 12px; }
</style>
</head>
<body>
  <form method="post" action="/dev/dashboard/session">
    <h1>🔧 Dev Dashboard</h1>
    <p>Observabilidade do pipeline. Requer <code>JOB_SECRET</code>.</p>
    ${failed ? '<p class="err">Segredo invalido.</p>' : ''}
    <input type="password" name="secret" autocomplete="off" autofocus
           aria-label="JOB_SECRET" placeholder="JOB_SECRET">
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`;
}

/**
 * O painel HTML e a unica coisa da API que uma pessoa abre no browser, e era a
 * unica que aceitava o segredo pela URL (`?secret=`).
 *
 * **Segredo em query string vaza por tres canais que ninguem controla:** o log
 * de acesso do proxy, o historico do browser e o `Referer` de qualquer link que
 * a pagina abra. A regra da revisao da Fase 9 era "header ou nada"; o desenho
 * abaixo mantem a pagina utilizavel sem voltar atras nisso — o segredo entra
 * por um POST (corpo, nao URL) e o que fica no browser e um token assinado com
 * prazo, em cookie `HttpOnly`.
 *
 * O acesso por `Authorization: Bearer` continua valendo, e e o que o `curl` usa.
 */
export async function devDashboardRoutes(app: FastifyInstance) {
  // Sem `@fastify/formbody`: o unico formulario da API nao justifica uma
  // dependencia, e `URLSearchParams` e o parser do formato.
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    },
  );

  const authorized = (request: Parameters<typeof readCookie>[0]): boolean => {
    if (isValidDashboardToken(readCookie(request, DASHBOARD_COOKIE_NAME))) return true;
    try {
      assertJobSecret(request);
      return true;
    } catch {
      return false;
    }
  };

  app.get<{ Querystring: { failed?: string } }>(
    '/dashboard',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const nonce = randomUUID();
      reply.header('content-security-policy', dashboardCsp(nonce));

      if (!authorized(request)) {
        return reply
          .status(401)
          .type('text/html')
          .send(renderLoginHtml(nonce, request.query.failed === '1'));
      }

      const [logs, providers] = await Promise.all([
        getDevLogs({ limit: 50 }),
        checkAllProviders(),
      ]);

      return reply.type('text/html').send(renderDashboardHtml(logs, providers, nonce));
    },
  );

  app.post<{ Body: { secret?: string } }>(
    '/dashboard/session',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const secret = request.body?.secret;
      if (!secret || !secretsMatch(secret, env.JOB_SECRET)) {
        // 303 e nao 401: o browser tem de trocar o POST por um GET, senao o
        // reload da pagina de erro reenvia o segredo.
        return reply.redirect('/dev/dashboard?failed=1', 303);
      }

      return reply
        .header(
          'set-cookie',
          [
            `${DASHBOARD_COOKIE_NAME}=${issueDashboardToken()}`,
            'Path=/dev',
            'HttpOnly',
            'SameSite=Strict',
            `Max-Age=${DASHBOARD_SESSION_TTL_SECONDS}`,
            ...(env.NODE_ENV === 'production' ? ['Secure'] : []),
          ].join('; '),
        )
        .redirect('/dev/dashboard', 303);
    },
  );
}
