import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { GET as triggerCronPipeline } from '@/app/api/cron/daily-news/route';

export const dynamic = 'force-dynamic';

/**
 * Admin-only trigger do pipeline: valida a sessão + role ADMIN server-side e
 * reusa a rota do cron (mesma lógica de fetch/revalidatePath) chamando-a com o
 * CRON_SECRET — o browser nunca vê o secret.
 *
 * ## O ator atravessa daqui até a API (Fase 5 do plano de observabilidade)
 *
 * **Este é o único lugar da cadeia que sabe quem clicou.** O cron recebe o
 * `CRON_SECRET`, a API recebe o `JOB_SECRET`, e nenhum dos dois carrega
 * sessão — medido ao abrir a Fase 5: o disparo chegava à API **sem usuário
 * nenhum**, e a trilha de auditoria (`AuditEvent`) nasceu com `actorId`
 * obrigatório de propósito. O `User.id` da sessão vai no cabeçalho
 * `x-actor-id`; o cron o repassa; a API grava `pipeline.triggered` com ele.
 *
 * Cabeçalho, e não corpo, porque a rota do cron é um `GET`. E é o **id**, não o
 * e-mail: a tabela não guarda dado pessoal, e quem precisar do nome junta com
 * `User` na leitura.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  // `user.id` e não só `user`: é o ator da trilha de auditoria, e uma sessão
  // sem id é sessão inutilizável — o mesmo critério do `proxyToApi`.
  if (!session?.user?.id) {
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
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`,
        'x-actor-id': session.user.id,
      },
    }),
  );

  const body = await cronResponse.json().catch(() => null);
  return NextResponse.json(body, { status: cronResponse.status });
}
