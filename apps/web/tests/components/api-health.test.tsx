import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/tests/utils';
import { httpMetrics } from '@/tests/fixtures/observability';

const { useHttpMetrics, useRecordPlanHoursReading } = vi.hoisted(() => ({
  useHttpMetrics: vi.fn(),
  useRecordPlanHoursReading: vi.fn(),
}));

// Os dois hooks que a aba lê — mock parcial mente por omissão (armadilha da
// Fase 2): sem o segundo, o formulário da leitura derrubaria a suíte inteira.
vi.mock('@/lib/queries', () => ({ useHttpMetrics, useRecordPlanHoursReading }));

const { ApiHealth } = await import('@/components/admin/api-health');
const { GoldenSignals } = await import('@/components/dashboard/golden-signals');

const mutate = vi.fn();

function mutation(overrides: Record<string, unknown> = {}) {
  return { mutate, isPending: false, isSuccess: false, isError: false, error: null, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  useRecordPlanHoursReading.mockReturnValue(mutation());
});

describe('ApiHealth — a linha de KPI da visão geral', () => {
  it('draws the plan arc with the hours used over the ceiling, and the pace of the month', () => {
    // 14/09 às 12:00 UTC: 324 h decorridas, 305 h usadas — 94% do tempo ligada,
    // e no ritmo 678 h no fim de setembro (90% do plano).
    vi.useFakeTimers({ now: new Date('2026-09-14T12:00:00.000Z'), toFake: ['Date'] });
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });

    renderWithIntl(<ApiHealth />);

    expect(screen.getByRole('heading', { name: 'Saúde da API agora' })).toBeInTheDocument();
    // Sem leitura do Billing, o arco diz de quem é: só esta API, e o teto é
    // do workspace (Fase 13, 13b).
    expect(
      screen.getByRole('img', { name: 'Horas desta API: 41% (305 h / 750 h)' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/O teto de 750 h é do workspace/)).toBeInTheDocument();
    expect(
      screen.getByText(/No ritmo atual, esta API chega a 678 h no fim do mês \(90% do teto\)/),
    ).toBeInTheDocument();
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

    expect(screen.getByRole('img', { name: 'Horas desta API: Indisponível' })).toBeInTheDocument();
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

/**
 * **O arco do workspace — Fase 13 do plano de observabilidade, 13b (§23).**
 *
 * Os números de outubro de 2026: na leitura (06/10 00:00) o Billing marcava
 * 130 h e esta API 40 h — os outros serviços a 75 % do relógio; um dia
 * depois, esta API mede 48 h e os outros andaram 18 h no ritmo da leitura.
 */
describe('ApiHealth — com a leitura do Billing, o arco é o workspace', () => {
  const october = {
    ...httpMetrics,
    saturation: {
      ...httpMetrics.saturation,
      plan: {
        month: '2026-10',
        monthStart: '2026-10-01T00:00:00.000Z',
        secondsUsed: 172_800,
        hoursUsed: 48,
        limitHours: 750,
        ratio: 0.064,
        workspaceReading: {
          readAt: '2026-10-06T00:00:00.000Z',
          workspaceHours: 130,
          apiHours: 40,
        },
      },
    },
  };

  it('draws the whole workspace, says which part is measured, and projects both paces', () => {
    vi.useFakeTimers({ now: new Date('2026-10-07T00:00:00.000Z'), toFake: ['Date'] });
    useHttpMetrics.mockReturnValue({ data: october, isError: false });

    renderWithIntl(<ApiHealth />);

    // 48 h medidas + 108 h estimadas = 156 h: 21 % do teto, com o "~" de
    // estimativa — e não os 6 % que a parte desta API sozinha diria.
    expect(
      screen.getByRole('img', { name: 'Horas do workspace: 21% (~156 h / 750 h)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Esta API 48 h · outros serviços ~108 h')).toBeInTheDocument();
    expect(screen.getByText(/Leitura do Billing: 130 h em/)).toBeInTheDocument();
    // (1/3 + 0,75) × 744 h = 806 h: acima do teto — a conta de outubro.
    expect(
      screen.getByText(/No ritmo atual, o workspace chega a 806 h no fim do mês \(107% do teto\)/),
    ).toBeInTheDocument();
  });

  it('keeps drawing when the API on air does not send the reading yet (armadilha 37)', () => {
    const { workspaceReading: _dropped, ...legacyPlan } = october.saturation.plan;
    useHttpMetrics.mockReturnValue({
      data: { ...october, saturation: { ...october.saturation, plan: legacyPlan } },
      isError: false,
    });

    renderWithIntl(<ApiHealth />);

    expect(screen.getByRole('img', { name: /^Horas desta API: 6%/ })).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});

/**
 * **As horas por dia (13.9, dobrado no 13b).** O gatilho "dois dias seguidos
 * acima de 10 h" passa a ser lido na tela em vez de no banco de produção.
 */
describe('ApiHealth — as horas desta API por dia', () => {
  function withSeries(days: Array<{ date: string; seconds: number }>, until = '2026-10-07') {
    return {
      ...httpMetrics,
      saturation: {
        ...httpMetrics.saturation,
        plan: {
          ...httpMetrics.saturation.plan!,
          uptimeByDay: { since: '2026-09-24', until, days },
        },
      },
    };
  }

  it('draws one bar per day of the window, the day without a row included', () => {
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });

    renderWithIntl(<ApiHealth />);

    const list = screen.getByRole('list', { name: 'Horas desta API por dia' });
    // A janela inteira (01 a 14/09), e não só os três dias com linha.
    expect(within(list).getAllByRole('listitem')).toHaveLength(14);
    expect(list).toHaveTextContent('13 de set.: 4');
    expect(screen.queryByText(/dias seguidos/)).toBeNull();
  });

  it('says it when two whole days in a row passed 10 h — today, partial, does not count', () => {
    useHttpMetrics.mockReturnValue({
      data: withSeries([
        { date: '2026-10-05', seconds: 39_600 },
        { date: '2026-10-06', seconds: 43_200 },
        { date: '2026-10-07', seconds: 3_600 },
      ]),
      isError: false,
    });

    renderWithIntl(<ApiHealth />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Esta API passou de 10 h por dia em 2 dias seguidos',
    );
  });

  it('draws on the scale of a whole day, with the 10 h line — never relative to the busiest day', () => {
    // Achado da captura: com a escala da série, nove dias de 9 h eram nove
    // barras cheias, e a tela não dizia se 9 h é muito ou pouco — que é a
    // pergunta do 13.9.
    useHttpMetrics.mockReturnValue({
      data: withSeries([
        { date: '2026-10-05', seconds: 43_200 }, // 12 h
        { date: '2026-10-06', seconds: 21_600 }, // 6 h
      ]),
      isError: false,
    });

    renderWithIntl(<ApiHealth />);

    const list = screen.getByRole('list', { name: 'Horas desta API por dia' });
    const bar = (date: string) =>
      within(list).getByText(new RegExp(`^${date}:`)).nextElementSibling as HTMLElement;
    expect(bar('05 de out.').style.height).toBe('50%');
    expect(bar('06 de out.').style.height).toBe('25%');
    expect(screen.getByText('10 h')).toBeInTheDocument();
  });

  it('is not drawn when the API on air does not send the series yet (armadilha 37)', () => {
    const { uptimeByDay: _dropped, ...legacyPlan } = httpMetrics.saturation.plan!;
    useHttpMetrics.mockReturnValue({
      data: { ...httpMetrics, saturation: { ...httpMetrics.saturation, plan: legacyPlan } },
      isError: false,
    });

    renderWithIntl(<ApiHealth />);

    expect(screen.queryByRole('list', { name: 'Horas desta API por dia' })).toBeNull();
    // O resto da aba continua de pé.
    expect(screen.getByRole('img', { name: /^Horas desta API: 41%/ })).toBeInTheDocument();
  });
});

describe('ApiHealth — o formulário da leitura do Billing', () => {
  it('reads the number the way the panel writes it, comma included', async () => {
    const user = userEvent.setup();
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });

    renderWithIntl(<ApiHealth />);
    await user.type(screen.getByLabelText(/Total do Billing/), '400,5');
    await user.click(screen.getByRole('button', { name: 'Registrar leitura' }));

    expect(mutate).toHaveBeenCalledWith(400.5);
  });

  it('refuses, before sending, a reading below what this API already recorded', async () => {
    const user = userEvent.setup();
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });

    renderWithIntl(<ApiHealth />);
    await user.type(screen.getByLabelText(/Total do Billing/), '30,5');
    await user.click(screen.getByRole('button', { name: 'Registrar leitura' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A leitura é menor que as 305 h que esta API já registrou neste mês',
    );
  });

  it('refuses text that is not a number of hours', async () => {
    const user = userEvent.setup();
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });

    renderWithIntl(<ApiHealth />);
    await user.type(screen.getByLabelText(/Total do Billing/), '124 h');
    await user.click(screen.getByRole('button', { name: 'Registrar leitura' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Digite as horas como no painel');
  });

  it('says when the reading was recorded, and when it was not', () => {
    useHttpMetrics.mockReturnValue({ data: httpMetrics, isError: false });
    useRecordPlanHoursReading.mockReturnValue(mutation({ isSuccess: true }));
    const { unmount } = renderWithIntl(<ApiHealth />);
    expect(screen.getByRole('status')).toHaveTextContent('Leitura registrada.');
    unmount();

    useRecordPlanHoursReading.mockReturnValue(
      mutation({ isError: true, error: new Error('API error: 502') }),
    );
    renderWithIntl(<ApiHealth />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível registrar a leitura.');
  });

  it('is not offered when the plan hours are unavailable — there is nothing to compare it with', () => {
    useHttpMetrics.mockReturnValue({
      data: { ...httpMetrics, saturation: { ...httpMetrics.saturation, plan: null } },
      isError: false,
    });

    renderWithIntl(<ApiHealth />);

    expect(screen.queryByLabelText(/Total do Billing/)).toBeNull();
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
