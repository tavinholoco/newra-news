import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { InvariantReport } from '@newranews/types';
import { InvariantsPanel } from '@/components/admin/invariants-panel';
import { renderWithIntl } from '@/tests/utils';
import { healthyInvariantReport, invariantReport } from '@/tests/fixtures/observability';

/**
 * O painel "Invariantes" da aba de segurança (§10 do plano de observabilidade,
 * Fase 6).
 *
 * O que se mede aqui é a tela, e sobretudo os **três estados que não são o
 * mesmo**: a API de produção sem a rota (404, armadilha 37) vira
 * "indisponível"; `data: null` vira "nenhuma verificação ainda"; e o relatório
 * vira a tabela com as doze linhas, na ordem da API, com os três estados por
 * linha e os dois formatos de medida. A suíte em si mora na API.
 */

function mockFetch(report: InvariantReport | null | { status: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      report !== null && 'status' in report
        ? Promise.resolve({
            ok: false,
            status: report.status,
            json: vi.fn().mockResolvedValue({ error: 'Not found' }),
          })
        : Promise.resolve({ ok: true, json: vi.fn().mockResolvedValue({ data: report }) }),
    ),
  );
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>
      <InvariantsPanel />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InvariantsPanel', () => {
  it('lists the twelve, in the order the API sent, each with its label and id', async () => {
    mockFetch(invariantReport);
    renderPanel();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(12);

    const ids = rows.map((row) => within(row).getByText(/^[a-z]+\.[a-z_A-Z]+$/).textContent);
    expect(ids).toEqual(invariantReport.results.map((result) => result.id));
    expect(within(rows[0]!).getByText('Acervo dentro da retenção (News, 30 dias)')).toBeInTheDocument();
    expect(
      within(rows[11]!).getByText('A newsletter chegou a alguém nos dias em que havia assinante'),
    ).toBeInTheDocument();
  });

  it('says when it ran, in which run, how many were violated, and how much of the budget it used', async () => {
    mockFetch(invariantReport);
    renderPanel();

    await screen.findByRole('table');
    expect(screen.getByText('1 violada de 12')).toBeInTheDocument();
    expect(screen.getByText('1 não pôde ser conferida')).toBeInTheDocument();
    expect(screen.getByText(/381 ms de 2 s/)).toBeInTheDocument();
    expect(screen.getByText('00000000-0000-4000-8000-00000000c001')).toBeInTheDocument();
    // O instante da verificação, com `dateTime` para a máquina.
    expect(document.querySelector('time')?.getAttribute('dateTime')).toBe('2026-09-16T11:01:02.000Z');
  });

  it('draws the three states per line — and the unanswered one is not a verdict', async () => {
    mockFetch(invariantReport);
    renderPanel();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);

    expect(within(rows[0]!).getByText('Violada')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('OK')).toBeInTheDocument();
    const unanswered = rows[10]!;
    expect(within(unanswered).getByText('Sem resposta')).toBeInTheDocument();
    expect(within(unanswered).getByText(/A consulta falhou:/)).toHaveTextContent(
      'relation "DailyMetric" does not exist',
    );
    // Onze respostas e uma pergunta sem resposta: nunca doze vereditos.
    expect(within(table).getAllByText(/^(OK|Violada)$/)).toHaveLength(11);
  });

  it('formats a count as a number and an "oldest" as a date-time, with the rule in the expected column', async () => {
    mockFetch(invariantReport);
    renderPanel();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);

    // `retention.news`: o instante mais antigo, e o admitido com o `≥`.
    const retention = within(rows[0]!).getAllByRole('cell').map((cell) => cell.textContent);
    expect(retention[2]).toMatch(/01 de jul\. de 2026/);
    expect(retention[3]).toMatch(/^≥ .*16 de ago\. de 2026/);
    // `briefing.one_per_day`: contagem contra contagem, com o `=`.
    const briefing = within(rows[7]!).getAllByRole('cell').map((cell) => cell.textContent);
    expect(briefing[2]).toBe('7');
    expect(briefing[3]).toBe('= 7');
    // Tabela vazia: o mínimo é `null`, e a célula diz que não há nada — não zero.
    const audit = within(rows[5]!).getAllByRole('cell').map((cell) => cell.textContent);
    expect(audit[2]).toBe('—');
  });

  it('reads as all clear when nothing is violated', async () => {
    mockFetch(healthyInvariantReport);
    renderPanel();

    await screen.findByRole('table');
    expect(screen.getByText('nenhuma violada de 12')).toBeInTheDocument();
    expect(screen.queryByText(/não pôde ser conferida|não puderam/)).not.toBeInTheDocument();
    expect(screen.queryByText('Violada')).not.toBeInTheDocument();
  });

  it('says "no check yet" on null — the state before the first run with the stage', async () => {
    mockFetch(null);
    renderPanel();

    expect(
      await screen.findByText('Nenhuma verificação ainda — a suíte roda na etapa 9.5 do próximo run do pipeline.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says "unavailable" when the live API does not serve the route — never a broken tab', async () => {
    mockFetch({ status: 404 });
    renderPanel();

    expect(
      await screen.findByText('As invariantes não estão disponíveis — a API no ar ainda não as serve.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
