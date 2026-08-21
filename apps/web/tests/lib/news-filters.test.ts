import { describe, it, expect } from 'vitest';
import { Category } from '@newranews/types';
import {
  DEFAULT_NEWS_FILTERS,
  countActiveFilters,
  periodStart,
  readNewsFilters,
  toApiFilters,
  writeNewsFilters,
} from '@/lib/news-filters';

const NOW = new Date('2026-08-21T15:30:00.000Z');

describe('readNewsFilters', () => {
  it('should default to the whole archive when the URL is bare', () => {
    expect(readNewsFilters(new URLSearchParams())).toEqual(DEFAULT_NEWS_FILTERS);
  });

  it('should read every dimension from the URL', () => {
    const state = readNewsFilters(
      new URLSearchParams(
        'category=SPORTS&search=copa&source=G1&period=7d&sort=oldest&page=3',
      ),
    );

    expect(state).toEqual({
      category: Category.SPORTS,
      search: 'copa',
      source: 'G1',
      period: '7d',
      sort: 'oldest',
      page: 3,
    });
  });

  it('should fall back silently on a category that does not exist', () => {
    // A query string é editável por qualquer um: `?category=BANANA` mostra o
    // acervo inteiro, não uma tela quebrada.
    expect(readNewsFilters(new URLSearchParams('category=BANANA')).category).toBeNull();
  });

  it('should fall back silently on an unknown period and sort', () => {
    const state = readNewsFilters(new URLSearchParams('period=decade&sort=random'));
    expect(state.period).toBe('all');
    expect(state.sort).toBe('recent');
  });

  it('should refuse a page that is not a positive integer', () => {
    expect(readNewsFilters(new URLSearchParams('page=0')).page).toBe(1);
    expect(readNewsFilters(new URLSearchParams('page=-4')).page).toBe(1);
    expect(readNewsFilters(new URLSearchParams('page=abc')).page).toBe(1);
  });
});

describe('writeNewsFilters', () => {
  it('should write nothing when nothing differs from the default', () => {
    // `/news` limpa tem de ser `/news`: é a URL que a editorial-nav aponta e a
    // que entra no sitemap.
    expect(writeNewsFilters(DEFAULT_NEWS_FILTERS).toString()).toBe('');
  });

  it('should omit page 1 and the default sort', () => {
    const query = writeNewsFilters({
      ...DEFAULT_NEWS_FILTERS,
      category: Category.WORLD,
      page: 1,
      sort: 'recent',
    }).toString();

    expect(query).toBe('category=WORLD');
  });

  it('should round-trip a fully loaded state', () => {
    const state = {
      category: Category.HEALTH,
      search: 'vacina',
      source: 'Agência Brasil',
      period: '30d' as const,
      sort: 'oldest' as const,
      page: 4,
    };

    expect(readNewsFilters(writeNewsFilters(state))).toEqual(state);
  });
});

describe('periodStart', () => {
  it('should return nothing for the whole archive', () => {
    expect(periodStart('all', NOW)).toBeUndefined();
  });

  it('should anchor at midnight UTC, not at the current instant', () => {
    // Ancorar em `Date.now()` cru faria a chave de cache mudar a cada render.
    expect(periodStart('today', NOW)).toBe('2026-08-21T00:00:00.000Z');
  });

  it('should count 7d as today plus the six days before it', () => {
    expect(periodStart('7d', NOW)).toBe('2026-08-15T00:00:00.000Z');
  });

  it('should count 30d as today plus the twenty-nine days before it', () => {
    expect(periodStart('30d', NOW)).toBe('2026-07-23T00:00:00.000Z');
  });

  it('should give the same answer twice in the same day', () => {
    const morning = periodStart('7d', new Date('2026-08-21T00:00:01.000Z'));
    const night = periodStart('7d', new Date('2026-08-21T23:59:59.000Z'));
    expect(morning).toBe(night);
  });
});

describe('toApiFilters', () => {
  it('should send only what is set', () => {
    expect(toApiFilters(DEFAULT_NEWS_FILTERS, NOW)).toEqual({ sort: 'recent' });
  });

  it('should resolve the period into a from date', () => {
    const filters = toApiFilters(
      { ...DEFAULT_NEWS_FILTERS, period: 'today' },
      NOW,
    );
    expect(filters.from).toBe('2026-08-21T00:00:00.000Z');
  });

  it('should not carry the page — pagination is not a filter', () => {
    const filters = toApiFilters({ ...DEFAULT_NEWS_FILTERS, page: 5 }, NOW);
    expect(filters).not.toHaveProperty('page');
  });
});

describe('countActiveFilters', () => {
  it('should count nothing on a clean archive view', () => {
    expect(countActiveFilters(DEFAULT_NEWS_FILTERS)).toBe(0);
  });

  it('should ignore the page and the sort', () => {
    // Virar a página não é filtrar, e ordenação não esconde matéria nenhuma.
    const state = { ...DEFAULT_NEWS_FILTERS, page: 7, sort: 'oldest' as const };
    expect(countActiveFilters(state)).toBe(0);
  });

  it('should count category, search, source and period', () => {
    const state = {
      ...DEFAULT_NEWS_FILTERS,
      category: Category.SPORTS,
      search: 'copa',
      source: 'G1',
      period: '7d' as const,
    };
    expect(countActiveFilters(state)).toBe(4);
  });
});
