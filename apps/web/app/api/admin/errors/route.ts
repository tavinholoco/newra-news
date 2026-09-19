import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * Falhas registradas, agrupadas por fingerprint (admin) — `GET /api/admin/errors`.
 *
 * O `ErrorEvent` que a Fase 4 grava e que, até o 5b, ninguém lia. A aba de
 * segurança (`/admin/security`) desenha a partir daqui: a rosquinha por
 * categoria, a linha de severidade e a tabela de falhas com o `lastRequestId`
 * que torna um relato pesquisável no log.
 *
 * `window` (`24h` | `7d`) é repassado na query e **validado pela API**, nunca
 * aqui: dois validadores para o mesmo parâmetro discordam no dia em que um
 * deles mudar.
 */
export async function GET(request: Request) {
  return proxyToApi(request, '/admin/errors', 'GET', { requireRole: 'ADMIN' });
}
