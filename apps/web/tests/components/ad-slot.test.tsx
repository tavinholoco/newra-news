import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/tests/utils';

/**
 * `hasAdInventory` e `hasThirdPartyAds` leem `process.env` a cada chamada, mas
 * o `AdSlot` importa o módulo — mockar o módulo é o que permite testar os
 * estados sem depender de ordem de import nem de `vi.resetModules`.
 */
const { hasAdInventory, hasThirdPartyAds, isThirdPartyAllowed, track } =
  vi.hoisted(() => ({
    hasAdInventory: vi.fn(() => false),
    hasThirdPartyAds: vi.fn(() => false),
    isThirdPartyAllowed: vi.fn(() => false),
    track: vi.fn(),
  }));

vi.mock('@/lib/ads', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ads')>('@/lib/ads');
  return { ...actual, hasAdInventory, hasThirdPartyAds };
});

vi.mock('@/lib/analytics', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics');
  return { ...actual, track };
});

vi.mock('@/lib/analytics/consent', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/analytics/consent')
  >('@/lib/analytics/consent');
  return { ...actual, isThirdPartyAllowed };
});

const { AdSlot } = await import('@/components/monetization/ad-slot');

beforeEach(() => {
  vi.clearAllMocks();
  hasAdInventory.mockReturnValue(false);
  hasThirdPartyAds.mockReturnValue(false);
  isThirdPartyAllowed.mockReturnValue(false);
});

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

  it('should reserve height once inventory exists', () => {
    hasAdInventory.mockReturnValue(true);

    renderWithIntl(<AdSlot placement='home-after-hero' format='leaderboard' />);

    const slot = screen.getByRole('complementary');
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

    expect(screen.getByRole('complementary')).toHaveStyle({
      minHeight: '250px',
    });
  });

  it('should not call house inventory "Publicidade"', () => {
    // Chamar a promoção da própria newsletter de "Publicidade" seria mentir
    // sobre a natureza do espaço — e é a mesma regra que impede o briefing de
    // carimbar a matéria coletada como escrita por IA.
    hasAdInventory.mockReturnValue(true);

    renderWithIntl(<AdSlot placement='home-after-hero' format='leaderboard' />);

    expect(
      screen.getByRole('complementary', { name: 'Do Newra News' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Publicidade')).not.toBeInTheDocument();
  });

  it('should label third-party inventory as advertising', () => {
    hasAdInventory.mockReturnValue(true);
    hasThirdPartyAds.mockReturnValue(true);
    isThirdPartyAllowed.mockReturnValue(true);

    renderWithIntl(<AdSlot placement='home-after-hero' format='leaderboard' />);

    expect(
      screen.getByRole('complementary', { name: 'Publicidade' }),
    ).toBeInTheDocument();
  });

  it('should render nothing when a network is configured but consent was not given', () => {
    // **Não cai no criativo de casa**: a posição foi vendida. Preenchê-la com
    // outra coisa entregaria ao anunciante um espaço que ele pagou e não teve.
    hasAdInventory.mockReturnValue(true);
    hasThirdPartyAds.mockReturnValue(true);
    isThirdPartyAllowed.mockReturnValue(false);

    const { container } = renderWithIntl(
      <AdSlot placement='home-after-hero' format='leaderboard' />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should track ad_click on the house creative', async () => {
    hasAdInventory.mockReturnValue(true);

    renderWithIntl(<AdSlot placement='home-after-hero' format='leaderboard' />);
    await userEvent.click(screen.getByRole('link'));

    expect(track).toHaveBeenCalledWith('ad_click', {
      placement: 'home-after-hero',
      format: 'leaderboard',
    });
  });

  it('should not track an impression on mount — visible is not seen', () => {
    // A definição da §5 é metade do elemento por um segundo. Sem a
    // permanência, uma rolagem rápida contaria impressão em todos os slots de
    // uma vez, e a viewability medida seria a de quem não viu nada.
    hasAdInventory.mockReturnValue(true);

    renderWithIntl(<AdSlot placement='home-after-hero' format='leaderboard' />);

    expect(track).not.toHaveBeenCalledWith(
      'ad_view',
      expect.anything() as never,
    );
  });
});
