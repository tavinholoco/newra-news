import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '@/components/errors/error-state';

/**
 * A casca única dos error boundaries (Fase 7b do plano de observabilidade).
 * Os quatro `error.tsx` eram o mesmo componente de 26 linhas com chaves
 * diferentes; o `global-error.tsx` a reusa com strings fixas — por isso ela
 * recebe **tudo por prop** e não importa nada do next-intl (armadilha 9:
 * `useTranslations` sem provider lança dentro do boundary).
 */

const fetchMock = vi.fn();

const LABELS = {
  title: 'Não foi possível carregar as notícias',
  description: 'Ocorreu um erro ao buscar as notícias.',
  retryLabel: 'Tentar novamente',
  digestLabel: 'Referência do erro',
};

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ErrorState', () => {
  it('renders the title as the h1 of the screen, the description and the retry button', async () => {
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<ErrorState {...LABELS} error={new Error('boom')} reset={reset} />);

    // O boundary substitui a página inteira: o título dele é o `h1` da tela,
    // e o único — `heading-order` já reprovou duas vezes neste projeto.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(LABELS.title);
    expect(screen.getByText(LABELS.description)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: LABELS.retryLabel }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('shows the digest in small selectable text when there is one', () => {
    const error = Object.assign(new Error('boom'), { digest: '1234567890' });

    render(<ErrorState {...LABELS} error={error} reset={() => {}} />);

    // É o mesmo papel do `requestId` no corpo do 500 da API: o que alguém
    // copia para o relato, e o que localiza o stack no log do servidor.
    const digest = screen.getByText('1234567890');
    expect(digest.tagName).toBe('CODE');
    expect(digest).toHaveClass('select-all');
    expect(screen.getByText(/Referência do erro/)).toBeInTheDocument();
  });

  it('hides the digest line when the error has none — a client render error arrives without it', () => {
    render(<ErrorState {...LABELS} error={new Error('boom')} reset={() => {}} />);

    expect(screen.queryByText(/Referência do erro/)).not.toBeInTheDocument();
    expect(document.querySelector('code')).toBeNull();
  });

  it('reports the error once, through the anonymous door of the 7c', () => {
    const error = Object.assign(new Error('boom'), { digest: '42' });

    render(<ErrorState {...LABELS} error={error} reset={() => {}} />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/errors/client');
    expect(JSON.parse(init.body as string)).toMatchObject({ message: 'boom', digest: '42' });
  });

  it('does not use the V1 container — the shell gives the editorial one', () => {
    const { container } = render(
      <ErrorState {...LABELS} error={new Error('boom')} reset={() => {}} />,
    );

    // Armadilha 11 do plano: o `mx-auto max-w-7xl` da V1 vivia nos quatro
    // `error.tsx`; a V2 tem `container-editorial`, e é ele que a casca usa.
    expect(container.firstElementChild).toHaveClass('container-editorial');
    expect(container.innerHTML).not.toContain('max-w-7xl');
  });

  it('drops the container when inset in a shell that already has one', () => {
    // O `admin/metrics/error.tsx` renderiza dentro do `admin/layout.tsx`, que
    // já dá `container-editorial` — o único boundary em que o contêiner
    // próprio dobraria o gutter.
    const { container } = render(
      <ErrorState {...LABELS} layout='inset' error={new Error('boom')} reset={() => {}} />,
    );

    expect(container.firstElementChild).not.toHaveClass('container-editorial');
  });
});
