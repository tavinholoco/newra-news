import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { PIPELINE_TRIGGER_TIMEOUT_MS } from '@/lib/timeouts';
import type { PipelineTrigger } from '@newranews/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

  try {
    const response = await fetch(jobUrl, {
      method: 'POST',
      // O que se espera aqui é o **aceite**, não a execução: a rota da API
      // responde `{ outcome, pipelineId, startedAt }` e o pipeline segue no
      // servidor quando o desfecho é `started`. Os
      // 20 s cabem no `maxDuration = 30` desta rota e ainda deixam margem para
      // o cold start do Render, que é quem atende o cron das 11h UTC — a essa
      // hora a API costuma estar dormindo.
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
      // `maxDuration = 30` desta rota — e o cron das 11h ainda paga o cold start
      // do Render. Vale a pena quando alguém reclamar de ver conteúdo do dia
      // anterior depois de um disparo manual, que é o sintoma que isto produz.
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

    return NextResponse.json({ success: true, data, revalidated });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Pipeline trigger failed' },
      { status: 500 },
    );
  }
}
