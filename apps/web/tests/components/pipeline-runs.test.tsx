import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PipelineRunSummary } from '@newranews/types';
import { PipelineRuns } from '@/components/admin/pipeline-runs';
import { renderWithIntl } from '@/tests/utils';

/**
 * **Fase 2 — os três painéis do pipeline na `/admin`.**
 *
 * O que estas asserções guardam não é layout: é a leitura. A tela existe para
 * responder "o run de ontem falhou, em que etapa, o que o erro dizia, e ele
 * falha há três dias?" — cada uma dessas quatro tem um teste aqui, e a
 * penúltima tem duas, porque a unidade da duração é a armadilha registrada no
 * §17.8 do plano.
 */

const usePipelineRunsMock = vi.fn();
const usePipelineRunDetailMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  usePipelineRuns: () => usePipelineRunsMock(),
  usePipelineRunDetail: (pipelineId: string) =>
    usePipelineRunDetailMock(pipelineId),
}));

const SUCCESS_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FAILED_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

const successRun: PipelineRunSummary = {
  id: SUCCESS_ID,
  status: 'SUCCESS',
  newsCount: 377,
  articleId: 'cccccccc-0000-0000-0000-000000000003',
  error: null,
  errorStage: null,
  errorDetail: null,
  startedAt: '2026-09-06T11:00:00.000Z',
  completedAt: '2026-09-06T11:00:45.000Z',
  durationSeconds: 45,
  eventCount: 19,
  outcome: 'SUCCESS',
  degradedBy: [],
};

const failedRun: PipelineRunSummary = {
  ...successRun,
  id: FAILED_ID,
  status: 'FAILED',
  error: 'Gemini API error 503: UNAVAILABLE',
  errorStage: 6,
  // A forma real que o `extractErrorDetail` grava: mensagem, provider e
  // status. O fixture anterior tinha só a mensagem, e foi por isso que a
  // primeira versão da asserção de origem não achou nada.
  errorDetail: {
    message: 'Gemini API error 503: UNAVAILABLE',
    provider: 'gemini',
    statusCode: 503,
  },
  completedAt: null,
  durationSeconds: null,
  outcome: 'FAILED',
  degradedBy: [],
};

// O run que o `status` esconde por construção: briefing gerado, e a
// newsletter e o Gemini falharam pelo caminho.
const degradedRun: PipelineRunSummary = {
  ...successRun,
  id: 'dddddddd-0000-0000-0000-000000000004',
  outcome: 'SUCCESS_DEGRADED',
  degradedBy: [6, 7.5],
};

function mockRuns(
  runs: PipelineRunSummary[],
  recentErrors: PipelineRunSummary[] = [],
  total = runs.length,
) {
  usePipelineRunsMock.mockReturnValue({
    data: { data: { runs, recentErrors }, meta: { total } },
    isError: false,
  });
}

function mockDetail(events: unknown[]) {
  usePipelineRunDetailMock.mockReturnValue({
    data: { log: failedRun, events },
    isError: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  usePipelineRunDetailMock.mockReturnValue({ data: undefined, isError: false });
});

describe('PipelineRuns — o último run', () => {
  it('shows status, failing stage and the collected count', () => {
    mockRuns([successRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getAllByText('Sucesso').length).toBeGreaterThan(0);
    expect(screen.getByText('Etapa da falha')).toBeInTheDocument();
    // Run bem-sucedido não tem etapa de falha: imprimir "9" ali leria como se
    // ele tivesse parado na última etapa.
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('377')).toBeInTheDocument();
  });

  it('reads durationSeconds as seconds — the §17.8 trap', () => {
    // `formatPipelineDuration` recebe **milissegundos** e `durationSeconds` é
    // segundo: passar um pelo outro renderiza "45 ms" para um run de 45 s, sem
    // erro de tipo e sem aviso. Esta asserção é a única coisa que separa os dois.
    mockRuns([successRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getAllByText('45s').length).toBeGreaterThan(0);
    expect(screen.queryByText('45ms')).not.toBeInTheDocument();
    expect(screen.queryByText('0s')).not.toBeInTheDocument();
  });

  it('shows the error message of a failed run', () => {
    mockRuns([failedRun]);
    renderWithIntl(<PipelineRuns />);

    expect(
      screen.getByText('Gemini API error 503: UNAVAILABLE'),
    ).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('shows where the failure came from, out of errorDetail', () => {
    // `errorDetail` atravessava a rede e a tela o jogava fora — e é ele que
    // responde a pergunta seguinte de quem lê "Gemini API error 503": qual
    // provider, e que status HTTP. Campo carregado e não exibido é a versão
    // desta tela do defeito que o `response-schema-contract` existe para pegar.
    mockRuns([failedRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText('Origem: Gemini · HTTP 503')).toBeInTheDocument();
  });

  it('says nothing about origin when errorDetail carries neither field', () => {
    // `errorDetail` é coluna `Json`: o que vem dentro não tem tipo, e uma linha
    // "Origem: " vazia seria pior que nenhuma.
    mockRuns([{ ...failedRun, errorDetail: { message: 'boom' } }]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.queryByText(/Origem:/)).not.toBeInTheDocument();
  });

  it('does not mark the recorded error as a live alert', () => {
    /**
     * `role='alert'` interrompe o leitor de tela para anunciar a região. A
     * mensagem de um run é **conteúdo**, presente na primeira renderização —
     * não um estado que acabou de mudar. Os `alert` legítimos deste componente
     * são os de falha de carregamento, e nenhum deles aparece aqui.
     */
    mockRuns([failedRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the empty state when no run was ever recorded', () => {
    mockRuns([], [], 0);
    renderWithIntl(<PipelineRuns />);

    expect(
      screen.getByText('Nenhuma execução registrada ainda.'),
    ).toBeInTheDocument();
  });

  it('renders the failure state without touching the list', () => {
    usePipelineRunsMock.mockReturnValue({ data: undefined, isError: true });
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as execuções do pipeline.',
    );
  });
});

describe('PipelineRuns — "ele falha há três dias?"', () => {
  it('announces recent failures even when the latest run succeeded', () => {
    // `recentErrors` não é um recorte de `runs`: é o mesmo filtro com
    // `status: FAILED`. Sem este aviso, uma falha de anteontem fica invisível
    // atrás de um run verde — e essa é justamente a pergunta que a fase abriu
    // para responder.
    mockRuns([successRun], [failedRun], 2);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText(/Outra execução recente falhou/)).toBeInTheDocument();
  });

  it('does not repeat, as a warning, the failure the cards already show', () => {
    // `recentErrors` inclui o último run quando ele falhou. Sem filtrar, a tela
    // empilhava **duas caixas vermelhas sobre o mesmo run** — a mensagem do
    // erro e, logo abaixo, um aviso com a mesma hora dizendo que uma execução
    // falhou. Só aparece olhando a tela com dado de verdade, que é a classe de
    // defeito que a Fase 12 inteira foi caçar.
    mockRuns([failedRun], [failedRun], 1);
    renderWithIntl(<PipelineRuns />);

    expect(
      screen.getByText('Gemini API error 503: UNAVAILABLE'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/recente falhou|recentes falharam/)).not.toBeInTheDocument();
  });

  it('counts only the failures the cards are not already showing', () => {
    const older = { ...failedRun, id: 'dddddddd-0000-0000-0000-000000000009' };
    mockRuns([failedRun], [failedRun, older], 2);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText(/Outra execução recente falhou/)).toBeInTheDocument();
  });

  it('says nothing when no recent run failed', () => {
    mockRuns([successRun], [], 1);
    renderWithIntl(<PipelineRuns />);

    expect(screen.queryByText(/recente falhou|recentes falharam/)).not.toBeInTheDocument();
  });
});

describe('PipelineRuns — a lista e o detalhe', () => {
  it('lists the runs with a status pill and the recorded total', () => {
    mockRuns([successRun, failedRun], [failedRun], 31);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText('Últimas execuções')).toBeInTheDocument();
    expect(screen.getAllByText('Falhou').length).toBeGreaterThan(0);
    // O total é o do recorte, não o tamanho da lista que o `limit` cortou.
    expect(screen.getByText('31 execuções no total')).toBeInTheDocument();
  });

  it('says "sem eventos" for a run that recorded none — 0 is not "1 evento"', () => {
    /**
     * **A regra de plural do pt-BR faz `0` cair na categoria `one`.** No CLDR,
     * `one` em português cobre `i = 0..1`, então `{count, plural, one {# evento}
     * other {# eventos}}` renderiza **"0 evento"** — tecnicamente correto pela
     * regra, e errado para quem lê. Só apareceu ao abrir a tela: o run de
     * 16/08 01:39 morreu antes de emitir evento nenhum, e a suíte só tinha
     * fixture com 19.
     *
     * A saída é o caso explícito `=0`, que vence a categoria — e o inglês ganha
     * o mesmo por simetria, ainda que lá o `0` já caísse em `other`.
     */
    mockRuns([{ ...successRun, eventCount: 0 }]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByRole('button', { name: /sem eventos/ })).toBeInTheDocument();
    expect(screen.queryByText(/0 evento/)).not.toBeInTheDocument();
  });

  it('does not ask for any run detail until a row is expanded', () => {
    // A lista mostra 20 linhas; carregar o diário das 20 seriam 20 requisições
    // para ler uma.
    mockRuns([successRun, failedRun]);
    renderWithIntl(<PipelineRuns />);

    // Nem com `enabled: false`: o hook **não é chamado**, porque a linha
    // expandida só é montada depois do clique.
    expect(usePipelineRunDetailMock).not.toHaveBeenCalled();
  });

  it('loads the events of the row that was opened, grouped by stage', async () => {
    mockRuns([failedRun]);
    mockDetail([
      {
        id: 'e1',
        stage: 1,
        level: 'INFO',
        message: 'fetched 377 items from 45 sources',
        context: null,
        createdAt: '2026-09-06T11:00:06.607Z',
      },
      {
        id: 'e2',
        stage: 6,
        level: 'ERROR',
        message: 'Gemini API error 503: UNAVAILABLE',
        context: { provider: 'gemini' },
        // 707 ms depois do anterior: é a distância real entre as etapas de um
        // run que falha rápido, e é ela que o formato precisa conseguir mostrar.
        createdAt: '2026-09-06T11:00:07.314Z',
      },
    ]);
    renderWithIntl(<PipelineRuns />);

    const toggle = screen.getByRole('button', { name: /19 eventos/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(usePipelineRunDetailMock).toHaveBeenCalledWith(FAILED_ID);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Etapa 1')).toBeInTheDocument();
    expect(screen.getByText('Etapa 6')).toBeInTheDocument();
    expect(
      screen.getByText('fetched 377 items from 45 sources'),
    ).toBeInTheDocument();
    // O `context` fica atrás de um `<details>`: é diagnóstico, e aberto por
    // padrão empurraria a mensagem — que é o que se lê — para fora da tela.
    expect(screen.getByText('Contexto')).toBeInTheDocument();
  });

  it('times each event to the second, and drops the repeated date', async () => {
    /**
     * **`formatDateTime` para no minuto, e um run acontece em segundos.** As
     * cinco etapas do run local de 16/08 caíram dentro de 706 ms, então a
     * coluna imprimia cinco vezes "16 de ago. de 2026, 08:00" — strings
     * idênticas, ocupando espaço em toda linha, debaixo de um cabeçalho que já
     * dizia a mesma data e a mesma hora. Só apareceu abrindo a tela.
     */
    mockRuns([failedRun]);
    mockDetail([
      {
        id: 'e1',
        stage: 1,
        level: 'INFO',
        message: 'primeiro',
        context: null,
        createdAt: '2026-09-06T11:00:06.607Z',
      },
      {
        id: 'e2',
        stage: 6,
        level: 'ERROR',
        message: 'último',
        context: null,
        createdAt: '2026-09-06T11:00:07.314Z',
      },
    ]);
    const { container } = renderWithIntl(<PipelineRuns />);

    await userEvent.click(screen.getByRole('button', { name: /19 eventos/ }));

    const region = container.querySelector(`#pipeline-run-${FAILED_ID}`);
    expect(region).not.toBeNull();
    const detail = within(region as HTMLElement);

    // Os dois segundos distintos aparecem; sem eles, as duas linhas seriam a
    // mesma string e a coluna não diria nada.
    expect(detail.getByText(/:06$/)).toBeInTheDocument();
    expect(detail.getByText(/:07$/)).toBeInTheDocument();
    // E **dentro do detalhe** a data não se repete linha a linha — ela já está
    // no cabeçalho da linha, logo acima, e nos cartões do topo.
    expect(detail.queryAllByText(/de set\. de 2026/)).toHaveLength(0);
  });

  it('closes the row that was open, and stops asking for its detail', async () => {
    mockRuns([failedRun]);
    mockDetail([]);
    renderWithIntl(<PipelineRuns />);

    const toggle = screen.getByRole('button', { name: /19 eventos/ });
    await userEvent.click(toggle);
    expect(
      screen.getByText('Esta execução não registrou nenhum evento.'),
    ).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText('Esta execução não registrou nenhum evento.'),
    ).not.toBeInTheDocument();
  });

  it('reports a detail that failed to load without hiding the row', async () => {
    mockRuns([failedRun]);
    usePipelineRunDetailMock.mockReturnValue({ data: undefined, isError: true });
    renderWithIntl(<PipelineRuns />);

    await userEvent.click(screen.getByRole('button', { name: /19 eventos/ }));

    expect(
      screen.getByText('Não foi possível carregar os eventos desta execução.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Últimas execuções')).toBeInTheDocument();
  });
});

/**
 * **Fase 8 — o desfecho com mais de dois valores, e o dia que não rodou.**
 *
 * `SUCCESS` é binário e o pipeline não é: um run pode ter seis coisas erradas e
 * reportar sucesso. O que esta tela ganha é o `SUCCESS_DEGRADED` com a etapa
 * que engoliu a falha, a faixa de 30 dias com o `NEVER_RAN` vazado, e o
 * batimento positivo — "último briefing há N h". §12 do plano.
 */
describe('PipelineRuns — o desfecho (Fase 8)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-06T15:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls a degraded run by its name, in the cards and in the row', () => {
    mockRuns([degradedRun]);
    renderWithIntl(<PipelineRuns />);

    // No cartão de status e na pílula da linha (a legenda da faixa também o
    // nomeia): nenhum "Sucesso" seco sobre um run que saiu pelo Groq com a
    // newsletter falhada — o único "Sucesso" da tela é o da legenda.
    expect(screen.getAllByText('Sucesso degradado').length).toBeGreaterThanOrEqual(3);
    const status = screen.getByText('Status').parentElement as HTMLElement;
    expect(within(status).getByText('Sucesso degradado')).toBeInTheDocument();
    expect(screen.getAllByText(/^Sucesso$/)).toHaveLength(1);
  });

  it('says which stages swallowed their failure', () => {
    // `degradedBy` é o que faz o desfecho ser acionável em vez de decorativo.
    mockRuns([degradedRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText('Degradado pelas etapas 6 e 7.5')).toBeInTheDocument();
  });

  it('uses the singular for a single stage', () => {
    mockRuns([{ ...degradedRun, degradedBy: [8.5] }]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText('Degradado pela etapa 8.5')).toBeInTheDocument();
  });

  it('does not mention degradation on a clean run', () => {
    mockRuns([successRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.queryByText(/Degradado/)).not.toBeInTheDocument();
  });

  it('draws one square per day of the window, and the day without a run as NEVER_RAN', () => {
    mockRuns([successRun, failedRun]);
    renderWithIntl(<PipelineRuns />);

    const strip = screen.getByRole('list', { name: 'Desfecho do pipeline por dia, últimos 30 dias' });
    const squares = within(strip).getAllByRole('listitem');
    expect(squares).toHaveLength(30);

    // Hoje (06/09) tem o run de 11:00; o dia anterior não tem nada — e "não
    // rodou" não é "falhou".
    expect(within(strip).getByText('06 de set.: Sucesso')).toBeInTheDocument();
    expect(within(strip).getByText('05 de set.: Não rodou')).toBeInTheDocument();
    expect(within(strip).queryByText('05 de set.: Falhou')).not.toBeInTheDocument();
  });

  it('names the degrading stages inside the square of a degraded day', () => {
    mockRuns([degradedRun]);
    renderWithIntl(<PipelineRuns />);

    const strip = screen.getByRole('list', { name: /Desfecho do pipeline por dia/ });
    expect(
      within(strip).getByText('06 de set.: Sucesso degradado — Degradado pelas etapas 6 e 7.5'),
    ).toBeInTheDocument();
  });

  it('tells how long ago the last briefing came out', () => {
    // 11:00:45 → 15:00 são 3 h 59 min. É o "batimento positivo" do §12: a
    // ausência de run vira observável antes de qualquer gráfico.
    mockRuns([successRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText('Último briefing há 3 h 59 min')).toBeInTheDocument();
  });

  it('measures the age from the last run that produced a briefing, not from the last run', () => {
    // O último run falhou às 11:00 de hoje; o último **briefing** é o de ontem.
    const yesterday = {
      ...successRun,
      id: 'eeeeeeee-0000-0000-0000-000000000005',
      startedAt: '2026-09-05T11:00:00.000Z',
      completedAt: '2026-09-05T11:00:45.000Z',
    };
    const failedToday = { ...failedRun, startedAt: '2026-09-06T11:00:00.000Z' };
    mockRuns([failedToday, yesterday], [failedToday], 2);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText('Último briefing há 27 h 59 min, atrasado')).toBeInTheDocument();
  });

  it('says so when no briefing came out in the window', () => {
    mockRuns([failedRun], [failedRun], 1);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText('Nenhum briefing nos últimos 30 dias.')).toBeInTheDocument();
  });

  it('keeps the visible list at 20 rows while the strip reads the whole window', () => {
    // A listagem pede a janela inteira (até 100 runs) para a faixa; a lista
    // continua mostrando as 20 últimas, e o total é o do recorte.
    const runs = Array.from({ length: 25 }, (_, index) => ({
      ...successRun,
      id: `aaaaaaaa-0000-0000-0000-0000000000${String(index).padStart(2, '0')}`,
      startedAt: new Date(Date.UTC(2026, 8, 6 - index, 11)).toISOString(),
      completedAt: new Date(Date.UTC(2026, 8, 6 - index, 11, 0, 45)).toISOString(),
    }));
    mockRuns(runs, [], 25);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getAllByRole('button', { name: /19 eventos/ })).toHaveLength(20);
    expect(screen.getByText('25 execuções no total')).toBeInTheDocument();
  });
});
