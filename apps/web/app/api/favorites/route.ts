import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { signAuthJwt } from '@/lib/jwt';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Proxy para o backend: o browser não tem acesso ao AUTH_JWT_SECRET, então
 * esta rota lê a sessão do next-auth (cookie), assina o JWT server-side e
 * repassa a chamada para a API. 401 se não autenticado.
 */
async function forward(request: Request, method: 'GET' | 'POST') {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwt = await signAuthJwt({
    sub: session.user.id,
    email: session.user.email ?? '',
  });

  const query = new URL(request.url).search;
  const backendResponse = await fetch(`${API_BASE_URL}/favorites${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? await request.text() : undefined,
  });

  const body = await backendResponse.json().catch(() => null);
  return NextResponse.json(body, { status: backendResponse.status });
}

export async function GET(request: Request) {
  return forward(request, 'GET');
}

export async function POST(request: Request) {
  return forward(request, 'POST');
}
