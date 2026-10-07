import { NextResponse } from 'next/server';
import {
  DAILY_REVALIDATION_PATHS,
  dailyPages,
  revalidateDailyContent,
  type DailyPage,
} from '@/lib/daily-revalidation';
import { isCronAuthorized } from '@/lib/cron-auth';
import { toDateSlug } from '@/lib/format';
import { logServerError } from '@/lib/log-server-error';
import { SITE_URL } from '@/lib/seo';
import {
  API_TIMEOUT_MS,
  CRON_MAX_DURATION_MS,
  CRON_RESPONSE_MARGIN_MS,
  DAILY_PAGES_FLOOR_MS,
  DAILY_PAGES_PAUSE_MS,
  DAILY_PAGES_ROUNDS,
  DAILY_PAGES_TIMEOUT_MS,
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
 *
 * **O pedido das páginas do dia (13.12) usa o que sobra** até
 * `CRON_MAX_DURATION_MS − CRON_RESPONSE_MARGIN_MS` — no caso comum (a API
 * acorda em ~52 s, o run leva ~75 s), mais de dois minutos; no pior caso
 * acima, nada, e o cron cai na invalidação de antes, com a linha no log.
 * Literal por exigência do Next; a constante em `lib/timeouts.ts` tem de ser
 * o mesmo número, e há guarda.
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
 * horas do Render — `lib/daily-revalidation.ts`): uma página regenerada antes
 * de o run gravar o briefing fica um dia com o da véspera. Esperar o `SUCCESS`
 * é o que dá ao cron um momento em que invalidar e pedir as páginas traz o run
 * do dia. Era um segundo cron às 13:00 — e o deploy da Vercel o recusou: o
 * Hobby limita os crons. **A sonda não custa hora do Render**: a API está
 * acordada pelo próprio run.
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

/**
 * **Invalida pela rota irmã** (`/api/cron/daily-news/revalidate`), numa
 * invocação que termina antes desta — e por isso a invalidação está aplicada
 * quando as páginas forem pedidas. Anotada aqui, ela só valeria quando o cron
 * retornasse (`lib/daily-revalidation.ts`). Devolve o status da resposta, ou
 * `null` se não houve resposta.
 *
 * A origem é a do site publicado (`SITE_URL`), a mesma dos pedidos das páginas:
 * é o cache que o leitor lê, e é o domínio de produção — os endereços de
 * deploy da Vercel ficam atrás da proteção de deploy.
 */
async function revalidateOnSite(
  patterns: ReadonlyArray<string>,
  deadline: number,
): Promise<number | null> {
  const url = new URL('/api/cron/daily-news/revalidate', SITE_URL);
  for (const pattern of patterns) url.searchParams.append('path', pattern);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(Math.max(1, Math.min(DAILY_PAGES_TIMEOUT_MS, deadline - Date.now()))),
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      cache: 'no-store',
    });
    return res.status;
  } catch (error) {
    logServerError('cron.daily-news.revalidate', error, { patterns: patterns.join(' ') });
    return null;
  }
}

interface PageAttempt {
  /** O status do documento, ou `null` se o pedido não teve resposta. */
  status: number | null;
  /** O `x-vercel-cache` — é ele que diz se a regeneração aconteceu. */
  cache: string | null;
  fresh: boolean;
}

/**
 * **Pede uma página como o leitor pediria, e confere a marca do run do dia.**
 * Sem segredo e sem cache do Next no meio (o `fetch` de um route handler é
 * memorizado se ninguém disser `no-store`). Depois da invalidação, este pedido
 * espera a regeneração — a Vercel responde `REVALIDATED` (A7.16) — e a
 * regeneração encontra a API acordada pelo run.
 */
async function requestPage(page: DailyPage, timeoutMs: number): Promise<PageAttempt> {
  try {
    const res = await fetch(new URL(page.url, SITE_URL), {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    const body = await res.text();
    return {
      status: res.status,
      cache: res.headers.get('x-vercel-cache'),
      fresh: res.ok && page.marker.test(body),
    };
  } catch {
    // Timeout ou transporte: a página conta como ainda velha, e a rodada
    // seguinte a invalida e pede de novo. **Exceção escrita** em
    // `CATCH_ALLOWED` (`tests/lib/bff-error-log.test.ts`): logar cada
    // tentativa encheria o log num dia que deu certo; o desfecho de cada
    // página que não se acertou vai na linha `cron.daily-news.warm`.
    return { status: null, cache: null, fresh: false };
  }
}

interface DailyPagesReport {
  runDate: string;
  rounds: number;
  fresh: string[];
  stale: Array<{ url: string; status: number | null; cache: string | null }>;
}

/** Os padrões das páginas dadas, sem repetição e na ordem do conjunto. */
const patternsOf = (pages: ReadonlyArray<DailyPage>): string[] =>
  DAILY_REVALIDATION_PATHS.map(([path]) => path).filter((path) =>
    pages.some((page) => page.pattern === path),
  );

/**
 * **Invalida o conjunto do dia, pede cada página e confere que ela traz o run
 * do dia** — 13.12 do plano de observabilidade, 07/10/2026.
 *
 * Em 07/10 a Home `/pt-BR` passou a tarde com o briefing da véspera, em `HIT`,
 * enquanto a `/en` — a mesma tag — regenerou com o de hoje: a invalidação
 * aconteceu, uma regeneração **falhou** depois dela, e a Vercel manteve o
 * documento anterior sem tentar de novo até o `revalidate` de um dia vencer.
 * Deixar a regeneração para o primeiro visitante era apostar a página mais lida
 * do site num pedido de robô, a qualquer hora, com a API talvez dormindo. Aqui
 * quem regenera é o cron, logo depois do run, com a API acordada por ele.
 *
 * **Cada rodada invalida de novo o que ficou velho**, em vez de só pedir de
 * novo: a regeneração que falha consome a invalidação. E pede as duas línguas
 * do padrão reinvalidado — a irmã também foi invalidada, e quem a regeneraria
 * seria um visitante.
 *
 * **Quando desiste** (rodadas, prazo, ou a rota irmã recusando), anota a
 * invalidação **só dos padrões que ficaram velhos** nesta invocação — é o
 * comportamento de antes do 13.12, aplicado quando o cron retornar, e o
 * próximo visitante tenta a regeneração —, e escreve `cron.daily-news.warm`
 * com o estado de cada página. As que foram conferidas não são invalidadas de
 * novo: o cron nunca deixa o site pior do que o deixaria sem esta função.
 */
async function refreshDailyPages(runDate: string, deadline: number): Promise<DailyPagesReport> {
  const pages = dailyPages(runDate);
  const last = new Map<string, PageAttempt>();
  let patterns = patternsOf(pages);
  let rounds = 0;
  // `null` até a primeira chamada: sem rodada, a linha não pode dizer que
  // houve invalidação.
  let invalidation: number | null = null;

  while (
    rounds < DAILY_PAGES_ROUNDS &&
    patterns.length > 0 &&
    deadline - Date.now() >= DAILY_PAGES_PAUSE_MS + DAILY_PAGES_FLOOR_MS
  ) {
    rounds++;
    invalidation = await revalidateOnSite(patterns, deadline);
    // Sem invalidação, pedir as páginas só leria os documentos velhos.
    if (invalidation === null || invalidation < 200 || invalidation >= 300) break;

    // A rota irmã já respondeu, mas o Next aplica a tag dela logo **depois**.
    await pause(DAILY_PAGES_PAUSE_MS);

    for (const page of pages) {
      if (!patterns.includes(page.pattern)) continue;
      const remaining = deadline - Date.now();
      if (remaining < DAILY_PAGES_FLOOR_MS) break;
      last.set(page.url, await requestPage(page, Math.min(DAILY_PAGES_TIMEOUT_MS, remaining)));
    }

    patterns = patternsOf(pages.filter((page) => !last.get(page.url)?.fresh));
  }

  const stalePages = pages.filter((page) => !last.get(page.url)?.fresh);
  const stale = stalePages.map((page) => ({
    url: page.url,
    status: last.get(page.url)?.status ?? null,
    cache: last.get(page.url)?.cache ?? null,
  }));

  if (stale.length > 0) {
    revalidateDailyContent(patternsOf(stalePages));
    logServerError(
      'cron.daily-news.warm',
      new Error('daily pages still without the run of the day'),
      {
        runDate,
        rounds,
        invalidation,
        stale: stale
          .map(({ url, status, cache }) => `${url} ${status ?? 'no-response'} ${cache ?? '-'}`)
          .join(', '),
      },
    );
  }

  return {
    runDate,
    rounds,
    fresh: pages.filter((page) => last.get(page.url)?.fresh).map((page) => page.url),
    stale,
  };
}

/**
 * O dia UTC em que o run começou — o mesmo `Article.date` que ele grava. `null`
 * se o `startedAt` não for legível: o contrato garante o campo, mas lançar aqui
 * cairia no `catch` do disparo e deixaria o dia **sem invalidação nenhuma**,
 * que é pior do que a invalidação de antes do 13.12.
 */
function runDateOf(trigger: PipelineTrigger): string | null {
  const startedAt = new Date(trigger.startedAt);
  return Number.isNaN(startedAt.getTime()) ? null : toDateSlug(trigger.startedAt);
}

export async function GET(request: Request) {
  // O relógio do prazo começa aqui: o pedido das páginas usa o que sobrar.
  const begunAt = Date.now();

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
    //
    // **Onde a invalidação mora, desde o 13.12 (07/10/2026).** O Next só
    // aplica a tag anotada num route handler quando ele retorna
    // (`lib/daily-revalidation.ts`). Então:
    //
    // - **com o run do dia em `SUCCESS`, no disparo agendado**, o cron invalida
    //   pela rota irmã e pede cada página (`refreshDailyPages`) — nada fica
    //   anotado aqui, senão a anotação, aplicada no fim, invalidaria de novo o
    //   que ele acabou de regenerar;
    // - **no resto** (o run falhou, a espera estourou, o botão do painel), a
    //   invalidação é anotada aqui e aplicada quando a invocação terminar,
    //   como antes. As duas chamadas que o `started` fazia (no aceite e no
    //   `SUCCESS`) eram, por essa regra, uma só, no fim.
    const scheduled = !actorId;
    const deadline = begunAt + CRON_MAX_DURATION_MS - CRON_RESPONSE_MARGIN_MS;
    // As páginas do dia — ou, sem um dia legível no disparo, a invalidação
    // de antes do 13.12.
    const refresh = async (): Promise<DailyPagesReport | null> => {
      const runDate = runDateOf(data);
      if (runDate) return refreshDailyPages(runDate, deadline);
      revalidateDailyContent();
      return null;
    };
    let revalidated = false;
    let settled: RunStatus | null = null;
    let pages: DailyPagesReport | null = null;

    if (data.outcome === 'started') {
      // **Só no disparo agendado se espera o run.** O botão do painel reentra
      // por aqui de dentro de outra requisição (`x-actor-id`) e espera esta
      // resposta; segurá-lo por até 90 s seria a tela travada. O preço é
      // aceito: o disparo manual invalida quando a requisição dele termina,
      // com o run ainda correndo.
      if (scheduled) settled = await settleRun(jobUrl, data.pipelineId);
      if (settled === 'SUCCESS') pages = await refresh();
      else revalidateDailyContent();
      revalidated = true;
    } else if (data.outcome === 'already-succeeded-today') {
      // O run do dia terminou sem nós: invalidar uma vez. Custa uma
      // regeneração por página do conjunto, com a API acordada. No botão do
      // painel, é o "atualizar o site" depois de um run que outro disparou.
      if (scheduled) pages = await refresh();
      else revalidateDailyContent();
      revalidated = true;
    } else if (data.outcome === 'already-running' && scheduled) {
      // O run do dia está correndo sem nós: esperar **o mesmo** run e
      // invalidar quando ele fechar em `SUCCESS`. Invalidar agora regeneraria
      // a partir do banco ainda sendo escrito. O botão não espera (ver acima).
      settled = await settleRun(jobUrl, data.pipelineId);
      if (settled === 'SUCCESS') {
        pages = await refresh();
        revalidated = true;
      }
    }

    return NextResponse.json({ success: true, data, revalidated, warmed, settled, pages });
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
