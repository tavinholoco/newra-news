import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SEARCH_HISTORY_LIMIT,
  clearSearchHistory,
  pushSearchTerm,
  readSearchHistory,
  removeSearchTerm,
} from '@/lib/search-history';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('search history', () => {
  it('should start empty', () => {
    expect(readSearchHistory()).toEqual([]);
  });

  it('should put the newest term first', () => {
    pushSearchTerm('copa');
    pushSearchTerm('eleições');

    expect(readSearchHistory()).toEqual(['eleições', 'copa']);
  });

  it('should move a repeated term back to the top instead of duplicating it', () => {
    pushSearchTerm('copa');
    pushSearchTerm('eleições');
    pushSearchTerm('copa');

    expect(readSearchHistory()).toEqual(['copa', 'eleições']);
  });

  it('should treat accents and case as the same term', () => {
    // "Economia" e "economia" ocupando dois dos seis lugares é desperdício.
    pushSearchTerm('Eleições');
    pushSearchTerm('eleicoes');

    expect(readSearchHistory()).toEqual(['eleicoes']);
  });

  it('should keep the spelling the person just typed', () => {
    pushSearchTerm('eleicoes');
    pushSearchTerm('Eleições');

    expect(readSearchHistory()[0]).toBe('Eleições');
  });

  it('should cap the list', () => {
    for (let i = 0; i < SEARCH_HISTORY_LIMIT + 4; i += 1) {
      pushSearchTerm(`termo ${i}`);
    }

    expect(readSearchHistory()).toHaveLength(SEARCH_HISTORY_LIMIT);
  });

  it('should ignore a blank term', () => {
    pushSearchTerm('copa');
    pushSearchTerm('   ');

    expect(readSearchHistory()).toEqual(['copa']);
  });

  it('should remove one term without touching the rest', () => {
    pushSearchTerm('copa');
    pushSearchTerm('eleições');

    expect(removeSearchTerm('copa')).toEqual(['eleições']);
  });

  it('should clear everything', () => {
    pushSearchTerm('copa');
    expect(clearSearchHistory()).toEqual([]);
    expect(readSearchHistory()).toEqual([]);
  });

  it('should come back empty from corrupted storage instead of throwing', () => {
    // O conteúdo é editável à mão, e um histórico quebrado não pode derrubar a
    // busca, que é a função principal da tela.
    window.localStorage.setItem('newra:news-search-history', '{ not json');
    expect(readSearchHistory()).toEqual([]);

    window.localStorage.setItem('newra:news-search-history', '"uma string"');
    expect(readSearchHistory()).toEqual([]);
  });

  it('should drop non-string entries', () => {
    window.localStorage.setItem(
      'newra:news-search-history',
      JSON.stringify(['copa', 42, null, 'copa 2']),
    );

    expect(readSearchHistory()).toEqual(['copa', 'copa 2']);
  });

  it('should survive storage that refuses to write', () => {
    // Modo privativo de alguns navegadores lança em `setItem`.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => pushSearchTerm('copa')).not.toThrow();
  });
});
