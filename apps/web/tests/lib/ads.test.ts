import { describe, it, expect } from 'vitest';
import {
  AD_FORMAT_HEIGHT,
  AD_MOBILE_FORMAT,
  hasAdInventory,
} from '@/lib/ads';

describe('inventário de anúncios', () => {
  // §8: "sem inventário, não renderiza nada". O default tem de ser desligado —
  // um slot que aparece por acidente é um bloco de conteúdo empurrado.
  it('should report no inventory while the flag is unset', () => {
    expect(hasAdInventory('home-after-hero')).toBe(false);
    expect(hasAdInventory('article-in-content')).toBe(false);
  });

  it('should map the leaderboard to the mobile banner and nothing else', () => {
    expect(AD_MOBILE_FORMAT.leaderboard).toBe('mobile-banner');
    expect(AD_MOBILE_FORMAT.rectangle).toBeUndefined();
    expect(AD_MOBILE_FORMAT['in-article']).toBeUndefined();
  });

  // As alturas são a tabela da §9. Se elas mudarem sem que o `AdSlot` mude
  // junto, o slot reserva o espaço errado e o CLS volta.
  it('should keep the reserved heights of §9', () => {
    expect(AD_FORMAT_HEIGHT).toEqual({
      leaderboard: 90,
      rectangle: 250,
      'in-article': 250,
      'mobile-banner': 100,
    });
  });
});
