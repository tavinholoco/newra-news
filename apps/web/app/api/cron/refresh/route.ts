import { NextResponse } from 'next/server';
import { revalidateDailyContent } from '@/lib/daily-revalidation';
import { isCronAuthorized } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * **O segundo cron: invalida as páginas do dia depois que o pipeline terminou,
 * sem chamar a API.** Agendado para as 13:00 UTC em `vercel.json`.
 *
 * O primeiro (`/api/cron/daily-news`) invalida no **disparo**, não na conclusão
 * — o pipeline ainda roda ~80 s no servidor, e um robô que pegue a Home nesse
 * intervalo a regenera com o briefing da véspera. Até 01/10 o `revalidate` de
 * 3600 s consertava isso em uma hora; hoje ele é de um dia (as horas do
 * Render — `lib/daily-revalidation.ts`), e quem conserta é esta rota.
 *
 * **Por que 13:00 e não 12:00:** o Hobby da Vercel dispara o cron em qualquer
 * minuto da hora agendada. O das 11:00 já saiu às 11:31 (01/10); se sair às
 * 11:59, o pipeline termina por volta de 12:01 — e um cron das 12:00 pode cair
 * antes disso. Às 13:00 a folga é de uma hora no pior caso.
 *
 * **Sem chamada à API, de propósito.** A invalidação só marca as páginas como
 * velhas; quem paga a regeneração é o próximo visitante. Uma rota que
 * aquecesse a API aqui seria um despertar a mais por dia, que é o oposto do
 * motivo de ela existir. Por isso não há `catch`: `revalidatePath` não faz I/O
 * de rede nesta chamada.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  revalidateDailyContent();
  return NextResponse.json({ success: true, revalidated: true });
}
