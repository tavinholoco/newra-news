import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * Runs do pipeline (admin) — `GET /api/admin/pipeline/runs`.
 *
 * **O caminho é o mesmo dos dois lados**, e isso é efeito colateral do prefixo
 * `/api/admin` que a Fase 2 abriu na API: até aqui, cada rota de admin do BFF
 * tinha um nome próprio (`/api/admin/metrics` → `/metrics/dashboard`), e ler as
 * duas metades lado a lado exigia traduzir.
 *
 * `status`, `since` e `limit` são repassados na query e **validados pela API**,
 * nunca aqui: dois validadores para o mesmo parâmetro discordam no dia em que
 * um deles mudar.
 */
export async function GET(request: Request) {
  return proxyToApi(request, '/admin/pipeline/runs', 'GET', {
    requireRole: 'ADMIN',
  });
}
