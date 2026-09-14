import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardMetrics } from '@newranews/types';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { renderWithIntl } from '@/tests/utils';
import { httpMetrics } from '@/tests/fixtures/observability';

const mockMetrics: DashboardMetrics = {
  today: {
    newsCollected: 491,
    articleGenerated: true,
    aiProvider: 'gemini',
    // Milissegundos, como o backend grava (`Date.now() - startedAt`).
    pipelineDuration: 27_000,
    pipelineErrors: 0,
    // As três colunas que a Fase 5 do plano de observabilidade pôs no contrato.
    newsApiCount: 300,
    rssCount: 191,
    cleanupCount: 12,
  },
  lastWeek: {
    period: {
      start: '2026-08-09T00:00:00.000Z',
      end: '2026-08-15T23:59:59.999Z',
    },
    totalDays: 7,
    // 491 sobre 436,4 é +12,5% — o número da §4.2 do plano, de propósito.
    avgNewsPerDay: 436.4,
    totalArticlesGenerated: 7,
    pipelineSuccessRate: 1,
    avgPipelineDuration: 30_000,
    newsByCategory: { WORLD: 3484, TECHNOLOGY: 345, ECONOMY: 128 },
    aiProviderUsage: { gemini: 6, groq: 1 },
  },
  lastMonth: {
    totalNewsCollected: 14800,
    totalArticlesGenerated: 30,
    avgNewsPerDay: 493,
    failureDays: 0,
  },
};

/**
 * **O `fetch` é roteado pela URL**, porque a tela faz duas consultas: as
 * métricas do pipeline e os quatro sinais da API. Um mock que devolvesse o
 * mesmo corpo para as duas entregaria `DashboardMetrics` a quem espera
 * `HttpMetrics`, e o painel de sinais quebraria lendo `saturation` de um
 * objeto que não a tem — falha sem relação com o que o teste mede.
 */
function mockFetchSuccess(metrics: DashboardMetrics = mockMetrics) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      const data = url.includes('/api/admin/http-metrics') ? httpMetrics : metrics;
      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue({ data }),
      });
    }),
  );
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithIntl(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DashboardClient', () => {
  it('opens with the KPI row: value, variation and the baseline it is measured against', async () => {
    mockFetchSuccess();
    renderWithClient(<DashboardClient initialData={mockMetrics} />);

    const kpi = await screen.findByRole('region', { name: 'Indicadores principais' });

    expect(within(kpi).getByText('Notícias coletadas hoje')).toBeInTheDocument();
    expect(within(kpi).getByText('491')).toBeInTheDocument();
    expect(within(kpi).getByText('+12,5%')).toBeInTheDocument();
    expect(within(kpi).getAllByText('vs. média 7 d')).toHaveLength(2);

    // Duração caiu de 30 s para 27 s: −10%, e é melhora — a cor diz isso.
    expect(within(kpi).getByText('27s')).toBeInTheDocument();
    const duration = within(kpi).getByText('-10%');
    expect(duration.className).toContain('text-success');

    // Média de 7 d abaixo da de 30 d: piora, em vermelho.
    const avg = within(kpi).getByText('-11,5%');
    expect(avg.className).toContain('text-danger');
    expect(within(kpi).getByText('vs. média 30 d')).toBeInTheDocument();
  });

  it('leaves the success-rate card without a chip — there is no honest 30-day pair for it', async () => {
    mockFetchSuccess();
    renderWithClient(<DashboardClient initialData={mockMetrics} />);

    const kpi = await screen.findByRole('region', { name: 'Indicadores principais' });
    const card = within(kpi).getByText('Taxa de sucesso (7 d)').closest('[data-slot="card"]');

    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText('100%')).toBeInTheDocument();
    expect(within(card as HTMLElement).queryByText(/vs\./)).toBeNull();
  });

  it('renders today with the ingestion donut and the cleanup count', async () => {
    mockFetchSuccess();
    renderWithClient(<DashboardClient initialData={mockMetrics} />);

    expect(await screen.findByText('Gerado')).toBeInTheDocument();
    expect(screen.getAllByText('Gemini').length).toBeGreaterThan(0);
    expect(screen.getByText('Linhas apagadas')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    // As duas fontes de ingestão, gravadas desde a V1 e nunca desenhadas.
    const donut = screen.getByRole('img', { name: 'Ingestão por fonte' });
    expect(donut).toBeInTheDocument();
    expect(screen.getByText('NewsData')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
    expect(screen.getByText('RSS')).toBeInTheDocument();
    expect(screen.getByText('191')).toBeInTheDocument();
  });

  it('draws category and provider as donuts with a legend, and keeps the monthly cards', async () => {
    mockFetchSuccess();
    renderWithClient(<DashboardClient initialData={mockMetrics} />);

    expect(await screen.findByText('Últimos 7 dias')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Notícias por categoria (7 dias)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'IA utilizada (7 dias)' })).toBeInTheDocument();
    // Legenda com valor e porcentagem: 3.484 de 3.957 é 88%.
    expect(screen.getByText('3.484')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('Últimos 30 dias')).toBeInTheDocument();
    expect(screen.getByText('14.800')).toBeInTheDocument();
  });

  it('shows the four signals of the API from their own query', async () => {
    mockFetchSuccess();
    renderWithClient(<DashboardClient initialData={mockMetrics} />);

    expect(await screen.findByText('Os quatro sinais da API')).toBeInTheDocument();
    // 305 h sobre 750 h: 41%, e a rota mais chamada na tabela.
    expect(await screen.findByText('41%')).toBeInTheDocument();
    expect(screen.getByText('GET /api/news')).toBeInTheDocument();
  });

  it('should show a pending message when the pipeline has not run today', async () => {
    mockFetchSuccess({ ...mockMetrics, today: null });
    renderWithClient(
      <DashboardClient initialData={{ ...mockMetrics, today: null }} />,
    );

    expect(
      await screen.findByText(/pipeline ainda não rodou hoje/i),
    ).toBeInTheDocument();
    // Sem run de hoje os dois cartões de "hoje" ficam sem número e sem chip.
    const kpi = screen.getByRole('region', { name: 'Indicadores principais' });
    expect(within(kpi).getAllByText('—')).toHaveLength(2);
    expect(within(kpi).queryByText('vs. média 7 d')).toBeNull();
  });

  it('should show an error message when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    renderWithClient(<DashboardClient initialData={null} />);

    expect(
      await screen.findByText(/Não foi possível carregar as métricas/i),
    ).toBeInTheDocument();
  });
});
