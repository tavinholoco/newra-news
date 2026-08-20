import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MastheadSearch } from '@/components/layout/masthead-search';
import { renderWithIntl } from '@/tests/utils';

const pushMock = vi.fn();

vi.mock('@/i18n/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n/navigation')>();
  return { ...actual, useRouter: () => ({ push: pushMock, replace: vi.fn() }) };
});

describe('MastheadSearch', () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it('should expose a labelled search region', () => {
    renderWithIntl(<MastheadSearch />);

    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument();
  });

  it('should send the term to the news route on submit', async () => {
    renderWithIntl(<MastheadSearch />);

    await userEvent.type(screen.getByRole('searchbox'), 'eleições{Enter}');

    expect(pushMock).toHaveBeenCalledWith(
      `/news?search=${encodeURIComponent('eleições')}`,
    );
  });

  it('should encode terms that would otherwise break the query string', async () => {
    renderWithIntl(<MastheadSearch />);

    await userEvent.type(screen.getByRole('searchbox'), 'a&b=c{Enter}');

    expect(pushMock).toHaveBeenCalledWith('/news?search=a%26b%3Dc');
  });

  it('should fall back to the bare news route when the term is only spaces', async () => {
    renderWithIntl(<MastheadSearch />);

    await userEvent.type(screen.getByRole('searchbox'), '   {Enter}');

    expect(pushMock).toHaveBeenCalledWith('/news');
  });

  it('should trim the term before navigating', async () => {
    renderWithIntl(<MastheadSearch />);

    await userEvent.type(screen.getByRole('searchbox'), '  bolsa  {Enter}');

    expect(pushMock).toHaveBeenCalledWith('/news?search=bolsa');
  });
});
