import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * Métricas do pipeline (admin) — `GET /api/metrics/dashboard`.
 *
 * O dado é operacional e deixou de ser público na V2, então a rota da API exige
 * JWT com `role: 'ADMIN'`. Quem confere a sessão, o papel e assina o token é o
 * `proxyToApi`: até a revisão da Fase 11 esta rota tinha a sua própria cópia
 * dessa lógica, e as cópias já discordavam entre si.
 */
export async function GET(request: Request) {
  return proxyToApi(request, '/metrics/dashboard', 'GET', { requireRole: 'ADMIN' });
}
