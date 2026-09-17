import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/tests/utils';
import { httpMetrics } from '@/tests/fixtures/observability';

const { useHttpMetrics } = vi.hoisted(() => ({ useHttpMetrics: vi.fn() }));

vi.mock('@/lib/queries', () => ({ useHttpMetrics }));

const { ApiHealth } = await import('@/components/admin/api-health');
const { GoldenSignals } = await import('@/components/dashboard/golden-signals');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('ApiHealth — a linha de KPI da visão geral', () => {
  it('draws the plan arc with the hours used over the ceiling, and the pace of the month', () => {
    // 14/09 às 12:00 UTC: 324 h decorridas, 305 h usadas — 94% do tempo ligada,
    // e no ritmo 678 h no fim de setembro (90% do plano).
    vi.useFakeTimers({ now: new Date('2026-09-14T12:00:00.000Z'), toFake: ['Date'] });
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });

    renderWithIntl(<ApiHealth />);

    expect(screen.getByRole('heading', { name: 'Saúde da API agora' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Horas do plano: 41% (305 h / 750 h)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No ritmo atual, 678 h no fim do mês \(90% do plano\)/)).toBeInTheDocument();
    // Memória e event loop, da mesma resposta.
    expect(screen.getByRole('img', { name: 'Memória: 18% (94 MB / 512 MB)' })).toBeInTheDocument();
    expect(screen.getByText('Atraso do event loop (p95)')).toBeInTheDocument();
    expect(screen.getByText('2 ms')).toBeInTheDocument();
    // A instância, com a janela dita: zera a cada acordada.
    expect(screen.getByText(/de pé há 3 h 12 min: 1\.284 requisições, 0,08% com erro/)).toBeInTheDocument();
  });

  it('draws "unavailable" when the plan came back null — never zero', () => {
    useHttpMetrics.mockReturnValue({
      data: { ...httpMetrics, saturation: { ...httpMetrics.saturation, plan: null } },
      isError: false,
    });

    renderWithIntl(<ApiHealth />);

    expect(screen.getByRole('img', { name: 'Horas do plano: Indisponível' })).toBeInTheDocument();
    expect(screen.getByText(/O banco não respondeu/)).toBeInTheDocument();
    expect(screen.queryByText('0%')).toBeNull();
    // Os outros sinais continuam: banco fora não apaga a memória.
    expect(screen.getByRole('img', { name: /Memória: 18%/ })).toBeInTheDocument();
  });

  it('holds the pace line back before a day of sample', () => {
    vi.useFakeTimers({ now: new Date('2026-09-01T03:00:00.000Z'), toFake: ['Date'] });
    useHttpMetrics.mockReturnValue({
      data: {
        ...httpMetrics,
        saturation: {
          ...httpMetrics.saturation,
          plan: { ...httpMetrics.saturation.plan!, hoursUsed: 3, secondsUsed: 10_800, ratio: 0.004 },
        },
      },
      isError: false,
    });

    renderWithIntl(<ApiHealth />);

    expect(screen.getByText(/só é projetado com 24 h de amostra/)).toBeInTheDocument();
    expect(screen.queryByText(/No ritmo atual/)).toBeNull();
  });

  it('draws the skeleton, then the alert on failure', () => {
    useHttpMetrics.mockReturnValue({ data: undefined, isError: false });
    const { unmount, container } = renderWithIntl(<ApiHealth />);
    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThan(0);
    unmount();

    useHttpMetrics.mockReturnValue({ data: undefined, isError: true });
    renderWithIntl(<ApiHealth />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a saúde da API.');
  });
});

describe('GoldenSignals — os quatro sinais na aba de métricas', () => {
  it('shows traffic, latency, both error rates and the routes table', () => {
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });

    renderWithIntl(<GoldenSignals />);

    expect(screen.getByText('1.284')).toBeInTheDocument();
    expect(screen.getByText('250 ms')).toBeInTheDocument();
    expect(screen.getByText('p50 50 ms · máx. 4,9 s')).toBeInTheDocument();
    expect(screen.getByText('0,08%')).toBeInTheDocument();
    expect(screen.getByText('1,2%')).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('GET /api/news');
    expect(table).toHaveTextContent('812');
    expect(table).toHaveTextContent('100 ms');
  });

  it('shows the 4xx rate per route — where the 429 of the two anonymous doors reads', () => {
    // Fase 7c: o contador existia desde a Fase 9 e nunca saía do processo. A
    // coluna é o que torna "429 em POST /api/events" um gatilho que alguém vê.
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });

    renderWithIntl(<GoldenSignals />);

    expect(screen.getByRole('columnheader', { name: '4xx' })).toBeInTheDocument();
    const news = screen.getByText('GET /api/news').closest('tr');
    expect(news).toHaveTextContent('0,12%');
  });

  it('draws a dash, never NaN, when the API on air does not send the 4xx rate yet', () => {
    // Armadilha 37: o preview da `dev` lê a API de produção, que só ganha o
    // campo na promoção. A forma antiga da resposta tem de continuar
    // desenhável.
    const legacyRoutes = httpMetrics.routes.map(({ clientErrorRate: _dropped, ...route }) => route);
    useHttpMetrics.mockReturnValue({
      data: { ...httpMetrics, routes: legacyRoutes as typeof httpMetrics.routes },
      isError: false,
    });

    renderWithIntl(<GoldenSignals />);

    const news = screen.getByText('GET /api/news').closest('tr');
    expect(news).toHaveTextContent('—');
    expect(news).not.toHaveTextContent('NaN');
  });

  it('says there is no request yet instead of drawing an empty table', () => {
    useHttpMetrics.mockReturnValue({ data: { ...httpMetrics, routes: [] }, isError: false });

    renderWithIntl(<GoldenSignals />);

    expect(screen.getByText('Nenhuma requisição na janela ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('draws its own alert on failure', () => {
    useHttpMetrics.mockReturnValue({ data: undefined, isError: true });

    renderWithIntl(<GoldenSignals />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar os sinais da API.');
  });
});
