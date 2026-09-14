import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuditTrail, ErrorSummary } from '@newranews/types';
import { renderWithIntl } from '@/tests/utils';
import { auditTrail, emptyErrorSummary, errorSummary } from '@/tests/fixtures/observability';

const { useErrorSummary, useAuditTrail } = vi.hoisted(() => ({
  useErrorSummary: vi.fn(),
  useAuditTrail: vi.fn(),
}));

/**
 * Mock parcial de `@/lib/queries` mente por omissão (lição da Fase 2): a aba
 * consome exatamente estes dois hooks, e um terceiro entra aqui junto.
 */
vi.mock('@/lib/queries', () => ({ useErrorSummary, useAuditTrail }));

const { SecurityClient } = await import('@/components/admin/security-client');

interface QueryState<T> {
  data: T | undefined;
  isFetching: boolean;
  isError: boolean;
}

function mockQueries({
  errors = { data: errorSummary, isFetching: false, isError: false },
  audit = { data: auditTrail, isFetching: false, isError: false },
}: { errors?: QueryState<ErrorSummary>; audit?: QueryState<AuditTrail> } = {}) {
  useErrorSummary.mockReturnValue(errors);
  useAuditTrail.mockReturnValue(audit);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueries();
});

describe('SecurityClient — as falhas registradas', () => {
  it('opens on the 24 h window and asks for 7 d on click — the window is in the query key', async () => {
    renderWithIntl(<SecurityClient />);

    expect(useErrorSummary).toHaveBeenLastCalledWith('24h');
    await userEvent.click(screen.getByRole('button', { name: 'Últimos 7 dias' }));
    expect(useErrorSummary).toHaveBeenLastCalledWith('7d');
  });

  it('sums the window in the KPI row: total, distinct, and the three severities', () => {
    renderWithIntl(<SecurityClient />);

    // "Ocorrências" é também a coluna ordenável da tabela; o cartão é o que
    // carrega o total da janela.
    expect(screen.getAllByText('Ocorrências').length).toBeGreaterThanOrEqual(2);
    // O total está no cartão e no meio da rosquinha — um número, dois lugares.
    expect(screen.getAllByText('1.042')).toHaveLength(2);
    expect(screen.getByText('Falhas distintas')).toBeInTheDocument();
    expect(screen.getByText('1.040')).toBeInTheDocument(); // WARN
    // O cartão e a opção do filtro de severidade.
    expect(screen.getAllByText('FATAL')).toHaveLength(2);
  });

  it('draws the category donut with the six fixed slices, in the order of the taxonomy', () => {
    renderWithIntl(<SecurityClient />);

    const donut = screen.getByRole('img', { name: 'Erros por categoria' });
    expect(donut).toBeInTheDocument();
    const legend = donut.parentElement?.querySelector('ul');
    const labels = [...(legend?.querySelectorAll('li') ?? [])].map(
      (li) => li.querySelector('span:nth-child(2)')?.textContent,
    );
    // Seis fatias, sempre, mesmo com quatro em zero — `keepOrder` mantém a cor.
    expect(labels).toEqual([
      'upstream',
      'database',
      'validation',
      'authorization',
      'contract',
      'internal',
    ]);
  });

  it('lists every distinct failure with its request id as selectable text', () => {
    renderWithIntl(<SecurityClient />);

    const table = screen.getByRole('table', { name: '' });
    expect(within(table).getByText('AUTH_TOKEN_INVALID')).toBeInTheDocument();
    expect(within(table).getByText('/api/account')).toBeInTheDocument();
    const requestId = within(table).getByText('req-abc-123');
    expect(requestId.tagName).toBe('CODE');
    expect(requestId.className).toContain('select-all');
  });

  it('filters by severity, by category and by text', async () => {
    renderWithIntl(<SecurityClient />);
    const table = screen.getByRole('table');
    const rows = () => within(table).getAllByRole('row').slice(1); // sem o cabeçalho

    expect(rows()).toHaveLength(3);

    await userEvent.selectOptions(screen.getByLabelText('Severidade'), 'ERROR');
    expect(rows()).toHaveLength(1);
    expect(within(table).getByText('INTERNAL')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Severidade'), '');
    await userEvent.selectOptions(screen.getByLabelText('Categoria'), 'authorization');
    expect(rows()).toHaveLength(1);
    expect(within(table).getByText('AUTH_TOKEN_INVALID')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Categoria'), '');
    await userEvent.type(screen.getByLabelText('Buscar'), 'ETIMEDOUT');
    expect(rows()).toHaveLength(1);
    expect(within(table).getByText('feed-failed')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Buscar'));
    await userEvent.type(screen.getByLabelText('Buscar'), 'nada disso');
    expect(within(table).getByText('Nenhuma falha corresponde aos filtros.')).toBeInTheDocument();
  });

  it('sorts by occurrences by default and flips the column on click, announcing it', async () => {
    renderWithIntl(<SecurityClient />);
    const table = screen.getByRole('table');
    const codes = () =>
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.querySelector('p')?.textContent);

    expect(codes()).toEqual(['feed-failed', 'AUTH_TOKEN_INVALID', 'INTERNAL']);
    const countHeader = within(table).getByRole('columnheader', { name: /Ocorrências/ });
    expect(countHeader).toHaveAttribute('aria-sort', 'descending');

    await userEvent.click(within(countHeader).getByRole('button'));
    expect(codes()).toEqual(['INTERNAL', 'AUTH_TOKEN_INVALID', 'feed-failed']);
    expect(countHeader).toHaveAttribute('aria-sort', 'ascending');

    // Ordenar por "visto por último" leva a coluna nova para descendente.
    await userEvent.click(
      within(within(table).getByRole('columnheader', { name: /Visto por último/ })).getByRole('button'),
    );
    expect(codes()).toEqual(['AUTH_TOKEN_INVALID', 'feed-failed', 'INTERNAL']);
  });

  it('says the cut is incomplete when the read was truncated', () => {
    mockQueries({ errors: { data: { ...errorSummary, truncated: true }, isFetching: false, isError: false } });
    renderWithIntl(<SecurityClient />);

    expect(screen.getByText(/recorte está incompleto/)).toBeInTheDocument();
  });

  it('treats an empty window as a normal state, with its own text', () => {
    mockQueries({ errors: { data: emptyErrorSummary, isFetching: false, isError: false } });
    renderWithIntl(<SecurityClient />);

    // Rosquinha e tabela dizem a mesma coisa; nenhuma delas é erro.
    expect(screen.getAllByText('Nenhuma falha registrada na janela.')).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('draws the skeleton while loading and an alert on failure', () => {
    mockQueries({ errors: { data: undefined, isFetching: true, isError: false } });
    const { unmount, container } = renderWithIntl(<SecurityClient />);
    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThan(0);
    unmount();

    mockQueries({ errors: { data: undefined, isFetching: false, isError: true } });
    renderWithIntl(<SecurityClient />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as falhas registradas.');
  });

  it('keeps the invariants section as an honest empty place until Phase 6', () => {
    renderWithIntl(<SecurityClient />);

    expect(screen.getByRole('heading', { name: 'Invariantes' })).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma invariante medida ainda/)).toBeInTheDocument();
  });
});

describe('SecurityClient — a trilha de auditoria', () => {
  it('lists actions most recent first, with actor and target ids and the outcome', () => {
    renderWithIntl(<SecurityClient />);

    const list = screen.getByRole('heading', { name: 'Auditoria de ações de admin' })
      .parentElement!.querySelector('ul')!;
    const items = within(list).getAllByRole('listitem');

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Pipeline disparado');
    expect(items[0]).toHaveTextContent('started');
    expect(items[0]).toHaveTextContent('user-admin-1');
    expect(items[0]).toHaveTextContent('run-1');
    expect(items[1]).toHaveTextContent('Notícia apagada');
    // Uma ação que a tela ainda não conhece sai como veio, em vez de sumir.
    expect(items[2]).toHaveTextContent('news.renormalized');
    expect(screen.getByText('3 de 3 na janela')).toBeInTheDocument();
  });

  it('never shows an e-mail — only ids come through', () => {
    renderWithIntl(<SecurityClient />);
    expect(screen.queryByText(/@/)).toBeNull();
  });

  it('asks for the window that was clicked, in days', async () => {
    renderWithIntl(<SecurityClient />);

    expect(useAuditTrail).toHaveBeenLastCalledWith(30);
    await userEvent.click(screen.getByRole('button', { name: '365 dias' }));
    expect(useAuditTrail).toHaveBeenLastCalledWith(365);
  });

  it('draws its own empty state and its own alert', () => {
    mockQueries({ audit: { data: { ...auditTrail, total: 0, events: [] }, isFetching: false, isError: false } });
    const { unmount } = renderWithIntl(<SecurityClient />);
    expect(screen.getByText('Nenhuma ação de admin registrada na janela.')).toBeInTheDocument();
    unmount();

    mockQueries({ audit: { data: undefined, isFetching: false, isError: true } });
    renderWithIntl(<SecurityClient />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a trilha de auditoria.');
  });
});
