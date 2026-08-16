import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '@/components/theme/theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    window.localStorage.clear();
  });

  it('should render with the "enable dark mode" label when light', () => {
    render(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: 'Ativar modo escuro' }),
    ).toBeInTheDocument();
  });

  it('should apply the dark class and persist the choice when clicked', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Ativar modo escuro' }));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(
      screen.getByRole('button', { name: 'Ativar modo claro' }),
    ).toBeInTheDocument();
  });

  it('should revert to light theme when clicked again', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: 'Ativar modo escuro' });
    await user.click(button);
    await user.click(
      screen.getByRole('button', { name: 'Ativar modo claro' }),
    );

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it('should reflect an existing dark class after mount (avoids hydration mismatch)', () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);

    expect(
      screen.getByRole('button', { name: 'Ativar modo claro' }),
    ).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
