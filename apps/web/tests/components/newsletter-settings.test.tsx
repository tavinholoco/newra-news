import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsletterSettings } from '@/components/account/newsletter-settings';
import { renderWithIntl } from '@/tests/utils';

const useAccountMock = vi.fn();
const mutateMock = vi.fn();
const useUpdateNewsletterMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  useAccount: () => useAccountMock(),
  useUpdateNewsletterSubscription: () => useUpdateNewsletterMock(),
}));

const user = {
  id: 'user-1',
  email: 'leitor@test.com',
  name: 'Leitor',
  image: null,
  role: 'USER',
  createdAt: '2024-01-01T00:00:00.000Z',
};

function mockAccount(newsletter: { subscribed: boolean; email: string | null }) {
  useAccountMock.mockReturnValue({
    data: {
      user,
      newsletter,
      preferences: { categories: [], theme: 'SYSTEM' },
      saved: { news: 0, articles: 0 },
    },
    isLoading: false,
    isError: false,
  });
}

beforeEach(() => {
  useAccountMock.mockReset();
  mutateMock.mockReset();
  useUpdateNewsletterMock.mockReset();
  useUpdateNewsletterMock.mockReturnValue({ mutate: mutateMock, isPending: false, isError: false });
});

describe('NewsletterSettings', () => {
  it('should say which address receives the briefing', () => {
    mockAccount({ subscribed: true, email: 'leitor@test.com' });
    renderWithIntl(<NewsletterSettings />);

    expect(screen.getByText('Você recebe o Newra Daily')).toBeInTheDocument();
    expect(screen.getByText(/leitor@test\.com/)).toBeInTheDocument();
  });

  it('should cancel the subscription from the account screen', async () => {
    mockAccount({ subscribed: true, email: 'leitor@test.com' });
    const person = userEvent.setup();
    renderWithIntl(<NewsletterSettings />);

    await person.click(screen.getByRole('button', { name: 'Cancelar inscrição' }));

    expect(mutateMock).toHaveBeenCalledWith(false);
  });

  it('should offer to subscribe with the account e-mail', async () => {
    mockAccount({ subscribed: false, email: null });
    const person = userEvent.setup();
    renderWithIntl(<NewsletterSettings />);

    expect(screen.getByText('Você não recebe o Newra Daily')).toBeInTheDocument();
    await person.click(screen.getByRole('button', { name: 'Quero receber' }));

    expect(mutateMock).toHaveBeenCalledWith(true);
  });

  it('should warn when the subscription uses another e-mail', () => {
    // A inscrição não exige conta: este descasamento é normal, e um estado
    // "inscrito" sem dizer por qual endereço faz alguém se inscrever de novo.
    mockAccount({ subscribed: true, email: 'outro@test.com' });
    renderWithIntl(<NewsletterSettings />);

    expect(
      screen.getByText(/e-mail diferente do da sua conta/i),
    ).toBeInTheDocument();
  });

  it('should not warn when the addresses match apart from case', () => {
    mockAccount({ subscribed: true, email: 'Leitor@Test.com' });
    renderWithIntl(<NewsletterSettings />);

    expect(screen.queryByText(/e-mail diferente do da sua conta/i)).toBeNull();
  });

  it('should report a failed update', () => {
    mockAccount({ subscribed: false, email: null });
    useUpdateNewsletterMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      isError: true,
    });
    renderWithIntl(<NewsletterSettings />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível atualizar sua inscrição.',
    );
  });
});
