import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesForm } from '@/components/account/preferences-form';
import { renderWithIntl } from '@/tests/utils';

const useAccountMock = vi.fn();
const mutateMock = vi.fn();
const useUpdatePreferencesMock = vi.fn();
const applyThemePreferenceMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  useAccount: () => useAccountMock(),
  useUpdatePreferences: () => useUpdatePreferencesMock(),
}));

vi.mock('@/lib/theme', () => ({
  applyThemePreference: (preference: unknown) => applyThemePreferenceMock(preference),
}));

const account = {
  user: { id: 'user-1', email: 'leitor@test.com', name: 'Leitor', image: null, role: 'USER', createdAt: '2024-01-01T00:00:00.000Z' },
  preferences: { categories: ['WORLD'], theme: 'SYSTEM' },
  newsletter: { subscribed: false, email: null },
  saved: { news: 0, articles: 0 },
};

function mockAccount(overrides: Record<string, unknown> = {}) {
  useAccountMock.mockReturnValue({
    data: { ...account, ...overrides },
    isLoading: false,
    isError: false,
  });
}

beforeEach(() => {
  useAccountMock.mockReset();
  mutateMock.mockReset();
  applyThemePreferenceMock.mockReset();
  useUpdatePreferencesMock.mockReset();
  useUpdatePreferencesMock.mockReturnValue({
    mutate: mutateMock,
    isPending: false,
    isSuccess: false,
    isError: false,
  });
});

describe('PreferencesForm', () => {
  it('should show the stored choice as pressed', () => {
    mockAccount();
    renderWithIntl(<PreferencesForm />);

    expect(screen.getByRole('button', { name: 'Mundo' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tecnologia' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Do sistema' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('should send the whole draft when saving, keeping what was already chosen', async () => {
    mockAccount();
    const user = userEvent.setup();
    renderWithIntl(<PreferencesForm />);

    await user.click(screen.getByRole('button', { name: 'Tecnologia' }));
    await user.click(screen.getByRole('button', { name: 'Escuro' }));
    await user.click(screen.getByRole('button', { name: 'Salvar preferências' }));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [draft] = mutateMock.mock.calls[0] as [
      { categories: string[]; theme: string },
    ];
    expect(draft.categories).toEqual(['WORLD', 'TECHNOLOGY']);
    expect(draft.theme).toBe('DARK');
  });

  it('should remove a category that was already chosen', async () => {
    mockAccount();
    const user = userEvent.setup();
    renderWithIntl(<PreferencesForm />);

    await user.click(screen.getByRole('button', { name: 'Mundo' }));
    await user.click(screen.getByRole('button', { name: 'Salvar preferências' }));

    const [draft] = mutateMock.mock.calls[0] as [{ categories: string[] }];
    expect(draft.categories).toEqual([]);
  });

  it('should apply the theme only when the server confirms it', async () => {
    mockAccount();
    const user = userEvent.setup();
    renderWithIntl(<PreferencesForm />);

    await user.click(screen.getByRole('button', { name: 'Escuro' }));
    // O clique no controle não pinta a tela: só o `onSuccess` da mutação.
    expect(applyThemePreferenceMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Salvar preferências' }));
    const [, options] = mutateMock.mock.calls[0] as [
      unknown,
      { onSuccess: (data: unknown) => void },
    ];
    options.onSuccess({ categories: [], theme: 'DARK' });

    expect(applyThemePreferenceMock).toHaveBeenCalledWith('DARK');
  });

  it('should report a failed save', () => {
    mockAccount();
    useUpdatePreferencesMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isSuccess: false,
      isError: true,
    });
    renderWithIntl(<PreferencesForm />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar');
  });

  it('should report a failed load instead of an empty form', () => {
    useAccountMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithIntl(<PreferencesForm />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar suas preferências.',
    );
    expect(screen.queryByRole('button', { name: 'Mundo' })).toBeNull();
  });
});
