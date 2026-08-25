import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileNav } from '@/components/layout/mobile-nav';
import { AuthButton } from '@/components/auth/auth-button';
import { sessionNavLinks } from '@/lib/nav';
import { renderWithIntl } from '@/tests/utils';

const useSessionMock = vi.fn();
const usePathnameMock = vi.fn();

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
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  };
});

const ADMIN = {
  data: { user: { id: 'u1', email: 'a@b.c', name: 'Ada', role: 'ADMIN' } },
  status: 'authenticated' as const,
};

/**
 * **A casca do desktop e a do mobile oferecem os mesmos links de sessão.**
 *
 * Esta é a guarda do defeito que a Fase 12 achou, e ela existe porque o defeito
 * não tinha sintoma: `/admin` respondia 200, o menu do mobile a listava, a
 * suíte inteira passava, e mesmo assim ninguém em tela de 768 px para cima
 * tinha como chegar lá por link. Um teste que só olhasse uma das duas cascas
 * continuaria verde exatamente como a suíte continuou.
 *
 * A lista vem de `sessionNavLinks`, então ela não é escrita aqui: uma rota de
 * sessão nova entra na guarda sozinha, e reprova se aparecer em só um lado.
 *
 * `/favorites` é a exceção declarada e única: no desktop ele não mora na
 * top-bar, e sim como aba dentro de `/account` (`AccountNav`), que é onde a
 * §10 pôs o ecossistema de conta. O que a guarda cobre é o **alcance**, e ele
 * existe pelos dois caminhos — o que faltava para `/admin` era qualquer um.
 */
const DESKTOP_LIVES_ELSEWHERE = new Set(['/favorites', '/account']);

describe('paridade dos links de sessão entre as duas cascas', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/');
    useSessionMock.mockReturnValue(ADMIN);
  });

  it('a top-bar do desktop oferece todo link de sessão que o menu não delega à conta', async () => {
    const expected = sessionNavLinks(ADMIN.status, ADMIN.data.user.role)
      .map((link) => link.href)
      .filter((href) => !DESKTOP_LIVES_ELSEWHERE.has(href));

    expect(expected.length).toBeGreaterThan(0);

    renderWithIntl(<AuthButton />);

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    for (const href of expected) {
      expect(hrefs).toContain(`/pt-BR${href}`);
    }
  });

  it('o menu do mobile oferece todos eles', async () => {
    renderWithIntl(<MobileNav />);
    await userEvent.click(screen.getByRole('button', { name: /abrir menu/i }));

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    for (const link of sessionNavLinks(ADMIN.status, ADMIN.data.user.role)) {
      expect(hrefs).toContain(`/pt-BR${link.href}`);
    }
  });

  it('nenhuma das duas oferece link de sessão a quem não tem sessão', async () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });

    const { unmount } = renderWithIntl(<AuthButton />);
    expect(
      screen.queryByRole('link', { name: /^admin$/i }),
    ).toBeNull();
    unmount();

    renderWithIntl(<MobileNav />);
    await userEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.queryByRole('link', { name: /^admin$/i })).toBeNull();
  });

  it('quem tem sessão sem role de admin não recebe o painel em nenhuma das duas', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u2', email: 'c@d.e', name: 'Bo', role: 'USER' } },
      status: 'authenticated',
    });

    const { unmount } = renderWithIntl(<AuthButton />);
    expect(screen.queryByRole('link', { name: /^admin$/i })).toBeNull();
    unmount();

    renderWithIntl(<MobileNav />);
    await userEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
    expect(screen.queryByRole('link', { name: /^admin$/i })).toBeNull();
  });
});
