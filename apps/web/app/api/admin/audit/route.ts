import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * A trilha de ação de admin — `GET /api/admin/audit`.
 *
 * Quem disparou o pipeline, quem apagou o quê. A tabela nasceu no 5a, a
 * leitura na API no 5b (não estava no plano — tabela sem leitor é a armadilha
 * que este projeto já pagou duas vezes), e a tela é o 5c. Só o `actorId`
 * atravessa, nunca e-mail: quem precisar do nome junta com `User` na leitura.
 *
 * `days` e `limit` são repassados na query e validados pela API.
 */
export async function GET(request: Request) {
  return proxyToApi(request, '/admin/audit', 'GET', { requireRole: 'ADMIN' });
}
