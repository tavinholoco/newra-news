import type { Category } from '@newranews/types';

// Rótulos padrão pt-BR (fallback). Os componentes localizados usam as chaves
// `categories.*` de messages/{locale}.json — ver lib/i18n.ts.
export const CATEGORY_LABELS: Record<Category, string> = {
  TECHNOLOGY: 'Tecnologia',
  POLITICS: 'Política',
  ECONOMY: 'Economia',
  SPORTS: 'Esportes',
  SCIENCE: 'Ciência',
  ENTERTAINMENT: 'Entretenimento',
  WORLD: 'Mundo',
  HEALTH: 'Saúde',
};

export function formatDate(dateString: string, locale = 'pt-BR'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatArticleDate(dateString: string, locale = 'pt-BR'): string {
  return new Date(dateString).toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function toDateSlug(dateString: string): string {
  return new Date(dateString).toISOString().slice(0, 10);
}

/** Taxa 0–1 → percentual inteiro (ex.: 0.956 → "96%"). */
export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Duração do pipeline em **milissegundos** → "27s" ou "1m 05s";
 * null/undefined → "—".
 *
 * A unidade é milissegundos porque é o que o backend grava:
 * `pipelineDuration = Date.now() - startedAt` em `pipeline.service.ts`, e o
 * mesmo vale para a média (`avgPipelineDuration`). Esta função interpretava o
 * valor como segundos, então um run real de ~26.500 ms aparecia como
 * "441m 40s" em vez de "26s".
 */
export function formatPipelineDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = String(Math.round(seconds % 60)).padStart(2, '0');
  return `${minutes}m ${rest}s`;
}

/** Número com separador do locale (ex.: 3484 → "3.484" em pt-BR, "3,484" em en-US). */
export function formatCount(value: number, locale = 'pt-BR'): string {
  return value.toLocaleString(locale);
}

/** 'gemini' → 'Gemini' (primeira letra maiúscula, resto intacto). */
export function formatProviderName(provider: string | null | undefined): string {
  if (!provider) return '—';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Corpo do texto → minutos de leitura, arredondando para cima (mínimo 1).
 *
 * 200 palavras por minuto é a taxa usual de texto editorial. Existe porque o
 * `readingTimeMinutes` do contrato da §24 ainda não vem da API: até a branch
 * `feat/v2-editorial-api` entrar, o frontend deriva o valor do `content`.
 */
export function readingTimeFromText(
  text: string | null | undefined,
  wordsPerMinute = 200,
): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.ceil(words / wordsPerMinute);
}
