import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GET as triggerCronPipeline } from '@/app/api/cron/daily-news/route';

export const dynamic = 'force-dynamic';

/**
 * Admin-only trigger do pipeline: valida a sessão + role ADMIN server-side e
 * reusa a rota do cron (mesma lógica de fetch/revalidatePath) chamando-a com o
 * CRON_SECRET — o browser nunca vê o secret.
 */
export async function POST() {
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

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    );
  }

  const cronResponse = await triggerCronPipeline(
    new Request('http://localhost:3000/api/cron/daily-news', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }),
  );

  const body = await cronResponse.json().catch(() => null);
  return NextResponse.json(body, { status: cronResponse.status });
}
