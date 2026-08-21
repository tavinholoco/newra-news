import { describe, it, expect } from 'vitest';
import {
  CATEGORY_LABELS,
  formatDate,
  formatDateTime,
  formatArticleDate,
  toDateSlug,
  formatPercent,
  formatPipelineDuration,
  formatCount,
  formatProviderName,
  readingTimeFromText,
} from '@/lib/format';

describe('CATEGORY_LABELS', () => {
  it('should map all 8 categories to pt-BR labels', () => {
    expect(CATEGORY_LABELS).toEqual({
      TECHNOLOGY: 'Tecnologia',
      POLITICS: 'Política',
      ECONOMY: 'Economia',
      SPORTS: 'Esportes',
      SCIENCE: 'Ciência',
      ENTERTAINMENT: 'Entretenimento',
      WORLD: 'Mundo',
      HEALTH: 'Saúde',
    });
  });
});

describe('formatDate', () => {
  it('should format an ISO date as pt-BR short date', () => {
    const result = formatDate('2024-01-01T12:00:00.000Z');
    expect(result).toMatch(/01 de jan/);
    expect(result).toContain('2024');
  });
});

describe('formatArticleDate', () => {
  it('should format with weekday and full month in pt-BR', () => {
    const result = formatArticleDate('2024-01-01T12:00:00.000Z');
    expect(result).toMatch(/segunda-feira/i);
    expect(result).toContain('janeiro');
    expect(result).toContain('2024');
  });
});

describe('toDateSlug', () => {
  it('should return YYYY-MM-DD from an ISO date', () => {
    expect(toDateSlug('2024-01-01T12:00:00.000Z')).toBe('2024-01-01');
  });
});

describe('formatPercent', () => {
  it('should convert a 0-1 rate to a rounded percentage', () => {
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.956)).toBe('96%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('formatPipelineDuration', () => {
  it('should format milliseconds as a compact duration', () => {
    expect(formatPipelineDuration(27_000)).toBe('27s');
    expect(formatPipelineDuration(65_000)).toBe('1m 05s');
    expect(formatPipelineDuration(120_000)).toBe('2m 00s');
  });

  // A unidade vem do backend: `Date.now() - startedAt`, em milissegundos.
  // Um run real de ~26,5s aparecia como "441m 40s" quando o valor era lido
  // como segundos.
  it('should read the value as milliseconds, matching what the API stores', () => {
    expect(formatPipelineDuration(26_500)).toBe('27s');
    expect(formatPipelineDuration(34_953)).toBe('35s');
  });

  it('should render a dash for missing durations', () => {
    expect(formatPipelineDuration(null)).toBe('—');
    expect(formatPipelineDuration(undefined)).toBe('—');
  });
});

describe('formatCount', () => {
  it('should use pt-BR thousand separators', () => {
    expect(formatCount(3484)).toBe('3.484');
    expect(formatCount(0)).toBe('0');
  });
});

describe('formatProviderName', () => {
  it('should capitalize the provider name', () => {
    expect(formatProviderName('gemini')).toBe('Gemini');
    expect(formatProviderName('groq')).toBe('Groq');
  });

  it('should render a dash for missing providers', () => {
    expect(formatProviderName(null)).toBe('—');
    expect(formatProviderName(undefined)).toBe('—');
  });
});

describe('readingTimeFromText', () => {
  it('should round up to the next full minute', () => {
    // 201 palavras a 200 ppm = 1,005 min
    expect(readingTimeFromText(Array(201).fill('palavra').join(' '))).toBe(2);
    expect(readingTimeFromText(Array(200).fill('palavra').join(' '))).toBe(1);
  });

  it('should never return less than a minute for real text', () => {
    expect(readingTimeFromText('duas palavras')).toBe(1);
  });

  it('should return 0 when there is no text to read', () => {
    expect(readingTimeFromText(null)).toBe(0);
    expect(readingTimeFromText(undefined)).toBe(0);
    expect(readingTimeFromText('   \n  ')).toBe(0);
  });

  it('should accept another reading rate', () => {
    expect(readingTimeFromText(Array(600).fill('palavra').join(' '), 300)).toBe(2);
  });
});

describe('formatDateTime', () => {
  it('should carry the time, which is the point of "generated at"', () => {
    // Só a data repetiria a data do briefing e não diria nada — a §8 pede o
    // horário da geração.
    const formatted = formatDateTime('2026-08-21T11:00:10.888Z', 'pt-BR');
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('should keep the date alongside the time', () => {
    expect(formatDateTime('2026-08-21T11:00:10.888Z', 'pt-BR')).toContain('2026');
  });
});
