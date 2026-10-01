import { generateArticleWithGemini } from '../providers/ai/gemini.provider';
import { generateArticleWithGroq } from '../providers/ai/groq.provider';
import { formatNewsItems } from '../providers/ai/ai-utils';
import {
  guardArticleOutput,
  type OutputGuardVerdict,
} from '../providers/ai/output-guard';
import { GateBlockedError } from './pipeline-gates.service';
import { env } from '../config/env';
import type { RawNewsItem, GeneratedArticle } from '../providers/types';
import { baseLogger } from '../utils/logger';

export interface GenerateArticleResult {
  article: GeneratedArticle;
  provider: 'gemini' | 'groq';
  /** Modelo que de fato gerou o artigo — gravado em `Article.modelVersion`. */
  modelVersion: string;
  /**
   * O erro do Gemini quando foi o Groq que entregou.
   *
   * Até a verificação pós-merge da Fase 4 ele só sobrevivia ao **fallback que
   * também falhava** (`withPrimaryError`, abaixo); no dia bom — Gemini em 503,
   * Groq salvando — restava uma linha de `warn` no stdout do Render, e o
   * `DailyMetric.aiProvider`. É justamente a degradação mais frequente medida
   * neste projeto (dois dias seguidos em 02–03/09), e não tinha registro
   * durável. O pipeline o grava como `WARN` da etapa 6.
   *
   * **Desde a Fase 9 pode ser um `GateBlockedError`**: o Gemini respondeu, o
   * portão de saída reprovou por **qualidade**, e o Groq serviu. O pipeline o
   * grava como `WARN` da etapa 6.5, com o motivo.
   */
  primaryError?: unknown;
  /**
   * O veredito do portão de saída sobre o artigo **que foi servido** — sem
   * bloqueio, por definição (com bloqueio, esta função não devolve). Os avisos
   * e as medidas vão para o evento da etapa 6.5.
   */
  guard: OutputGuardVerdict;
}

/** A forma do guarda, injetável só para o teste medir a fiação. */
export type ArticleOutputGuard = (article: GeneratedArticle, material: string) => OutputGuardVerdict;

type Provider = GenerateArticleResult['provider'];

/**
 * Gera o briefing — Gemini, e o Groq de reserva — **com o portão de saída
 * entre os dois.** (§13.2 do plano de observabilidade, Fase 9)
 *
 * O guarda roda **por tentativa**, e é isso que torna a regra da §13.2
 * possível: "qualidade cai para o provider de reserva uma vez; segurança falha
 * o dia" só existe se o veredito for lido entre a resposta do Gemini e a
 * decisão de chamar o Groq. Um guarda aplicado depois do fallback não saberia
 * mais qual dos dois escreveu, nem poderia impedir a segunda chamada.
 *
 * ```
 * Gemini responde ─► guarda ─┬─ aprova (avisos ok) ─► serve
 *                            ├─ bloqueia por qualidade ─► Groq ─► guarda ─┬─ aprova ─► serve (degradado)
 *                            │                                            └─ bloqueia ─► o dia falha
 *                            └─ bloqueia por SEGURANÇA ─► o dia falha. Sem Groq.
 * Gemini falha (transporte) ─► Groq ─► guarda ─┬─ aprova ─► serve (degradado)
 *                                              └─ bloqueia ─► o dia falha
 * ```
 *
 * **O bloqueio de segurança não cai para o provider de reserva**, e a razão
 * está escrita no `GateReason` do `output-guard.ts`: a causa está no material,
 * não no modelo, e mandar o mesmo material ao segundo modelo é repetir o
 * ataque com um oráculo diferente. Armadilha 22.
 *
 * O `material` contra o qual o guarda ancora URLs é **a mesma string que foi
 * ao modelo** — `formatNewsItems(newsItems)` é determinística, e os dois
 * providers a montam por `buildArticleUserPrompt`.
 */
export async function generateArticle(
  newsItems: RawNewsItem[],
  guard: ArticleOutputGuard = guardArticleOutput,
): Promise<GenerateArticleResult> {
  const material = formatNewsItems(newsItems);

  let primaryError: unknown;
  try {
    const article = await generateArticleWithGemini(newsItems);
    const verdict = guard(article, material);
    const blocked = blockOf(verdict, 'gemini');
    if (blocked === null) {
      return { article, provider: 'gemini', modelVersion: env.GEMINI_MODEL, guard: verdict };
    }
    if (blocked.reason === 'security') throw blocked;
    primaryError = blocked;
    baseLogger.warn({ err: blocked }, 'Output guard blocked the Gemini article, falling back to Groq');
  } catch (geminiError) {
    if (geminiError instanceof GateBlockedError && geminiError.reason === 'security') {
      throw geminiError;
    }
    if (primaryError === undefined) {
      primaryError = geminiError;
      baseLogger.warn({ err: geminiError }, 'Gemini provider failed, falling back to Groq');
    }
  }

  try {
    const article = await generateArticleWithGroq(newsItems);
    const verdict = guard(article, material);
    const blocked = blockOf(verdict, 'groq');
    if (blocked !== null) throw blocked;
    return {
      article,
      provider: 'groq',
      modelVersion: env.GROQ_MODEL,
      primaryError,
      guard: verdict,
    };
  } catch (groqError) {
    // Fallback também falhou: carrega o erro primário (Gemini) junto ao erro
    // final (Groq) para o pipeline persistir os DOIS no PipelineLog — sem
    // isso, a causa real que disparou o fallback se perde (só o Groq 404
    // ficava registrado, como no run de 17/08/2026).
    throw withPrimaryError(groqError, primaryError);
  }
}

/**
 * O primeiro bloqueio do veredito como erro — segurança antes de qualidade,
 * que é a ordem em que o guarda os lista. `null` é aprovado.
 */
function blockOf(verdict: OutputGuardVerdict, provider: Provider): GateBlockedError | null {
  const first = verdict.blocks[0];
  if (first === undefined) return null;
  return new GateBlockedError({
    gate: 'exit',
    check: first.check,
    reason: first.reason,
    detail: first.detail,
    provider,
  });
}

function withPrimaryError(error: unknown, primaryError: unknown): Error {
  const err = error instanceof Error ? error : new Error(String(error));
  (err as Error & { primaryError?: unknown }).primaryError = primaryError;
  return err;
}
