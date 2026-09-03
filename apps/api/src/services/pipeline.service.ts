import { prisma, Prisma } from '@newranews/database';
import { fetchAll } from './news-fetcher.service';
import { generateArticle } from './ai.service';
import { sendDailyNewsletter } from './newsletter.service';
import { renormalizeStoredNews } from './news-renormalizer.service';
import { deleteExpiredProductEvents } from './product-event.service';
import { extractErrorDetail, logPipelineEvent } from './pipeline-event.service';
import { ARTICLE_PROMPT_VERSION } from '../config/ai-prompts';
import type { RawNewsItem } from '../providers/types';
import type { PipelineTrigger } from '@newranews/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Depois de quanto tempo um `RUNNING` deixa de ser "está rodando" e passa a ser
 * "morreu sem conseguir contar".
 *
 * **O run só vira `SUCCESS` na etapa 9.** Se o processo morre antes — e ele
 * morre: em 03/09/2026 o Render mandou `SIGTERM` no meio da etapa 8.5, porque a
 * varredura do acervo segurou o event loop por 45 s e os health checks pararam
 * de ser respondidos —, a linha fica em `RUNNING` para sempre. Não há `catch`
 * que alcance isso, porque `process.exit` não desenrola pilha nenhuma.
 *
 * O estrago não é o registro errado, é a idempotência: o `findFirst` abaixo
 * aceita `RUNNING` como "já tem run hoje", então **um cadáver recusa todo
 * disparo pelo resto do dia** — e a tela responde "já está rodando" sobre algo
 * que morreu de manhã. É a mesma família do episódio de 25/08, quando o painel
 * dizia "disparado com sucesso" sem ter disparado: resposta que não distingue
 * o que de fato aconteceu.
 *
 * **Quinze minutos é folga sobre o pipeline inteiro, não sobre uma etapa.** Os
 * runs medidos fecham em torno de 20 s a 60 s; o mais lento tem a geração de
 * IA com três tentativas e o fallback do Groq no caminho, e ainda assim não
 * passa de poucos minutos. Um `RUNNING` de quinze minutos não está lento, está
 * morto.
 */
const STALE_RUN_MS = 15 * 60 * 1000;

/**
 * Grava a lista de fontes do briefing (plano V2 §18.4).
 *
 * Substitui as fontes em vez de acrescentar: o artigo é um upsert por data, e
 * uma segunda execução no mesmo dia escolhe outro conjunto de notícias — sem a
 * remoção, o briefing acumularia as fontes dos dois runs.
 *
 * O `newsId` é resolvido por `sourceUrl` (que é `@unique` em News) porque o
 * `createMany` do Stage 4 não devolve ids. Quando não resolve, a fonte é
 * gravada mesmo assim com `newsId` nulo — perder o registro de auditoria é pior
 * que perder o ponteiro, e os campos que a interface mostra estão todos aqui.
 */
async function persistBriefingSources(
  articleId: string,
  selected: RawNewsItem[],
): Promise<number> {
  const rows = await prisma.news.findMany({
    where: { sourceUrl: { in: selected.map((item) => item.sourceUrl) } },
    select: { id: true, sourceUrl: true },
  });
  const idByUrl = new Map(rows.map((row) => [row.sourceUrl, row.id]));

  const data = selected.map((item, index) => ({
    articleId,
    newsId: idByUrl.get(item.sourceUrl) ?? null,
    position: index,
    title: item.title,
    source: item.source,
    sourceUrl: item.sourceUrl,
  }));

  await prisma.$transaction([
    prisma.briefingSource.deleteMany({ where: { articleId } }),
    prisma.briefingSource.createMany({ data }),
  ]);

  return data.length;
}

function deduplicateByUrl(items: RawNewsItem[]): RawNewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
}

function countByCategory(items: RawNewsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

function selectTopItems(items: RawNewsItem[], limit = 15): RawNewsItem[] {
  return [...items]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Dispara o pipeline do dia — **ou diz que não disparou**.
 *
 * A idempotência por dia é antiga e continua certa: o cron das 11h UTC e o
 * botão do painel apontam para a mesma função, e dois runs no mesmo dia
 * gerariam o briefing duas vezes e gastariam duas chamadas de IA.
 *
 * **O que mudou é a resposta.** Ela devolvia só o id, e quem chamava não tinha
 * como saber se aquele id era do run que acabara de nascer ou do que já tinha
 * fechado horas antes — os dois casos chegavam ao painel como "disparado com
 * sucesso". Devolver o desfecho é o que permite a tela dizer a verdade; ver
 * `PipelineTriggerOutcome` em `packages/types`, onde o episódio está datado.
 */
export async function triggerPipeline(): Promise<PipelineTrigger> {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // Idempotency: skip if pipeline already succeeded or is running today
  const existingLog = await prisma.pipelineLog.findFirst({
    where: {
      startedAt: { gte: today, lt: tomorrow },
      status: { in: ['SUCCESS', 'RUNNING'] },
    },
  });
  if (existingLog) {
    const staleForMs = Date.now() - existingLog.startedAt.getTime();
    const isStale = existingLog.status === 'RUNNING' && staleForMs > STALE_RUN_MS;

    if (!isStale) {
      return {
        // Os dois merecem frases diferentes na tela: "já está rodando, espere" e
        // "já rodou, não vai rodar de novo hoje" levam a ações opostas.
        outcome:
          existingLog.status === 'RUNNING'
            ? 'already-running'
            : 'already-succeeded-today',
        pipelineId: existingLog.id,
        startedAt: existingLog.startedAt.toISOString(),
      };
    }

    // Enterra o cadáver antes de seguir. Ver `STALE_RUN_MS`.
    //
    // `errorStage` fica **null de propósito**: o processo morreu sem escrever, e
    // o `currentStage` foi embora com ele. Chutar uma etapa aqui poria no banco
    // um número que ninguém mediu — a etapa real, quando existe, sai dos
    // `PipelineEvent` que o run alcançou a gravar.
    const detail = {
      message: `Run marked FAILED after ${Math.round(staleForMs / 60_000)} min in RUNNING with no completion — the process very likely died mid-run (SIGTERM, OOM or restart).`,
      reason: 'stale-running',
    };
    await prisma.pipelineLog.update({
      where: { id: existingLog.id },
      data: {
        status: 'FAILED',
        error: detail.message,
        errorDetail: detail as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    // Etapa 0: o evento é sobre o run inteiro, não sobre uma das nove etapas —
    // e 0 não colide com nenhuma delas.
    await logPipelineEvent(existingLog.id, 0, 'ERROR', detail.message, {
      ...detail,
      startedAt: existingLog.startedAt.toISOString(),
    });

    // E segue para criar um run novo: o desfecho é `started` porque é o que
    // este chamado fez. Que havia um cadáver no caminho é história do run
    // velho, e está gravada nele — não no contrato de quem acabou de disparar.
  }

  const log = await prisma.pipelineLog.create({
    data: { status: 'RUNNING' },
  });

  void runPipeline(log.id).catch((err: unknown) => {
    console.error(`[pipeline] unhandled error for log ${log.id}:`, err);
  });

  return {
    outcome: 'started',
    pipelineId: log.id,
    startedAt: log.startedAt.toISOString(),
  };
}

// ── Core pipeline ───────────────────────────────────────────────────────────

async function runPipeline(pipelineLogId: string): Promise<void> {
  const startedAt = Date.now();
  const today = startOfDay(new Date());

  // Etapa atual — usada para gravar o errorStage quando o pipeline falha
  let currentStage = 1;

  const metrics = {
    newsDataCount: 0,
    rssCount: 0,
    newsCollected: 0,
    newsByCategory: {} as Record<string, number>,
    articleGenerated: false,
    aiProvider: undefined as string | undefined,
    cleanupCount: 0,
    pipelineErrors: 0,
  };

  try {
    // Stage 1: Collect news (NewsData.io + RSS)
    currentStage = 1;
    const { newsDataItems, rssItems, allItems, warnings } = await fetchAll();
    metrics.newsDataCount = newsDataItems.length;
    metrics.rssCount = rssItems.length;
    await logPipelineEvent(pipelineLogId, 1, 'INFO', 'News collected', {
      newsDataCount: newsDataItems.length,
      rssCount: rssItems.length,
      total: allItems.length,
    });

    // **A colheita degradada vira registro, e não só um número menor.**
    //
    // Um provider que falha ou volta vazio não aborta o dia — e é justamente
    // por isso que ele sumia: o run seguia para `SUCCESS` com metade das
    // notícias, indistinguível de um dia bom, e o único rastro era um
    // `console.warn` no stdout do Render, que ninguém lê. Aqui ele passa a
    // caber no `PipelineEvent` (visível em `GET /api/dev/logs/:id`) e a
    // contar em `DailyMetric.pipelineErrors`.
    //
    // **Só o nível de provider conta como erro.** Feed especializado que
    // publica devagar fica legitimamente vazio em dia comum — contá-lo faria a
    // luz acender todos os dias, e luz que acende todo dia é luz que se
    // aprende a ignorar. Ele é gravado no evento assim mesmo, porque a fonte
    // que morreu de vez só aparece na sequência de dias vazios (foi como a
    // `Reuters` passou despercebida).
    if (warnings.length > 0) {
      metrics.pipelineErrors += warnings.filter(
        (warning) => warning.kind !== 'feed-empty',
      ).length;
      await logPipelineEvent(pipelineLogId, 1, 'WARN', 'Collection degraded', {
        warnings,
      });
    }

    // Stage 2: Normalization already handled by providers (RawNewsItem format)

    // Stage 3: Deduplicate by sourceUrl
    currentStage = 3;
    const deduplicated = deduplicateByUrl(allItems);
    metrics.newsCollected = deduplicated.length;
    metrics.newsByCategory = countByCategory(deduplicated);
    await logPipelineEvent(pipelineLogId, 3, 'INFO', 'News deduplicated', {
      before: allItems.length,
      after: deduplicated.length,
    });

    // Stage 4: Persist news items
    // skipDuplicates: se o pipeline rodar de novo no mesmo dia (ex.: retry manual
    // após falha do cron), URLs já persistidas não geram linhas duplicadas — a
    // constraint única em News.sourceUrl garante isso no banco.
    currentStage = 4;
    const persisted = await prisma.news.createMany({
      data: deduplicated,
      skipDuplicates: true,
    });
    await logPipelineEvent(pipelineLogId, 4, 'INFO', 'News persisted', {
      count: persisted.count,
      skipped: deduplicated.length - persisted.count,
    });

    // Stage 5: Select top items for AI generation
    currentStage = 5;
    const selected = selectTopItems(deduplicated);

    if (selected.length === 0) {
      throw new Error('No news items available for article generation');
    }
    await logPipelineEvent(pipelineLogId, 5, 'INFO', 'Top items selected for AI', {
      count: selected.length,
    });

    // Stage 6: Generate article via AI (Gemini → Groq fallback)
    currentStage = 6;
    const generatedAt = new Date();
    const { article, provider, modelVersion } = await generateArticle(selected);
    metrics.aiProvider = provider;
    await logPipelineEvent(pipelineLogId, 6, 'INFO', 'Article generated', {
      provider,
      modelVersion,
      promptVersion: ARTICLE_PROMPT_VERSION,
    });

    // Stage 7: Persist article (upsert by date — one article per day) com a
    // auditoria da geração e a lista de fontes (§18.4 do plano V2).
    currentStage = 7;
    const auditFields = {
      generatedAt,
      promptVersion: ARTICLE_PROMPT_VERSION,
      modelVersion,
      status: 'PUBLISHED' as const,
    };
    const savedArticle = await prisma.article.upsert({
      where: { date: today },
      create: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        date: today,
        newsCount: selected.length,
        ...auditFields,
      },
      update: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        newsCount: selected.length,
        ...auditFields,
      },
    });

    const sourcesSaved = await persistBriefingSources(savedArticle.id, selected);

    metrics.articleGenerated = true;
    await logPipelineEvent(pipelineLogId, 7, 'INFO', 'Article persisted', {
      articleId: savedArticle.id,
      sources: sourcesSaved,
    });

    // Update log with counts before cleanup
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: { newsCount: deduplicated.length, articleId: savedArticle.id },
    });

    // Stage 7.5: Send daily newsletter (non-critical — failure does not abort
    // the pipeline). Idempotente via NewsletterLog.date unique: se o pipeline
    // rodar de novo no mesmo dia, o envio é pulado. Falhas individuais de
    // e-mail são contadas pelo service (sent/failed) e não lançam erro;
    // sem RESEND_API_KEY o provider lança por e-mail e tudo vira failed.
    // Não incrementa pipelineErrors de propósito: a newsletter é opcional e
    // sua indisponibilidade não deve marcar o dia como falha do pipeline.
    try {
      currentStage = 7.5;
      const newsletter = await sendDailyNewsletter();
      await logPipelineEvent(pipelineLogId, 7.5, 'INFO', 'Daily newsletter sent', {
        total: newsletter.total,
        sent: newsletter.sent,
        failed: newsletter.failed,
      });
    } catch (newsletterErr) {
      await logPipelineEvent(pipelineLogId, 7.5, 'WARN', 'Newsletter failed (non-critical)', {
        ...extractErrorDetail(newsletterErr),
      });
    }

    // Stage 8: Cleanup old data (non-critical — failure does not abort pipeline)
    try {
      currentStage = 8;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // A retenção de evento de produto entra **aqui**, e não numa etapa nova:
      // é o mesmo expurgo por idade que a notícia e o briefing já fazem, e o
      // que a §4 dos slots pede (90 dias no nível de evento). Etapa própria
      // seria um segundo lugar para lembrar de olhar quando algo parasse.
      const [deletedNews, deletedLogs, deletedArticles, deletedEvents] =
        await Promise.all([
          prisma.news.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } }),
          prisma.pipelineLog.deleteMany({
            where: { startedAt: { lt: thirtyDaysAgo }, id: { not: pipelineLogId } },
          }),
          prisma.article.deleteMany({ where: { createdAt: { lt: ninetyDaysAgo } } }),
          deleteExpiredProductEvents(),
        ]);
      metrics.cleanupCount =
        deletedNews.count + deletedLogs.count + deletedArticles.count + deletedEvents;
      await logPipelineEvent(pipelineLogId, 8, 'INFO', 'Cleanup completed', {
        deleted: metrics.cleanupCount,
        productEvents: deletedEvents,
      });
    } catch (cleanupErr) {
      metrics.pipelineErrors += 1;
      await logPipelineEvent(pipelineLogId, 8, 'WARN', 'Cleanup failed (non-critical)', {
        ...extractErrorDetail(cleanupErr),
      });
    }

    // Stage 8.5: Reaplica as regras de ingestão ao acervo (non-critical —
    // failure does not abort pipeline).
    //
    // **É o que faz a correção de regra valer para o que já está gravado.**
    // Consertar a ingestão só conserta o que entra; as linhas antigas seguem
    // servidas até o cleanup, e a Home da V2 agrupa por categoria, então uma
    // regra corrigida hoje levaria 30 dias para aparecer inteira. Rodando aqui,
    // todo dia, o acervo converge sozinho no dia seguinte a qualquer mudança de
    // regra — sem ninguém lembrar de disparar nada, sem segredo na mão de
    // alguém, e sem voltar a divergir na próxima vez.
    //
    // **Depois do cleanup, de propósito:** renormalizar linha que a etapa 8
    // acabou de apagar é trabalho jogado fora.
    //
    // É idempotente e barato em regime: a primeira execução depois de uma
    // mudança de regra ajusta o que precisa, e as seguintes varrem e não
    // escrevem nada. Fica em `clear-only`, que é o subconjunto seguro — ver
    // `CategoryMode`.
    try {
      currentStage = 8.5;
      const renormalized = await renormalizeStoredNews({ dryRun: false });
      await logPipelineEvent(pipelineLogId, 8.5, 'INFO', 'Stored news renormalized', {
        scanned: renormalized.scanned,
        textChanged: renormalized.textChanged,
        imageRecovered: renormalized.imageRecovered,
        categoryChanged: renormalized.categoryChanged,
        categorySkipped: renormalized.categorySkipped,
      });
    } catch (renormalizeErr) {
      metrics.pipelineErrors += 1;
      await logPipelineEvent(
        pipelineLogId,
        8.5,
        'WARN',
        'Renormalization failed (non-critical)',
        { ...extractErrorDetail(renormalizeErr) },
      );
    }

    // Stage 9: Record daily metrics (non-critical — failure does not abort pipeline)
    try {
      currentStage = 9;
      const pipelineDuration = Date.now() - startedAt;
      await prisma.dailyMetric.upsert({
        where: { date: today },
        create: {
          date: today,
          newsCollected: metrics.newsCollected,
          newsByCategory: metrics.newsByCategory,
          newsApiCount: metrics.newsDataCount, // coluna historica; hoje mede NewsData.io
          rssCount: metrics.rssCount,
          articleGenerated: metrics.articleGenerated,
          aiProvider: metrics.aiProvider,
          cleanupCount: metrics.cleanupCount,
          pipelineDuration,
          pipelineErrors: metrics.pipelineErrors,
        },
        update: {
          newsCollected: metrics.newsCollected,
          newsByCategory: metrics.newsByCategory,
          newsApiCount: metrics.newsDataCount, // coluna historica; hoje mede NewsData.io
          rssCount: metrics.rssCount,
          articleGenerated: metrics.articleGenerated,
          aiProvider: metrics.aiProvider,
          cleanupCount: metrics.cleanupCount,
          pipelineDuration,
          pipelineErrors: metrics.pipelineErrors,
        },
      });
      await logPipelineEvent(pipelineLogId, 9, 'INFO', 'Daily metrics recorded', {
        durationMs: pipelineDuration,
      });
    } catch (metricsErr) {
      await logPipelineEvent(pipelineLogId, 9, 'WARN', 'Metrics recording failed (non-critical)', {
        ...extractErrorDetail(metricsErr),
      });
    }

    // Mark pipeline as successful
    currentStage = 9;
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: { status: 'SUCCESS', completedAt: new Date() },
    });
    await logPipelineEvent(pipelineLogId, 9, 'INFO', 'Pipeline completed successfully', {
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const detail = extractErrorDetail(error);

    // Fallback de IA (Gemini → Groq): se o provider primário falhou antes do
    // fallback (erro carregado por `withPrimaryError` no ai.service), registra
    // os dois erros — WARN do primário + ERROR final — no PipelineLog.
    const primaryError = (error as { primaryError?: unknown }).primaryError;
    if (primaryError !== undefined) {
      const primaryDetail = extractErrorDetail(primaryError);
      detail.primaryError = primaryDetail;
      await logPipelineEvent(pipelineLogId, currentStage, 'WARN', 'Primary provider failed before fallback', {
        ...primaryDetail,
      });
    }

    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: {
        status: 'FAILED',
        error: detail.message,
        errorStage: currentStage,
        errorDetail: { ...detail } as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    await logPipelineEvent(pipelineLogId, currentStage, 'ERROR', detail.message, {
      ...detail,
    });
    throw error;
  }
}
