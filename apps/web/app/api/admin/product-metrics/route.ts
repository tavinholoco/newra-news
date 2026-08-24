import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * Métricas de **produto** (admin) — `GET /api/metrics/product`.
 *
 * O dashboard mede o pipeline; esta lê o `ProductEvent`, que é comportamento de
 * gente.
 *
 * `days` é repassado na query e **validado pela API**, não aqui: dois
 * validadores para o mesmo parâmetro discordam no dia em que um deles mudar.
 */
export async function GET(request: Request) {
  return proxyToApi(request, '/metrics/product', 'GET', { requireRole: 'ADMIN' });
}
