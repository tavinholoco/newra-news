import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { signAuthJwt } from '@/lib/jwt';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export async function DELETE(
  _request: Request,
  { params }: { params: { newsId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jwt = await signAuthJwt({
    sub: session.user.id,
    email: session.user.email ?? '',
  });

  const backendResponse = await fetch(
    `${API_BASE_URL}/favorites/${params.newsId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}` },
    },
  );

  const body = await backendResponse.json().catch(() => null);
  return NextResponse.json(body, { status: backendResponse.status });
}
