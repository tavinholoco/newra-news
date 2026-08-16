import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { signAuthJwt } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Proxy admin-only para DELETE /api/news/:id: valida sessão + role ADMIN,
 * assina o JWT com o role (a API exige `role === 'ADMIN'` no payload) e
 * repassa para o backend.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
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

  const backendResponse = await fetch(`${API_BASE_URL}/news/${params.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${jwt}` },
  });

  const body = await backendResponse.json().catch(() => null);
  return NextResponse.json(body, { status: backendResponse.status });
}
