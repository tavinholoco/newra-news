import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardMetrics } from '@newranews/types';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { renderWithIntl } from '@/tests/utils';

const mockMetrics: DashboardMetrics = {
  today: {
    newsCollected: 491,
    articleGenerated: true,
    aiProvider: 'gemini',
    // Milissegundos, como o backend grava (`Date.now() - startedAt`).
    pipelineDuration: 27_000,
    pipelineErrors: 0,
  },
  lastWeek: {
    period: {
      start: '2026-08-09T00:00:00.000Z',
      end: '2026-08-15T23:59:59.999Z',
    },
    totalDays: 7,
    avgNewsPerDay: 489.7,
    totalArticlesGenerated: 7,
    pipelineSuccessRate: 1,
    avgPipelineDuration: 65_000,
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

function mockFetchSuccess() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: mockMetrics }),
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
  it('should render the daily summary with formatted values', async () => {
    mockFetchSuccess();
    renderWithClient(<DashboardClient initialData={mockMetrics} />);

    expect(await screen.findAllByText('Notícias coletadas')).not.toHaveLength(0);
    expect(screen.getByText('491')).toBeInTheDocument();
    expect(screen.getByText('Gerado')).toBeInTheDocument();
    expect(screen.getAllByText('Gemini').length).toBeGreaterThan(0);
    expect(screen.getByText('27s')).toBeInTheDocument();
  });

  it('should render weekly, category, provider and monthly sections', async () => {
    mockFetchSuccess();
    renderWithClient(<DashboardClient initialData={mockMetrics} />);

    expect(await screen.findByText('Últimos 7 dias')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(
      screen.getByText('Notícias por categoria (7 dias)'),
    ).toBeInTheDocument();
    expect(screen.getByText('IA utilizada (7 dias)')).toBeInTheDocument();
    expect(screen.getByText('Últimos 30 dias')).toBeInTheDocument();
    expect(screen.getByText('3.484')).toBeInTheDocument();
  });

  it('should show a pending message when the pipeline has not run today', async () => {
    mockFetchSuccess();
    renderWithClient(
      <DashboardClient initialData={{ ...mockMetrics, today: null }} />,
    );

    expect(
      await screen.findByText(/pipeline ainda não rodou hoje/i),
    ).toBeInTheDocument();
  });

  it('should show an error message when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    renderWithClient(<DashboardClient initialData={null} />);

    expect(
      await screen.findByText(/Não foi possível carregar as métricas/i),
    ).toBeInTheDocument();
  });
});
