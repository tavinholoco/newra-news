import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { SubscribeForm } from '@/components/newsletter/subscribe-form';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { renderWithIntl } from '@/tests/utils';

describe('i18n rendering', () => {
  it('renders SubscribeForm in pt-BR by default', () => {
    renderWithIntl(<SubscribeForm origin='footer' />);

    expect(
      screen.getByRole('button', { name: /assinar/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Seu e-mail')).toBeInTheDocument();
  });

  it('renders SubscribeForm in English with the en locale', () => {
    renderWithIntl(<SubscribeForm origin='footer' />, 'en');

    expect(
      screen.getByRole('button', { name: /subscribe/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Your email')).toBeInTheDocument();
  });

  it('renders ThemeToggle labels in English with the en locale', () => {
    renderWithIntl(<ThemeToggle />, 'en');

    expect(
      screen.getByRole('button', { name: 'Enable dark mode' }),
    ).toBeInTheDocument();
  });

  it('renders ThemeToggle labels in pt-BR by default', () => {
    renderWithIntl(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: 'Ativar modo escuro' }),
    ).toBeInTheDocument();
  });
});
