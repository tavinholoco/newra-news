import { NextResponse } from 'next/server';
import { revalidateDailyContent } from '@/lib/daily-revalidation';
import { isCronAuthorized } from '@/lib/cron-auth';
import { logServerError } from '@/lib/log-server-error';
import {
  API_TIMEOUT_MS,
  PIPELINE_REFUSED_PAUSE_MS,
  PIPELINE_SETTLE_MAX_MS,
  PIPELINE_SETTLE_POLL_MS,
  PIPELINE_TRIGGER_ATTEMPTS,
  PIPELINE_TRIGGER_TIMEOUT_MS,
  PIPELINE_WARM_ATTEMPTS,
  PIPELINE_WARM_TIMEOUT_MS,
} from '@/lib/timeouts';
import type { PipelineTrigger } from '@newranews/types';

export const dynamic = 'force-dynamic';

/**
 * 290 s, e o número sai da soma do pior caso: aquecer (`2 × 25 s` + uma pausa
 * de 15 s) = 65 s; disparar com a borda recusando (`4 × 20 s` + `3 × 15 s`) =
 * 125 s; esperar o fim do run (`PIPELINE_SETTLE_MAX_MS`) = 90 s — 280 s. O
 * teto do plano Hobby da Vercel é 300 s. Era 90 s até 01/10/2026; 240 com a
 * espera pelo run; 290 com a repetição do 429.
 */
export const maxDuration = 290;

/** Recusa que passa com o tempo: a borda do Render limitando, ou subindo. */
const REFUSED = new Set([429, 503]);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      // **429 da borda do Render chega em 0,1 s**: sem pausa, as duas
      // tentativas saíam juntas e o aquecimento não esperava nada.
      if (REFUSED.has(res.status) && attempt < PIPELINE_WARM_ATTEMPTS) {
        await pause(PIPELINE_REFUSED_PAUSE_MS);
      }
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
      if (REFUSED.has(res.status)) continue;
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
    // **Repetido quando a borda recusa (429/503).** O disparo é idempotente
    // por dia na API, então repetir um pedido que a borda barrou não roda o
    // pipeline duas vezes.
    let response!: Response;
    for (let attempt = 1; attempt <= PIPELINE_TRIGGER_ATTEMPTS; attempt++) {
      response = await fetch(jobUrl, {
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
      if (!REFUSED.has(response.status) || attempt === PIPELINE_TRIGGER_ATTEMPTS) break;
      await pause(PIPELINE_REFUSED_PAUSE_MS);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Backend returned ${response.status}`, detail: errorText },
        { status: 502 },
      );
    }

    const data = (await response.json()) as PipelineTrigger;

    // **Quem começou o run do dia não importa — o site tem de mostrá-lo.** O
    // `triggerPipeline` é idempotente por dia: com um run de hoje já em
    // `SUCCESS` ou `RUNNING`, ele devolve o id daquele e não executa nada. Até
    // 02/10/2026 esta rota só invalidava no `started` ("custo sem troco") — e
    // naquele dia o **cron interno da API** (`CRON_SCHEDULE`, 08:00 de São
    // Paulo) disparou às 11:00 em ponto com a instância acordada, este cron
    // chegou depois, ouviu `already-succeeded-today` e não invalidou nada: a
    // Home ficou no HTML do build da véspera (`x-vercel-cache: PRERENDER`)
    // com o briefing de 02/10 já no banco. Com o `revalidate` de um dia, nada
    // mais a consertaria. Item 86 do `docs/progress.md`.
    let revalidated = false;
    let settled: RunStatus | null = null;

    if (data.outcome === 'started') {
      // **Primeiro no aceite, depois na conclusão.** A invalidação no aceite
      // derruba o HTML velho na hora; a segunda, depois do `SUCCESS`, conserta
      // a página que alguém tenha regenerado no meio do run — com o
      // `revalidate` de um dia, ninguém mais a conserta. O conjunto, e por que
      // a `/news/[id]` não entra, está em `lib/daily-revalidation.ts`.
      revalidateDailyContent();
      revalidated = true;

      // **Só no disparo agendado.** O botão do painel reentra por aqui de
      // dentro de outra requisição (`x-actor-id`) e espera esta resposta;
      // segurá-lo por até 90 s seria a tela travada. O preço é aceito: o
      // disparo manual fica só com a invalidação no aceite.
      if (!actorId) {
        settled = await settleRun(jobUrl, data.pipelineId);
        if (settled === 'SUCCESS') revalidateDailyContent();
      }
    } else if (data.outcome === 'already-succeeded-today') {
      // O run do dia terminou sem nós: invalidar uma vez. Custa uma
      // regeneração por página do conjunto, com a API acordada. No botão do
      // painel, é o "atualizar o site" depois de um run que outro disparou.
      revalidateDailyContent();
      revalidated = true;
    } else if (data.outcome === 'already-running' && !actorId) {
      // O run do dia está correndo sem nós: esperar **o mesmo** run e
      // invalidar quando ele fechar em `SUCCESS`. Invalidar agora regeneraria
      // a partir do banco ainda sendo escrito. O botão não espera (ver acima).
      settled = await settleRun(jobUrl, data.pipelineId);
      if (settled === 'SUCCESS') {
        revalidateDailyContent();
        revalidated = true;
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
