import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/tests/utils';

/**
 * `hasAdInventory` lê `process.env` uma vez por chamada, mas o `AdSlot`
 * importa o módulo — mockar o módulo é o que permite testar os dois estados
 * sem depender de ordem de import nem de `vi.resetModules`.
 */
const { hasAdInventory } = vi.hoisted(() => ({
  hasAdInventory: vi.fn(() => false),
}));

vi.mock('@/lib/ads', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ads')>('@/lib/ads');
  return { ...actual, hasAdInventory };
});

const { AdSlot } = await import('@/components/monetization/ad-slot');

afterEach(() => {
  hasAdInventory.mockReturnValue(false);
});

describe('AdSlot', () => {
  // §8 dos slots: sem inventário, nem caixa vazia nem a palavra "Publicidade".
  it('should render nothing at all when there is no inventory', () => {
    const { container } = renderWithIntl(
      <AdSlot placement='home-after-hero' format='leaderboard' />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should reserve height and label itself once inventory exists', () => {
    hasAdInventory.mockReturnValue(true);

    renderWithIntl(<AdSlot placement='home-after-hero' format='leaderboard' />);

    const slot = screen.getByRole('complementary', { name: 'Publicidade' });
    // 100px, não 90: abaixo de `md` o leaderboard vira mobile-banner, e
    // reservar 90 para crescer depois seria exatamente o salto de layout que
    // este componente existe para impedir.
    expect(slot).toHaveStyle({ minHeight: '100px' });
    expect(slot).toHaveAttribute('data-ad-placement', 'home-after-hero');
  });

  it('should reserve the rectangle height for placements that do not swap', () => {
    hasAdInventory.mockReturnValue(true);

    renderWithIntl(
      <AdSlot placement='article-after-content' format='rectangle' />,
    );

    expect(
      screen.getByRole('complementary', { name: 'Publicidade' }),
    ).toHaveStyle({ minHeight: '250px' });
  });
});
