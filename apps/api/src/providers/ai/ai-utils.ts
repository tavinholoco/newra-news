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

export function formatNewsItems(newsItems: RawNewsItem[]): string {
  return newsItems
    .map((item, index) => {
      const cleanDescription = truncate(stripHtml(item.description), MAX_DESCRIPTION_LENGTH);
      const cleanContent = item.content
        ? truncate(stripHtml(item.content), MAX_CONTENT_LENGTH)
        : 'N/A';
      return `${index + 1}. TÍTULO: ${item.title}\nFONTE: ${item.source}\nCATEGORIA: ${item.category}\nDATA: ${item.publishedAt.toISOString()}\nDESCRIÇÃO: ${cleanDescription}\nCONTEÚDO: ${cleanContent}`;
    })
    .join('\n\n');
}

export function parseMarkdownResponse(markdown: string): GeneratedArticle {
  const lines = markdown.split('\n');
  const h1Index = lines.findIndex((line) => line.startsWith('# '));

  let title: string;
  let contentLines: string[];

  if (h1Index !== -1) {
    title = (lines[h1Index] ?? '').replace(/^#\s+/, '').trim();
    contentLines = lines.filter((_, i) => i !== h1Index);
  } else {
    const firstNonEmptyIndex = lines.findIndex((l) => l.trim() !== '');
    title = lines[firstNonEmptyIndex]?.trim() ?? '';
    contentLines = lines.slice(firstNonEmptyIndex + 1);
  }

  const summary =
    contentLines
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('#')) ?? '';

  const content = contentLines.join('\n').trim();

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
