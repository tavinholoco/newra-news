import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SourceHealthReport } from '@newranews/types';
import { SourceHealthPanel } from '@/components/dashboard/source-health-panel';
import { renderWithIntl } from '@/tests/utils';
import { emptySourceHealthReport, sourceHealthReport } from '@/tests/fixtures/observability';

/**
 * O painel "Fontes" da aba Métricas (§15 do plano de observabilidade, 11c).
 *
 * O que se mede aqui é a tela: que os dois gatilhos da §15 viram linha só
 * quando disparam, que a tabela desenha o dia sem linha como "não tentada" e
 * não como falha, que as colunas ordenam, que a rosquinha lê `kept`, e que a
 * API de produção sem a rota (404, armadilha 37) vira "indisponível" e não
 * uma aba quebrada. A aritmética está em `lib/source-days.test.ts`.
 */

function mockFetch(report: SourceHealthReport | { status: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      'status' in report
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
      <SourceHealthPanel />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SourceHealthPanel', () => {
  it('names the source that has been failing for three days, and the one that is withering — and no other', async () => {
    mockFetch(sourceHealthReport);
    renderPanel();

    const alerts = await screen.findByRole('status', { name: 'Alertas de fonte' });
    const lines = within(alerts).getAllByRole('listitem').map((li) => li.textContent);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('Superinteressante está em falha há 3 dias seguidos.');
    // 2 / ((23 × 10 + 7 × 2) / 30) ≈ 25%.
    expect(lines[1]).toBe(
      'Trivela está definhando: as novas por dia dos últimos 7 dias são 25% da média de 30.',
    );
  });

  it('draws one row per source with today, the averages, the streak and the 30-day strip', async () => {
    mockFetch(sourceHealthReport);
    renderPanel();

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(5);

    const superinteressante = rows.find((row) => within(row).queryByText('Superinteressante')) as HTMLElement;
    expect(within(superinteressante).getByText('Falhou')).toBeInTheDocument();
    expect(within(superinteressante).getByText('3')).toBeInTheDocument();
    // A latência é a do último dia tentado — o timeout de 30 s.
    expect(within(superinteressante).getByText('30 s')).toBeInTheDocument();

    const strip = within(superinteressante).getByRole('list', {
      name: 'Desfecho de Superinteressante por dia, últimos 30 dias',
    });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(30);
    expect(within(strip).getByText('15 de set.: Falhou — fetch failed: ETIMEDOUT')).toBeInTheDocument();
    expect(within(strip).getByText('12 de set.: Com itens — 8 novas de 13')).toBeInTheDocument();
  });

  it('calls the day without a line "not attempted", never a failure', async () => {
    mockFetch(sourceHealthReport);
    renderPanel();

    const table = await screen.findByRole('table');
    const g1 = within(table).getAllByRole('row').find((row) => within(row).queryByText('G1')) as HTMLElement;
    const strip = within(g1).getByRole('list', { name: /Desfecho de G1/ });

    expect(within(strip).getByText('14 de set.: Não tentada')).toBeInTheDocument();
    expect(within(strip).queryByText('14 de set.: Falhou')).not.toBeInTheDocument();
    // E a média não a conta contra a fonte: 29 dias tentados a 30.
    expect(within(g1).getAllByText('30')).not.toHaveLength(0);
  });

  it('shows the variation only where there is a baseline, and the empty day as "Vazia"', async () => {
    mockFetch(sourceHealthReport);
    renderPanel();

    const table = await screen.findByRole('table');
    const veja = within(table).getAllByRole('row').find((row) => within(row).queryByText('Veja Saúde')) as HTMLElement;

    expect(within(veja).getByText('Vazia')).toBeInTheDocument();
    // 7 dias: 5 × 4 + 2 × 0 = 20 / 7 ≈ 2,9; 30 dias: 112 / 30 ≈ 3,7 → −23,5%.
    expect(within(veja).getByText('-23,5%')).toBeInTheDocument();
  });

  it('sorts by the column clicked — descending first, then ascending', async () => {
    const user = userEvent.setup();
    mockFetch(sourceHealthReport);
    renderPanel();

    const table = await screen.findByRole('table');
    const firstSource = () => within(within(table).getAllByRole('row')[1] as HTMLElement).getAllByRole('cell')[0]?.textContent;

    // O padrão: média de 30 dias, maior primeiro — o agregador.
    expect(firstSource()).toContain('newsdata');

    await user.click(within(table).getByRole('button', { name: 'Dias em falha' }));
    expect(firstSource()).toContain('Superinteressante');

    await user.click(within(table).getByRole('button', { name: 'Fonte' }));
    expect(firstSource()).toContain('Veja Saúde');
    await user.click(within(table).getByRole('button', { name: 'Fonte' }));
    expect(firstSource()).toContain('G1');
  });

  it('draws the contribution donut from kept over the window, with the total in the middle', async () => {
    mockFetch(sourceHealthReport);
    renderPanel();

    const donut = await screen.findByRole('img', { name: 'Contribuição por fonte (30 dias)' });
    expect(donut).toBeInTheDocument();
    // 870 (G1: 29 × 30) + 216 + 244 + 112 + 1.200 = 2.642.
    expect(within(donut).getByText('2.642')).toBeInTheDocument();
    expect(within(donut).getByText('novas')).toBeInTheDocument();
    // A legenda vem por contribuição, maior primeiro — a NewsData, e não uma
    // cauda "Outras" somada: reordenada por valor, a cauda saía em primeiro.
    const legend = donut.parentElement?.querySelector('ul') as HTMLElement;
    const labels = within(legend).getAllByRole('listitem').map((li) => li.textContent);
    expect(labels[0]).toContain('newsdata');
    expect(labels[1]).toContain('G1');
  });

  it('folds the tail beyond the seventh source into "Outras", last', async () => {
    const many: SourceHealthReport = {
      ...sourceHealthReport,
      sources: Array.from({ length: 9 }, (_, i) => ({
        source: `Fonte ${i + 1}`,
        kind: 'RSS' as const,
        days: sourceHealthReport.sources[0]!.days.map((day) => ({ ...day, kept: 10 - i, fetched: 20 })),
      })),
    };
    mockFetch(many);
    renderPanel();

    const donut = await screen.findByRole('img', { name: 'Contribuição por fonte (30 dias)' });
    const legend = donut.parentElement?.querySelector('ul') as HTMLElement;
    const labels = within(legend).getAllByRole('listitem').map((li) => li.textContent);

    expect(labels).toHaveLength(8);
    expect(labels[0]).toContain('Fonte 1');
    expect(labels[7]).toContain('Outras 2 fontes');
  });

  it('draws "unavailable" when the API does not serve the route yet — never a broken tab', async () => {
    mockFetch({ status: 404 });
    renderPanel();

    expect(
      await screen.findByText('A saúde por fonte não está disponível — a API no ar ainda não a serve.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says the table is empty before the first run with the phase, not "unavailable"', async () => {
    mockFetch(emptySourceHealthReport);
    renderPanel();

    expect(await screen.findByText(/Nenhuma fonte registrada na janela ainda/)).toBeInTheDocument();
  });

  it('keeps the legend once, below the table, with the four states', async () => {
    mockFetch(sourceHealthReport);
    renderPanel();

    await screen.findByRole('table');
    await waitFor(() => {
      expect(screen.getByText('17 de ago. a 15 de set.')).toBeInTheDocument();
    });
    for (const state of ['Com itens', 'Vazia', 'Falhou', 'Não tentada']) {
      expect(screen.getAllByText(state).length).toBeGreaterThan(0);
    }
  });
});
