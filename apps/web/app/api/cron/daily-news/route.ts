import { NextResponse } from 'next/server';
import { revalidateDailyContent } from '@/lib/daily-revalidation';
import { isCronAuthorized } from '@/lib/cron-auth';
import { logServerError } from '@/lib/log-server-error';
import {
  API_TIMEOUT_MS,
  PIPELINE_SETTLE_MAX_MS,
  PIPELINE_SETTLE_POLL_MS,
  PIPELINE_TRIGGER_TIMEOUT_MS,
  PIPELINE_WARM_ATTEMPTS,
  PIPELINE_WARM_TIMEOUT_MS,
} from '@/lib/timeouts';
import type { PipelineTrigger } from '@newranews/types';

export const dynamic = 'force-dynamic';

/**
 * 240 s, e o número sai da soma: `PIPELINE_WARM_ATTEMPTS × PIPELINE_WARM_TIMEOUT_MS`
 * mais o disparo dá 70 s no pior caso, e a espera pelo fim do run
 * (`PIPELINE_SETTLE_MAX_MS`) mais 150 s — 220 s, com margem para a resposta e
 * as revalidações. Era 90 s até 01/10/2026, quando a rota passou a esperar o
 * run. O teto do plano Hobby da Vercel é 300 s.
 */
export const maxDuration = 240;

/**
 * Acorda a API antes de disparar, e diz se conseguiu.
 *
 * **Existe porque o briefing de 01/09/2026 não saiu.** A API tinha acabado de
 * voltar de um mês suspenso, estava dormindo às 11h UTC, e o disparo — que tem
 * 20 s — estourou antes de ela responder. O `catch` devolveu 500 e o dia ficou
 * sem briefing; o único sinal foi o briefing ausente.
 *
 * O `GET /api/health` é a rota mais barata da API e não tem efeito colateral,
 * então repeti-la é seguro. Falhar aqui **não aborta o disparo**: a API pode ter
 * acordado no intervalo, e um POST que falha custa menos que um dia perdido.
 */
async function warmApi(jobUrl: string): Promise<boolean> {
  // A origem vem do próprio `BACKEND_JOB_URL` — usar outra variável abriria a
  // chance de aquecer um host e disparar em outro.
  const healthUrl = new URL('/api/health', jobUrl).toString();

  for (let attempt = 1; attempt <= PIPELINE_WARM_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(healthUrl, {
        signal: AbortSignal.timeout(PIPELINE_WARM_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (res.ok) return true;
    } catch {
      // Timeout ou transporte: é o caso esperado com a API hibernando, e a
      // própria tentativa é o que a acorda. Segue para a seguinte.
      //
      // **É o único `catch` do BFF que fica sem `logServerError`, e a exceção
      // está escrita** em `CATCH_ALLOWED` (`tests/lib/bff-error-log.test.ts`).
      // Aqui falhar é o caminho normal — logar cada tentativa encheria o log de
      // linhas de erro num dia que deu certo, que é como se ensina alguém a
      // ignorar o log. O desfecho já é observável: `warmed` sai daqui e entra na
      // linha que o `catch` do disparo escreve.
    }
  }
  return false;
}

type RunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';

/**
 * **Espera o run terminar, e diz como terminou.** Sonda `GET /api/jobs/:id` —
 * a mesma origem do `BACKEND_JOB_URL`, com o mesmo segredo — até o status
 * deixar de ser `RUNNING` ou o prazo acabar.
 *
 * Existe porque o `revalidate` das páginas é de um dia desde 01/10/2026 (as
 * horas do Render — `lib/daily-revalidation.ts`): a invalidação no aceite é
 * otimista, e um robô que pegue a Home durante os ~90 s do run a regenera com
 * o briefing da véspera. Sem esta espera, essa página ficaria um dia no ar.
 * Era um segundo cron às 13:00 — e o deploy da Vercel o recusou: o Hobby
 * limita os crons. **A sonda não custa hora do Render**: a API está acordada
 * pelo próprio run.
 *
 * Nunca lança. Qualquer resposta que não seja um `RUNNING` legível encerra a
 * espera (`UNKNOWN`): esperar às cegas só gastaria o `maxDuration`.
 */
async function settleRun(jobUrl: string, pipelineId: string): Promise<RunStatus> {
  const statusUrl = new URL(encodeURIComponent(pipelineId), jobUrl).toString();
  const deadline = Date.now() + PIPELINE_SETTLE_MAX_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, PIPELINE_SETTLE_POLL_MS));
    try {
      const res = await fetch(statusUrl, {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
        headers: { Authorization: `Bearer ${process.env.BACKEND_JOB_SECRET}` },
        cache: 'no-store',
      });
      if (!res.ok) return 'UNKNOWN';
      const body = (await res.json()) as { data?: { status?: unknown } } | null;
      const status = body?.data?.status;
      if (status === 'SUCCESS' || status === 'FAILED') return status;
      if (status !== 'RUNNING') return 'UNKNOWN';
    } catch (error) {
      // A sonda caiu (timeout, rede): o run segue no servidor, e só a segunda
      // invalidação se perde — a linha é o que diz que ela se perdeu.
      logServerError('cron.daily-news.settle', error);
      return 'UNKNOWN';
    }
  }
  return 'RUNNING';
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // **O ator, quando há um.** O botão do painel (`/api/admin/run-pipeline`)
  // põe o `User.id` da sessão em `x-actor-id` e reentra por aqui; o cron da
  // Vercel não manda o cabeçalho, e o disparo agendado não é ação de ninguém.
  // Esta rota só repassa — quem sabe quem clicou é o BFF, e quem grava é a
  // API. Fase 5 do plano de observabilidade.
  const actorId = request.headers.get('x-actor-id');

  const jobUrl = process.env.BACKEND_JOB_URL;
  if (!jobUrl) {
    return NextResponse.json(
      { success: false, error: 'BACKEND_JOB_URL not configured' },
      { status: 500 },
    );
  }

  // **Acordar vem antes de disparar.** O cron das 11h UTC é justamente a hora
  // em que a API está mais provavelmente dormindo — no free do Render ela
  // hiberna com ~15 min sem tráfego, e desde 31/08 o keep-alive deixa a
  // madrugada passar de propósito. Ver `warmApi`.
  const warmed = await warmApi(jobUrl);

  try {
    const response = await fetch(jobUrl, {
      method: 'POST',
      // O que se espera aqui é o **aceite**, não a execução: a rota da API
      // responde `{ outcome, pipelineId, startedAt }` e o pipeline segue no
      // servidor quando o desfecho é `started`.
      signal: AbortSignal.timeout(PIPELINE_TRIGGER_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${process.env.BACKEND_JOB_SECRET}`,
        ...(actorId ? { 'x-actor-id': actorId } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Backend returned ${response.status}`, detail: errorText },
        { status: 502 },
      );
    }

    const data = (await response.json()) as PipelineTrigger;

    // **Nada disparado, nada a invalidar.** O `triggerPipeline` é idempotente
    // por dia: com um run de hoje já em `SUCCESS` ou `RUNNING`, ele devolve o id
    // daquele e não executa nada. Invalidar o cache aí joga fora uma página
    // quente para regenerá-la a partir do mesmo banco — custo sem troco.
    const revalidated = data.outcome === 'started';

    let settled: RunStatus | null = null;
    if (revalidated) {
      // **Primeiro no aceite, depois na conclusão.** A invalidação no aceite
      // derruba o HTML velho na hora; a segunda, depois do `SUCCESS`, conserta
      // a página que alguém tenha regenerado no meio do run — com o
      // `revalidate` de um dia, ninguém mais a conserta. O conjunto, e por que
      // a `/news/[id]` não entra, está em `lib/daily-revalidation.ts`.
      revalidateDailyContent();

      // **Só no disparo agendado.** O botão do painel reentra por aqui de
      // dentro de outra requisição (`x-actor-id`) e espera esta resposta;
      // segurá-lo por até 150 s seria a tela travada. O preço é aceito: o
      // disparo manual fica só com a invalidação no aceite.
      if (!actorId) {
        settled = await settleRun(jobUrl, data.pipelineId);
        if (settled === 'SUCCESS') revalidateDailyContent();
      }
    }

    return NextResponse.json({ success: true, data, revalidated, warmed, settled });
  } catch (error) {
    /**
     * **O 01/09/2026 é este `catch`.** A API tinha acabado de voltar de um mês
     * suspensa, o disparo estourou o prazo, o `catch` devolveu 500 — e o dia
     * ficou sem briefing, com *o briefing ausente na Home* como único sinal.
     *
     * O `warmed` já viajava na resposta desde então, e essa era a metade que
     * faltava: **ninguém lê esta resposta.** Quem chama é o cron da Vercel, que
     * a descarta. O campo que separava as duas causas — a API que não acordou e
     * a que acordou e recusou — existia e não alcançava ninguém. Agora ele está
     * na linha, junto com o `cause` que diz qual das duas foi.
     */
    logServerError('cron.daily-news', error, { warmed });

    // `warmed` viaja também na falha, e é o que separa duas causas que sem ele
    // ficam iguais no log: a API que não acordou, e a que acordou e recusou o
    // disparo. Foi a ausência dessa distinção que fez o briefing de 01/09 sumir
    // sem explicação.
    return NextResponse.json(
      { success: false, error: 'Pipeline trigger failed', warmed },
      { status: 500 },
    );
  }
}
