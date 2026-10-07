import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * A leitura do Billing do Render — `POST /api/admin/plan-hours` (Fase 13 do
 * plano de observabilidade, 13b).
 *
 * O dono lê no painel do Render o total de horas free do **workspace** e o
 * digita na `/admin`; a API guarda a leitura com as horas dela no mesmo
 * instante, e o arco passa a desenhar o workspace inteiro. O corpo atravessa
 * intocado — a API é o único validador, e a vírgula do teclado já foi
 * convertida pela tela (`parseHoursInput`). O ator é quem está na sessão, e
 * viaja no JWT que o proxy assina.
 */
export async function POST(request: Request) {
  return proxyToApi(request, '/admin/plan-hours', 'POST', { requireRole: 'ADMIN' });
}
