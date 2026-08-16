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

/** Duração em segundos → "27s" ou "1m 05s"; null/undefined → "—". */
export function formatPipelineDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
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
