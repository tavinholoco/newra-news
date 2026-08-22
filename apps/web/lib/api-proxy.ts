import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { signAuthJwt } from '@/lib/jwt';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Repassa uma chamada autenticada para a API.
 *
 * **O browser nunca fala autenticado com a API.** Ele não tem o
 * `AUTH_JWT_SECRET`, então toda rota de conta passa por aqui: esta rota lê a
 * sessão do next-auth (cookie), assina o JWT no servidor e encaminha. 401 sem
 * sessão, e a API nem chega a ser chamada.
 *
 * Mora num arquivo só porque são cinco rotas proxy fazendo exatamente isto —
 * e porque assinar JWT é o tipo de coisa que não deve ter cinco versões.
 */
export async function proxyToApi(
  request: Request,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwt = await signAuthJwt({
    sub: session.user.id,
    email: session.user.email ?? '',
  });

  const query = new URL(request.url).search;
  const hasBody = method === 'POST' || method === 'PUT';

  const backendResponse = await fetch(`${API_BASE_URL}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    body: hasBody ? await request.text() : undefined,
  });

  const body = await backendResponse.json().catch(() => null);
  return NextResponse.json(body, { status: backendResponse.status });
}
