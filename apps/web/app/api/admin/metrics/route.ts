import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { signAuthJwt } from '@/lib/jwt';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Proxy admin-only para GET /api/metrics/dashboard: valida sessão + role
 * ADMIN, assina o JWT com o role (a API exige `role === 'ADMIN'` no payload)
 * e repassa para o backend. O browser nunca vê o AUTH_JWT_SECRET.
 */
export async function GET() {
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

  const backendResponse = await fetch(`${API_BASE_URL}/metrics/dashboard`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: 'no-store',
  });

  const body = await backendResponse.json().catch(() => null);
  return NextResponse.json(body, { status: backendResponse.status });
}
