import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubscribeForm } from '@/components/newsletter/subscribe-form';
import { renderWithIntl } from '@/tests/utils';

function mockFetchOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          id: 'uuid-1',
          email: 'assinante@test.com',
          status: 'ACTIVE',
          createdAt: '2024-01-01T08:00:00.000Z',
          updatedAt: '2024-01-01T08:00:00.000Z',
        },
      }),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SubscribeForm', () => {
  it('should render the email input and submit button', () => {
    renderWithIntl(<SubscribeForm origin='footer' />);

    expect(
      screen.getByRole('textbox', { name: 'Seu e-mail' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /assinar/i }),
    ).toBeInTheDocument();
  });

  it('should show a validation error for an invalid email without calling the API', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const user = userEvent.setup();
    renderWithIntl(<SubscribeForm origin='footer' />);

    await user.type(
      screen.getByRole('textbox', { name: 'Seu e-mail' }),
      'nao-e-email',
    );
    await user.click(screen.getByRole('button', { name: /assinar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Informe um e-mail válido.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should show a success message and clear the input after subscribing', async () => {
    mockFetchOk();
    const user = userEvent.setup();
    renderWithIntl(<SubscribeForm origin='footer' />);

    const input = screen.getByRole('textbox', { name: 'Seu e-mail' });
    await user.type(input, 'Assinante@Test.com ');
    await user.click(screen.getByRole('button', { name: /assinar/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'artigo do dia',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
  });

  it('should show an error message when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const user = userEvent.setup();
    renderWithIntl(<SubscribeForm origin='footer' />);

    await user.type(
      screen.getByRole('textbox', { name: 'Seu e-mail' }),
      'assinante@test.com',
    );
    await user.click(screen.getByRole('button', { name: /assinar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível assinar agora.',
    );
  });
});
