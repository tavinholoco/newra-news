import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * O último relatório de invariantes (admin) — `GET /api/admin/invariants`.
 *
 * A etapa 9.5 do pipeline (§10 do plano de observabilidade, Fase 6) roda doze
 * consultas agregadas e grava o relatório no `context` de um `PipelineEvent`;
 * a API lê o evento mais recente e devolve — **nunca roda a suíte** por
 * pedido da tela. O painel "Invariantes" da aba de segurança desenha a partir
 * daqui.
 *
 * Sem query: não há janela a escolher, é sempre o último.
 */
export async function GET(request: Request) {
  return proxyToApi(request, '/admin/invariants', 'GET', { requireRole: 'ADMIN' });
}
