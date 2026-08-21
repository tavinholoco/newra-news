import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareButton } from '@/components/editorial/share-button';
import { renderWithIntl } from '@/tests/utils';

const URL_ATUAL = 'http://localhost:3000/pt-BR/news/abc';

function setShare(impl: ((data: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'share', {
    value: impl,
    configurable: true,
    writable: true,
  });
}

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  window.history.replaceState({}, '', '/pt-BR/news/abc');
});

afterEach(() => {
  setShare(undefined);
  vi.restoreAllMocks();
});

describe('ShareButton', () => {
  it('should use the native share sheet when the browser has one', () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    renderWithIntl(<ShareButton title='Manchete' text='Resumo' />);

    fireEvent.click(screen.getByRole('button'));

    expect(share).toHaveBeenCalledWith({
      title: 'Manchete',
      text: 'Resumo',
      url: URL_ATUAL,
    });
  });

  it('should copy the link when there is no native share', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    renderWithIntl(<ShareButton title='Manchete' />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL_ATUAL));
    expect(await screen.findByText('Link copiado')).toBeInTheDocument();
  });

  it('should not fall back to copying when the user cancels the share sheet', async () => {
    // Cancelar rejeita a promessa. Copiar depois de um cancelamento deliberado
    // é pior que não fazer nada.
    setShare(vi.fn().mockRejectedValue(new Error('AbortError')));
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    renderWithIntl(<ShareButton title='Manchete' />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(writeText).not.toHaveBeenCalled());
  });

  it('should not claim success when the clipboard is unavailable', async () => {
    // `clipboard` exige contexto seguro e permissão.
    setClipboard(vi.fn().mockRejectedValue(new Error('NotAllowedError')));
    renderWithIntl(<ShareButton title='Manchete' />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.queryByText('Link copiado')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Compartilhar')).toBeInTheDocument();
  });

  it('should keep the same label whichever path the browser takes', () => {
    // `navigator.share` só existe depois da hidratação; trocar o rótulo a
    // partir dele produziria markup diferente no servidor e no cliente.
    setShare(vi.fn().mockResolvedValue(undefined));
    const { unmount } = renderWithIntl(<ShareButton title='Manchete' />);
    expect(screen.getByText('Compartilhar')).toBeInTheDocument();
    unmount();

    setShare(undefined);
    renderWithIntl(<ShareButton title='Manchete' />);
    expect(screen.getByText('Compartilhar')).toBeInTheDocument();
  });
});
