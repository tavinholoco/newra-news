import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProductMetrics } from '@newranews/types';
import { renderWithIntl } from '@/tests/utils';

const { useProductMetrics } = vi.hoisted(() => ({
  useProductMetrics: vi.fn(),
}));

vi.mock('@/lib/queries', () => ({ useProductMetrics }));

const { ProductMetricsClient } = await import(
  '@/components/dashboard/product-metrics-client'
);

const vazio: ProductMetrics = {
  period: {
    start: '2026-07-23T00:00:00.000Z',
    end: '2026-08-22T00:00:00.000Z',
    days: 30,
  },
  audience: { sessions: 0, newsletterSubscribers: 0, accounts: 0 },
  byDay: [],
  byType: [],
  storyOpensBySource: [],
  categoryViews: [],
  readingDepth: {
    opened: 0,
    viewed: 0,
    completed: 0,
    scroll25: 0,
    scroll50: 0,
    scroll90: 0,
  },
  searchesWithoutResults: [],
};

function comDados(patch: Partial<ProductMetrics>): ProductMetrics {
  return { ...vazio, ...patch };
}

function mockQuery(data: ProductMetrics | undefined, extra = {}) {
  useProductMetrics.mockReturnValue({
    data,
    isFetching: false,
    isError: false,
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery(vazio);
});

describe('ProductMetricsClient', () => {
  it('desenha o estado vazio sem quebrar — é o estado de hoje', () => {
    // A tela nasce mostrando zero, e zero é honesto: a ingestão acabou de
    // entrar no ar. Se ela caísse aqui, só se descobriria em produção.
    renderWithIntl(<ProductMetricsClient />);

    expect(screen.getByText('Assinantes')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma busca sem resultado na janela.')).toBeInTheDocument();
  });

  it('põe o número que um patrocinador pede antes do de sessões', () => {
    // A ordem não é estética: sessão é volume de visita, e quem confunde as
    // duas conclui que tem audiência recorrente sem ter.
    renderWithIntl(<ProductMetricsClient />);

    // Casamento exato: "Sessões por dia" (a série da Fase 5) também contém
    // "Sessões", e não é cartão de audiência.
    const rotulos = screen
      .getAllByText(/^(Assinantes|Contas|Sessões)$/)
      .map((el) => el.textContent);

    expect(rotulos).toEqual(['Assinantes', 'Contas', 'Sessões']);
  });

  it('avisa que sessão não diz quem voltou', () => {
    renderWithIntl(<ProductMetricsClient />);

    expect(
      screen.getByText('Volume de visita — não diz quem voltou'),
    ).toBeInTheDocument();
  });

  it('calcula a leitura completa sobre as telas vistas, não sobre os cliques', () => {
    // 13.4 do plano de observabilidade: 1.034 leituras a 90% contra 0
    // aberturas em 01/10/2026. O clique no card não acontece para quem chega
    // pelo buscador; o denominador é a tela de leitura vista.
    mockQuery(
      comDados({
        readingDepth: {
          opened: 2,
          viewed: 10,
          completed: 3,
          scroll25: 8,
          scroll50: 5,
          scroll90: 40,
        },
      }),
    );

    renderWithIntl(<ProductMetricsClient />);

    const cartao = screen.getByText('Leitura completa').parentElement as HTMLElement;
    expect(cartao).toHaveTextContent('30%');
    expect(screen.getByText('Telas de leitura vistas').parentElement).toHaveTextContent(
      '10',
    );
  });

  it('não inventa taxa quando nenhuma tela foi vista', () => {
    // Zero sobre zero não é 0% — é falta de amostra (armadilha 24).
    renderWithIntl(<ProductMetricsClient />);

    const cartao = screen.getByText('Leitura completa').parentElement as HTMLElement;
    expect(cartao).toHaveTextContent('—');
    expect(cartao).not.toHaveTextContent('0%');
  });

  it('desenha "indisponível" quando a API no ar ainda não mede a tela vista', () => {
    // Armadilha 37: o preview da `dev` lê a API de produção, que não manda
    // `viewed`/`completed` até a promoção. Dividir pelo campo ausente daria
    // `NaN%`; dividir pelos cliques voltaria à métrica que mente.
    const antigo = {
      ...vazio,
      readingDepth: { opened: 0, scroll25: 1036, scroll50: 1035, scroll90: 1034 },
    } as unknown as ProductMetrics;
    mockQuery(antigo);

    renderWithIntl(<ProductMetricsClient />);

    const cartao = screen.getByText('Leitura completa').parentElement as HTMLElement;
    expect(cartao).toHaveTextContent('—');
    expect(cartao).toHaveTextContent('A API no ar ainda não mede a tela vista');
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('troca a janela e refaz a consulta com o novo recorte', async () => {
    renderWithIntl(<ProductMetricsClient />);

    expect(useProductMetrics).toHaveBeenLastCalledWith(30);

    await userEvent.click(screen.getByRole('button', { name: '7 dias' }));

    expect(useProductMetrics).toHaveBeenLastCalledWith(7);
  });

  it('marca a janela ativa para quem não enxerga a cor', () => {
    renderWithIntl(<ProductMetricsClient />);

    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('não oferece janela além da retenção do evento cru', () => {
    // Acima de 90 dias o expurgo já apagou: a tela mostraria queda onde houve
    // apagamento.
    renderWithIntl(<ProductMetricsClient />);

    expect(screen.queryByRole('button', { name: '365 dias' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 dias' })).toBeInTheDocument();
  });

  it('traduz o rótulo da categoria, e não mostra o enum', () => {
    mockQuery(comDados({ categoryViews: [{ category: 'HEALTH', count: 4 }] }));

    renderWithIntl(<ProductMetricsClient />);

    expect(screen.getByText('Saúde')).toBeInTheDocument();
    expect(screen.queryByText('HEALTH')).not.toBeInTheDocument();
  });

  it('lista as buscas que não acharam nada', () => {
    mockQuery(
      comDados({ searchesWithoutResults: [{ query: 'eclipse', count: 2 }] }),
    );

    renderWithIntl(<ProductMetricsClient />);

    expect(screen.getByText('eclipse')).toBeInTheDocument();
  });

  it('mostra o esqueleto enquanto não há dado', () => {
    mockQuery(undefined);

    renderWithIntl(<ProductMetricsClient />);

    expect(screen.queryByText('Assinantes')).not.toBeInTheDocument();
  });

  it('avisa em vez de mostrar zero quando a consulta falha', () => {
    // Zero e "não deu" são coisas diferentes, e a tela não pode confundi-las —
    // é a mesma regra do `prefetch` que falha em `undefined`.
    mockQuery(undefined, { isError: true });

    renderWithIntl(<ProductMetricsClient />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as métricas de produto.',
    );
  });
});
