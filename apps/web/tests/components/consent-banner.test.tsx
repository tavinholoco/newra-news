import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/tests/utils';
import { CONSENT_STORAGE_KEY } from '@/lib/analytics/consent';

const { hasThirdPartyAds } = vi.hoisted(() => ({
  hasThirdPartyAds: vi.fn(() => false),
}));

vi.mock('@/lib/ads', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ads')>('@/lib/ads');
  return { ...actual, hasThirdPartyAds };
});

const { ConsentBanner } = await import('@/components/consent/consent-banner');

beforeEach(() => {
  vi.clearAllMocks();
  hasThirdPartyAds.mockReturnValue(false);
  window.localStorage.clear();
});

describe('ConsentBanner', () => {
  it('does not appear while there is no third party to consent to', () => {
    // Quem exige consentimento não é "ter anúncio" — é carregar script de
    // terceiro que grava cookie. Perguntar sem terceiro seria interromper a
    // leitura de toda página sem portar decisão nenhuma.
    const { container } = renderWithIntl(<ConsentBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('appears once a network is configured and nobody decided yet', () => {
    hasThirdPartyAds.mockReturnValue(true);

    renderWithIntl(<ConsentBanner />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('stays away once the person has decided', () => {
    hasThirdPartyAds.mockReturnValue(true);
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'denied');

    const { container } = renderWithIntl(<ConsentBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('records the decision and closes', async () => {
    hasThirdPartyAds.mockReturnValue(true);

    renderWithIntl(<ConsentBanner />);
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar' }));

    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('granted');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('records a refusal just as readily', async () => {
    hasThirdPartyAds.mockReturnValue(true);

    renderWithIntl(<ConsentBanner />);
    await userEvent.click(screen.getByRole('button', { name: 'Recusar' }));

    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('denied');
  });

  it('offers refusal before acceptance in the tab order', async () => {
    // Botão de recusa escondido, apagado ou depois do aceite é consentimento
    // obtido por desenho — que não é consentimento.
    hasThirdPartyAds.mockReturnValue(true);

    renderWithIntl(<ConsentBanner />);
    const botoes = screen.getAllByRole('button');

    expect(botoes[0]).toHaveAccessibleName('Recusar');
    expect(botoes[1]).toHaveAccessibleName('Aceitar');
  });

  it('does not steal focus from whoever is reading', () => {
    // `aria-modal='false'` e `dialog` em vez de `alertdialog`: ele não
    // interrompe uma tarefa em curso, e `alertdialog` moveria o foco à força.
    hasThirdPartyAds.mockReturnValue(true);

    renderWithIntl(<ConsentBanner />);

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
    expect(document.activeElement).toBe(document.body);
  });
});
