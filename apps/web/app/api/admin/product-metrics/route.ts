import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { signAuthJwt } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Proxy admin-only para `GET /api/metrics/product`.
 *
 * Mesmo desenho do proxy do dashboard: valida sessão e role ADMIN, assina o JWT
 * no servidor e repassa. O browser nunca vê o `AUTH_JWT_SECRET`.
 *
 * **A dupla checagem não é redundância inútil.** Aqui ela evita a chamada ao
 * backend quando não há sessão; lá, a API recusa por conta própria — porque
 * este proxy não é a única porta, e um `role` só validado no cliente é um
 * `role` que qualquer um escreve.
 *
 * `days` é repassado e **validado pela API**, não aqui: dois validadores para o
 * mesmo parâmetro discordam no dia em que um deles mudar.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 },
    );
  }

  const jwt = await signAuthJwt({
    sub: session.user.id,
    email: session.user.email ?? '',
    role: session.user.role,
  });

  const query = new URL(request.url).search;

  const backendResponse = await fetch(
    `${API_BASE_URL}/metrics/product${query}`,
    {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: 'no-store',
    },
  );

  const body = await backendResponse.json().catch(() => null);
  return NextResponse.json(body, { status: backendResponse.status });
}
