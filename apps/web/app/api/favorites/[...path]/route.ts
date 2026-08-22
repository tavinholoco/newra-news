import { proxyToApi } from '@/lib/api-proxy';

/**
 * O resto de `/api/favorites`: `ids` (GET) e `news|article/<id>` (DELETE).
 *
 * Um catch-all só, em vez de uma pasta por formato de URL — o proxy não
 * interpreta o caminho, apenas o repassa assinado.
 */
export async function GET(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxyToApi(request, `/favorites/${params.path.join('/')}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  return proxyToApi(request, `/favorites/${params.path.join('/')}`, 'DELETE');
}
