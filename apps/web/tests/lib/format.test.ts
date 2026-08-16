import { describe, it, expect } from 'vitest';
import {
  CATEGORY_LABELS,
  formatDate,
  formatArticleDate,
  toDateSlug,
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
