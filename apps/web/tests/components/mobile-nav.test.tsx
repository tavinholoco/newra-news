import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileNav } from '@/components/layout/mobile-nav';
import { renderWithIntl } from '@/tests/utils';

const useSessionMock = vi.fn();
const usePathnameMock = vi.fn();
const pushMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/i18n/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n/navigation')>();
  return {
    ...actual,
    usePathname: () => usePathnameMock(),
    useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  };
});

async function open() {
  await userEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
}

describe('MobileNav', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/');
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    pushMock.mockClear();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('should start closed', () => {
    renderWithIntl(<MobileNav />);

    expect(screen.getByRole('button', { name: /abrir menu/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('link', { name: 'Sobre' })).toBeNull();
  });

  it('should reveal the secondary links when opened', async () => {
    renderWithIntl(<MobileNav />);
    await open();

    expect(screen.getByRole('link', { name: 'Sobre' })).toHaveAttribute(
      'href',
      '/pt-BR/about',
    );
    expect(screen.getByRole('button', { name: /fechar menu/i })).toBeInTheDocument();
  });

  it('should lock body scroll while open and restore it on close', async () => {
    renderWithIntl(<MobileNav />);

    await open();
    expect(document.body.style.overflow).toBe('hidden');

    await userEvent.click(screen.getByRole('button', { name: /fechar menu/i }));
    expect(document.body.style.overflow).toBe('');
  });

  it('should close on Escape', async () => {
    renderWithIntl(<MobileNav />);
    await open();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('link', { name: 'Sobre' })).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('should not offer favorites or admin to anonymous visitors', async () => {
    renderWithIntl(<MobileNav />);
    await open();

    expect(screen.queryByRole('link', { name: 'Favoritos' })).toBeNull();
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull();
  });

  it('should offer favorites to a signed-in user but not admin', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', role: 'USER' } },
      status: 'authenticated',
    });
    renderWithIntl(<MobileNav />);
    await open();

    expect(screen.getByRole('link', { name: 'Favoritos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^admin$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Métricas' })).toBeNull();
  });

  it('should offer admin and metrics to an ADMIN', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', role: 'ADMIN' } },
      status: 'authenticated',
    });
    renderWithIntl(<MobileNav />);
    await open();

    expect(screen.getByRole('link', { name: /^admin$/i })).toHaveAttribute(
      'href',
      '/pt-BR/admin',
    );
    expect(screen.getByRole('link', { name: 'Métricas' })).toHaveAttribute(
      'href',
      '/pt-BR/admin/metrics',
    );
  });

  it('should mark only the deepest matching link as current', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', role: 'ADMIN' } },
      status: 'authenticated',
    });
    usePathnameMock.mockReturnValue('/admin/metrics');
    renderWithIntl(<MobileNav />);
    await open();

    expect(screen.getByRole('link', { name: 'Métricas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /^admin$/i })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('should keep the categories out of the menu', async () => {
    // §10: a faixa de assuntos não se esconde atrás de menu. Duplicá-la aqui
    // daria dois caminhos concorrentes para a mesma navegação.
    renderWithIntl(<MobileNav />);
    await open();

    expect(screen.queryByRole('link', { name: 'Tecnologia' })).toBeNull();
  });
});
