import type { FastifyInstance } from 'fastify';
import { checkAllProviders } from '../../services/health.service';
import type { ProvidersHealth } from '../../services/health.service';
import { getDevLogs } from '../../services/pipeline-event.service';
import type { DevLogSummary, DevLogsResult } from '../../services/pipeline-event.service';
import { assertJobSecret } from '../../utils/job-secret';

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
<style>
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

export async function devDashboardRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { secret?: string } }>(
    '/dashboard',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // Página aberta no browser: aceita o secret como query param (?secret=)
      // ou via header Authorization.
      assertJobSecret(request, request.query.secret);

      const [logs, providers] = await Promise.all([
        getDevLogs({ limit: 50 }),
        checkAllProviders(),
      ]);

      reply.type('text/html').send(renderDashboardHtml(logs, providers));
    },
  );
}
