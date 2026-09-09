import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRunPipeline } from '@/lib/queries';

/**
 * **O disparo do pipeline e a lista que fica logo abaixo dele.**
 *
 * A `/admin` mostra o botão "executar agora" e, na seção seguinte, o histórico
 * de execuções. Sem invalidar a lista no sucesso do disparo, o clique confirma
 * que rodou e a tela **continua mostrando o run de ontem** — a mesma seção
 * dizendo uma coisa e a de baixo dizendo outra. É a família do defeito de
 * 25/08/2026 ("Pipeline disparado com sucesso" sem ter disparado nada), em
 * outra forma: a tela afirmando mais do que sabe.
 *
 * Este teste existe porque a asserção não cabe na suíte do componente — lá
 * `@/lib/queries` é mockado inteiro, então a fiação entre a mutação e o cache
 * fica de fora. É o mesmo argumento da guarda de fiação da Fase 1: guarda sobre
 * a peça, sem guarda sobre quem a liga, não guarda nada.
 */

const runDailyPipelineMock = vi.fn();

vi.mock('@/lib/api', () => ({
  runDailyPipeline: () => runDailyPipelineMock(),
  // O módulo inteiro é substituído, e `lib/queries` importa uma dúzia de
  // funções dele na carga — declarar só a que este teste usa deixaria as outras
  // `undefined` e o import falharia. Mock parcial mente por omissão; aqui a
  // omissão quebra na hora, que é o modo de falha bom.
  getNews: vi.fn(),
  getNewsFacets: vi.fn(),
  getNewsById: vi.fn(),
  getArticles: vi.fn(),
  getArticleByDate: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getProductMetrics: vi.fn(),
  getAccount: vi.fn(),
  updatePreferences: vi.fn(),
  updateNewsletterSubscription: vi.fn(),
  getFavorites: vi.fn(),
  getFavoriteIds: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  deleteNewsAdmin: vi.fn(),
  getPipelineRuns: vi.fn(),
  getPipelineRunDetail: vi.fn(),
}));

function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, 'invalidateQueries');

  return {
    client,
    invalidate,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRunPipeline', () => {
  it('invalidates the pipeline runs after a successful trigger', async () => {
    runDailyPipelineMock.mockResolvedValue({
      success: true,
      data: {
        outcome: 'started',
        pipelineId: 'aaaaaaaa-0000-0000-0000-000000000001',
        startedAt: '2026-09-07T11:00:00.000Z',
      },
    });
    const { invalidate, wrapper } = harness();

    const { result } = renderHook(() => useRunPipeline(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['admin', 'pipeline'],
    });
  });

  it('does not touch the news list — the trigger does not change it', async () => {
    runDailyPipelineMock.mockResolvedValue({ success: true });
    const { invalidate, wrapper } = harness();

    const { result } = renderHook(() => useRunPipeline(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ['admin', 'news-list'],
    });
  });

  it('invalidates nothing when the trigger fails', async () => {
    runDailyPipelineMock.mockRejectedValue(new Error('boom'));
    const { invalidate, wrapper } = harness();

    const { result } = renderHook(() => useRunPipeline(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
