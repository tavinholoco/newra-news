import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * Detalhe de um run (admin) — `GET /api/admin/pipeline/runs/:pipelineId`.
 *
 * O id vai cru no caminho e **a API valida o formato UUID**, devolvendo 400 —
 * validar aqui também criaria dois donos da mesma regra. O `ApiError` do
 * cliente já trata 400 e 404 como a mesma coisa para quem lê ("esse run não
 * existe"), que é o comportamento certo para um id digitado errado.
 */
export async function GET(
  request: Request,
  { params }: { params: { pipelineId: string } },
) {
  return proxyToApi(request, `/admin/pipeline/runs/${params.pipelineId}`, 'GET', {
    requireRole: 'ADMIN',
  });
}
