import {
  ARTICLE_USER_PROMPT,
  ARTICLE_USER_PROMPT_SUFFIX,
  MATERIAL_END,
  MATERIAL_START,
} from '../../config/ai-prompts';
import type { RawNewsItem, GeneratedArticle } from '../types';

const MAX_DESCRIPTION_LENGTH = 300;
const MAX_CONTENT_LENGTH = 400;

const NAMED_ENTITIES: Record<string, string> = {
  // Core HTML
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  // Portuguese accented characters (lower + upper)
  aacute: '\u00E1', Aacute: '\u00C1',
  agrave: '\u00E0', Agrave: '\u00C0',
  atilde: '\u00E3', Atilde: '\u00C3',
  acirc: '\u00E2', Acirc: '\u00C2',
  eacute: '\u00E9', Eacute: '\u00C9',
  egrave: '\u00E8', Egrave: '\u00C8',
  ecirc: '\u00EA', Ecirc: '\u00CA',
  iacute: '\u00ED', Iacute: '\u00CD',
  oacute: '\u00F3', Oacute: '\u00D3',
  otilde: '\u00F5', Otilde: '\u00D5',
  ocirc: '\u00F4', Ocirc: '\u00D4',
  uacute: '\u00FA', Uacute: '\u00DA',
  uuml: '\u00FC', Uuml: '\u00DC',
  ccedil: '\u00E7', Ccedil: '\u00C7',
  ntilde: '\u00F1', Ntilde: '\u00D1',
  // Typographic punctuation
  ndash: '\u2013', mdash: '\u2014',
  lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201C', rdquo: '\u201D',
  hellip: '\u2026', bull: '\u2022',
  copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
  euro: '\u20AC', pound: '\u00A3',
};

/**
 * Quantas vezes decodificar antes de desistir.
 *
 * Uma passada só não basta: o acervo tem texto **duplamente escapado**, em que
 * `&amp;eacute;` vira `&eacute;` na primeira volta e só então `é`. Enquanto
 * isso não convergia, o job de renormalização reescrevia as mesmas linhas em
 * toda execução — foi assim que este defeito apareceu.
 *
 * O teto existe porque a decodificação é um ponto fixo: sem ele, um texto
 * patológico faria o laço girar. Três passadas cobrem escape duplo e triplo,
 * que é mais do que qualquer feed produz.
 */
const MAX_DECODE_PASSES = 3;

function decodeOnce(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}

export function decodeEntities(text: string): string {
  let decoded = text;

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass++) {
    const next = decodeOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function stripHtml(html: string): string {
  return decodeEntities(
    html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

/**
 * Neutraliza o que, dentro do material, se parece com o **envelope** do prompt.
 *
 * `stripHtml` limpa marcação; não limpa instrução. E o material aqui é escrito
 * por terceiros — 13 feeds RSS mais a NewsData.io, centenas de itens por dia —
 * e vai colado no mesmo texto que carrega as instruções do modelo. O que sai
 * dali é publicado **sem revisão humana**: o Stage 7 persiste, o 7.5 manda por
 * e-mail para os assinantes e a Home passa a exibir. Uma manchete construída
 * para instruir o modelo entra pela porta da notícia e sai assinada pelo site.
 *
 * A defesa tem três camadas, e esta é a segunda:
 *
 * 1. **fronteira declarada** — o material vai entre `MATERIAL_START` e
 *    `MATERIAL_END`, e o system prompt manda tratar tudo ali como dado;
 * 2. **o material não pode falsificar a fronteira** (esta função) — quem
 *    escrevesse o próprio `MATERIAL_END` sairia do bloco, e o resto do texto
 *    dele viraria instrução. É a única coisa aqui que é *bypass*, e não
 *    persuasão, e por isso é a única tratada por substituição literal. Quebra
 *    de linha some pela mesma razão: é com ela que se falsifica o rótulo de um
 *    campo do item seguinte.
 * 3. **validação da saída** — `parseMarkdownResponse` recusa resposta fora do
 *    formato (ver lá).
 *
 * **O que esta função deliberadamente não faz:** filtrar frases suspeitas
 * ("ignore as instruções acima"). Lista de palavra proibida em texto
 * jornalístico é falso positivo garantido — uma matéria *sobre* injeção de
 * prompt seria censurada — e não fecha nada: a mesma ordem se escreve de mil
 * maneiras. Quem trata disso é a camada 1, que não depende de adivinhar a
 * forma.
 */
export function neutralizeMaterialDelimiters(text: string): string {
  return text.split(MATERIAL_START).join('[…]').split(MATERIAL_END).join('[…]');
}

export function formatNewsItems(newsItems: RawNewsItem[]): string {
  return newsItems
    .map((item, index) => {
      const safe = (value: string): string =>
        neutralizeMaterialDelimiters(value)
          .replace(/[\r\n]+/g, ' ')
          .trim();
      const cleanDescription = truncate(
        safe(stripHtml(item.description)),
        MAX_DESCRIPTION_LENGTH,
      );
      const cleanContent = item.content
        ? truncate(safe(stripHtml(item.content)), MAX_CONTENT_LENGTH)
        : 'N/A';
      return `${index + 1}. TÍTULO: ${safe(item.title)}\nFONTE: ${safe(item.source)}\nCATEGORIA: ${item.category}\nDATA: ${item.publishedAt.toISOString()}\nDESCRIÇÃO: ${cleanDescription}\nCONTEÚDO: ${cleanContent}`;
    })
    .join('\n\n');
}

/**
 * Menor tamanho de corpo que ainda e um briefing.
 *
 * O prompt pede 800-1200 palavras. O piso aqui e uma ordem de grandeza abaixo
 * de proposito: nao esta medindo qualidade editorial, esta pegando a resposta
 * que **nao e um artigo** — a recusa de uma linha, o "Ok, entendi", o eco de
 * uma instrucao que veio no material.
 */
const MIN_ARTICLE_CONTENT_LENGTH = 400;

/**
 * A saida tambem e superficie, e ate a Fase 9 ela era aceita como viesse.
 *
 * Esta e a terceira camada da defesa contra injecao pelo feed (as outras duas
 * estao em `neutralizeMaterialDelimiters`): **o formato esperado ja existia e
 * nao era exigido**. Quando nao havia `# `, o parser pegava a primeira linha
 * nao vazia como titulo e seguia em frente — ou seja, uma resposta que
 * obedecesse ao material em vez das instrucoes virava artigo publicado do mesmo
 * jeito, e o pipeline registrava sucesso.
 *
 * Recusar aqui e barato e chega no lugar certo: quem chama e o Stage 6, o erro
 * derruba o run **antes** do Stage 7 persistir e do 7.5 mandar e-mail, e o
 * `PipelineLog` guarda o motivo. O dia fica sem briefing — que e o que a Home
 * ja sabe desenhar (`hero`/`briefing` nulos) — em vez de ficar com um briefing
 * que nao se sabe de onde veio.
 */
export class MalformedArticleError extends Error {
  constructor(reason: string) {
    super(`AI response is not a valid article: ${reason}`);
    this.name = 'MalformedArticleError';
  }
}

/**
 * Monta o prompt de usuario inteiro: instrucoes, abertura do material, o
 * material, fechamento.
 *
 * Existe para que **a fronteira nao dependa de quem chama**. Antes da Fase 9
 * cada provider fazia `ARTICLE_USER_PROMPT + formatNewsItems(items)` por conta
 * propria — duas copias da mesma linha, e um terceiro provider nasceria com uma
 * terceira. Com o fechamento do bloco agora fazendo parte do contrato, esquecer
 * o sufixo deixaria o material aberto ate o fim do texto, que e exatamente a
 * condicao que a fronteira existe para impedir.
 */
export function buildArticleUserPrompt(newsItems: RawNewsItem[]): string {
  return ARTICLE_USER_PROMPT + formatNewsItems(newsItems) + ARTICLE_USER_PROMPT_SUFFIX;
}

export function parseMarkdownResponse(markdown: string): GeneratedArticle {
  const lines = markdown.split('\n');
  const h1Index = lines.findIndex((line) => line.startsWith('# '));

  if (h1Index === -1) {
    throw new MalformedArticleError('no "# " title line');
  }

  const title = (lines[h1Index] ?? '').replace(/^#\s+/, '').trim();
  const contentLines = lines.filter((_, i) => i !== h1Index);

  const summary =
    contentLines
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('#')) ?? '';

  const content = contentLines.join('\n').trim();

  if (title.length === 0) {
    throw new MalformedArticleError('empty title');
  }
  if (content.length < MIN_ARTICLE_CONTENT_LENGTH) {
    throw new MalformedArticleError(
      `content too short (${content.length} < ${MIN_ARTICLE_CONTENT_LENGTH})`,
    );
  }

  return { title, summary, content };
}

/** Erros transitórios de API: timeout (AbortError), HTTP 429 (rate limit) e 5xx. */
export function isTransientApiError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  if (error instanceof Error) {
    // Ex.: "Gemini API error 429: ..." e "Groq API error: 500 Internal Server Error"
    const match = /API error:? (\d{3})/.exec(error.message);
    if (match) {
      const status = Number(match[1]);
      return status === 429 || status >= 500;
    }
  }

  return false;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry com backoff compartilhado pelos providers de IA (Gemini e Groq): erros
// transitórios (429/5xx/timeout) são re-tentados antes de desistir — foi uma
// falha transitória da Gemini que derrubou o run de 17/08/2026 às 08:00 BRT.
const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1_000;
const MAX_JITTER_MS = 500;
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * Lê o header `Retry-After` (delta-seconds ou HTTP-date) e devolve o delay em ms,
 * ou `null` se ausente/inválido.
 */
export function parseRetryAfterMs(value: string | null, now = Date.now()): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    return Math.max(0, date - now);
  }

  return null;
}

/** Anexa o delay do `Retry-After` ao erro, quando o header existir. */
export function attachRetryAfter<T extends Error>(
  error: T,
  headers: Headers | undefined,
): T {
  const retryAfterMs = parseRetryAfterMs(headers?.get('retry-after') ?? null);
  if (retryAfterMs !== null) {
    (error as T & { retryAfterMs?: number }).retryAfterMs = retryAfterMs;
  }
  return error;
}

function retryDelayMs(error: unknown, attempt: number): number {
  const retryAfterMs = (error as Error & { retryAfterMs?: number }).retryAfterMs;
  if (retryAfterMs !== undefined) {
    // O servidor mandou quando tentar de novo; respeita, mas com teto para não
    // travar o pipeline (o fallback existe justamente para não esperar demais).
    return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
  }
  return BASE_RETRY_DELAY_MS * 2 ** (attempt - 1) + Math.random() * MAX_JITTER_MS;
}

/** Tenta `request` até `MAX_RETRY_ATTEMPTS`, retentando só erros transitórios. */
export async function withRetry<T>(
  request: () => Promise<T>,
  provider: string,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      if (attempt >= MAX_RETRY_ATTEMPTS || !isTransientApiError(error)) {
        throw error;
      }

      const delayMs = retryDelayMs(error, attempt);
      console.warn(
        `${provider} API transient error (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}), retrying in ${Math.round(delayMs)}ms`,
      );
      await sleep(delayMs);
    }
  }
}
