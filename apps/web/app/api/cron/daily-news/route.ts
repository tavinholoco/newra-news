import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  PIPELINE_TRIGGER_TIMEOUT_MS,
  PIPELINE_WARM_ATTEMPTS,
  PIPELINE_WARM_TIMEOUT_MS,
} from '@/lib/timeouts';
import type { PipelineTrigger } from '@newranews/types';

export const dynamic = 'force-dynamic';

/**
 * 90 s, e o número sai da soma: `PIPELINE_WARM_ATTEMPTS × PIPELINE_WARM_TIMEOUT_MS`
 * mais o disparo dá 70 s no pior caso, e sobra margem para a resposta e para as
 * três revalidações. Era 30 s, o que não deixava espaço para acordar ninguém.
 * O teto do plano Hobby da Vercel é 300 s.
 */
export const maxDuration = 90;

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
    }
  }
  return false;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    if (revalidated) {
      // **O disparo foi aceito, não concluído** — a rota da API responde
      // `{ outcome: 'started' }` e o pipeline segue no servidor por ~55 s. A
      // invalidação aqui é otimista de propósito: ela derruba o HTML velho, e
      // quem chegar depois regenera. Se a visita cair no meio da execução, a
      // página nasce com o dado antigo e espera o `revalidate` de 3600 s.
      //
      // **Dívida, com gatilho:** esperar a conclusão exigiria sondar
      // `GET /api/jobs/:id`, que é outra chamada autenticada dentro do
      // `maxDuration` desta rota. Vale a pena quando alguém reclamar de ver
      // conteúdo do dia anterior depois de um disparo manual, que é o sintoma
      // que isto produz.
      //
      // O cache do Next grava as tags com o padrão literal da rota (ex.:
      // "_N_T_/[locale]/layout") — por isso revalidamos o padrão `/[locale]`,
      // que cobre as páginas dos dois idiomas.
      revalidatePath('/[locale]', 'layout');
      revalidatePath('/sitemap.xml');
      // O news sitemap tem janela de 48h e é a rota que o Google Notícias lê
      // logo depois de a matéria sair; deixá-lo esperar o `revalidate` de 15 min
      // atrasaria justamente o que ele existe para acelerar.
      revalidatePath('/news-sitemap.xml');
    }

    return NextResponse.json({ success: true, data, revalidated, warmed });
  } catch {
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
