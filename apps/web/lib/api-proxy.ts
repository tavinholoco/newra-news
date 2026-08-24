import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { signAuthJwt } from '@/lib/jwt';
import { API_TIMEOUT_MS } from '@/lib/timeouts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Repassa uma chamada autenticada para a API.
 *
 * **O browser nunca fala autenticado com a API.** Ele não tem o
 * `AUTH_JWT_SECRET`, então toda rota de conta passa por aqui: esta rota lê a
 * sessão do next-auth (cookie), assina o JWT no servidor e encaminha. 401 sem
 * sessão, e a API nem chega a ser chamada.
 *
 * Mora num arquivo só porque são seis rotas proxy fazendo exatamente isto —
 * e porque assinar JWT é o tipo de coisa que não deve ter seis versões.
 *
 * ## O que atravessa, e o que não
 *
 * **Vai daqui para lá:** o método, a query string, o corpo, o JWT e o
 * `x-request-id`. O último é a metade que faltava de uma coisa que a Fase 9
 * construiu: a API respeita o `x-request-id` de quem chama e o ecoa em toda
 * resposta, e é ele que liga um relato de fora à linha do log — mas o BFF nunca
 * o enviava, então cada perna da mesma chamada tinha um id diferente.
 *
 * **Não vai:** cookie nenhum. O cookie de sessão é do domínio do site e a API é
 * outro host; a identidade viaja no JWT, que é o desenho, e repassar cookie
 * seria dar à API uma segunda fonte de verdade sobre quem é o usuário.
 */
export interface ProxyOptions {
  /**
   * Exige o papel **antes** de assinar o token, e o assina junto.
   *
   * **As três rotas de admin tinham cada uma a sua cópia deste arquivo** —
   * mesma leitura de sessão, mesma checagem de papel, mesma assinatura, mesmo
   * repasse — e as cópias já divergiam: elas declaravam `cache: 'no-store'` e
   * este arquivo não, para dado igualmente por-usuário. Três implementações da
   * mesma decisão é onde a costura racha, e foi por isso que o timeout, o
   * `x-request-id` e o formato do corpo de erro precisariam ser escritos quatro
   * vezes nesta fase.
   *
   * A dupla checagem — aqui e na API — não é redundância inútil: aqui ela evita
   * a chamada quando não há sessão; lá, a API recusa por conta própria, porque
   * este proxy não é a única porta.
   */
  requireRole?: 'ADMIN';
}
export async function proxyToApi(
  request: Request,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  options: ProxyOptions = {},
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (options.requireRole && session.user.role !== options.requireRole) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const jwt = await signAuthJwt({
    sub: session.user.id,
    email: session.user.email ?? '',
    // O `role` só é assinado quando a rota o exige. Um token de leitor comum
    // não carrega papel nenhum, e é isso que faz a porta da API decidir por
    // conta própria em vez de acreditar no que o BFF escreveu.
    ...(options.requireRole ? { role: options.requireRole } : {}),
  });

  const query = new URL(request.url).search;
  const hasBody = method === 'POST' || method === 'PUT';
  const requestId = request.headers.get('x-request-id');

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${API_BASE_URL}${path}${query}`, {
      method,
      // Sem isto, uma API dormindo segurava a função da Vercel até o limite
      // dela — e o navegador ficava com uma requisição pendurada, que nenhuma
      // tela sabe desenhar. Ver `lib/timeouts.ts` para os números.
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      // **Resposta por usuário não entra em cache nenhum.** As três rotas de
      // admin já diziam isto e este arquivo não dizia, para dado da mesma
      // natureza — favoritos, conta, preferências. Nenhuma leitura daqui é
      // compartilhável, e o Next não tem como saber disso sozinho.
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${jwt}`,
        ...(requestId ? { 'x-request-id': requestId } : {}),
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasBody ? await request.text() : undefined,
    });
  } catch {
    /**
     * **502, e com o mesmo corpo `{ error }` de todas as outras respostas.**
     *
     * Quem falhou foi o repasse, não esta rota — e a distinção importa para
     * quem lê: um 500 diria que o BFF quebrou, e o que houve foi a API não
     * responder. O corpo segue o formato único do produto (`ApiError` de
     * `packages/types`), porque a alternativa era o `NextResponse.json(null)`
     * que este arquivo produzia antes em resposta não-JSON: status certo, corpo
     * `null`, e nenhuma tela com o que dizer.
     */
    return NextResponse.json(
      { error: 'Upstream API unavailable' },
      { status: 502 },
    );
  }

  const body = await backendResponse.json().catch(() => null);
  const response = NextResponse.json(
    body ?? { error: `Upstream API returned ${backendResponse.status}` },
    { status: backendResponse.status },
  );

  /**
   * **E o id volta.** A metade que faltava, e a revisão do próprio código foi
   * quem a expôs.
   *
   * Repassar o `x-request-id` de entrada, sozinho, não liga nada: quem chama
   * este BFF é o **navegador**, e navegador não manda esse cabeçalho. A API
   * gera o dela (`genReqId`) e a ecoa em toda resposta desde a Fase 9 — mas o
   * proxy montava uma resposta nova e o id morria aqui.
   *
   * Devolvê-lo é o que fecha o circuito que o `x-request-id` existe para
   * fechar: alguém relata "deu erro agora", lê o id na aba de rede, e ele acha
   * a linha do log da API. Sem isto, o id existe e não alcança ninguém.
   */
  const upstreamId = backendResponse.headers.get('x-request-id');
  if (upstreamId) response.headers.set('x-request-id', upstreamId);

  return response;
}
