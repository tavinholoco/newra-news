import { describe, it, expect } from 'vitest';
import {
  degradedStages,
  deriveRunOutcome,
  isDegradingFetchWarning,
  type OutcomeEvent,
} from '../../src/services/run-outcome';

/**
 * **Fase 8 — a tabela do desfecho, incluindo os casos que hoje somem.**
 *
 * `PipelineLog.status` é binário e o pipeline não é: cinco etapas engolem a
 * própria falha de propósito (7.5, 8, 8.5, 9 e 9.5), o fallback para o Groq é
 * um `WARN` da etapa 6, a colheita degradada é um `WARN` da etapa 1, a saúde
 * por fonte é um `WARN` da 4, e os avisos dos portões (Fase 9) são `WARN` da
 * 5.5 e da 6.5. Um run pode ter dez coisas erradas e reportar `SUCCESS`. O desfecho é **função pura**
 * sobre o run e seus eventos — sem coluna nova, sem migration (§17.19) —, e é
 * por isso que cabe no `turbo test`, sem banco.
 */

const warn = (stage: number, context: Record<string, unknown> | null = null): OutcomeEvent => ({
  stage,
  level: 'WARN',
  context,
});
const info = (stage: number): OutcomeEvent => ({ stage, level: 'INFO', context: null });
const error = (stage: number): OutcomeEvent => ({ stage, level: 'ERROR', context: null });

const cleanRun = [info(1), info(3), info(4), info(5), info(6), info(7), info(7.5), info(8), info(8.5), info(9)];

describe('deriveRunOutcome — a tabela', () => {
  it('SUCCESS: briefing gerado, nenhum WARN que conte, provider primário', () => {
    expect(deriveRunOutcome({ status: 'SUCCESS' }, cleanRun)).toBe('SUCCESS');
  });

  it('SUCCESS_DEGRADED: briefing gerado, newsletter falhada — e não SUCCESS', () => {
    // O caso que o `status` esconde por construção: a 7.5 é não-crítica, o run
    // segue `SUCCESS`, e ninguém fica sabendo que ninguém recebeu o e-mail.
    const events = [...cleanRun, warn(7.5, { message: 'Newsletter failed (non-critical)' })];

    expect(deriveRunOutcome({ status: 'SUCCESS' }, events)).toBe('SUCCESS_DEGRADED');
  });

  it('SUCCESS_DEGRADED: o Gemini caiu e o Groq entregou', () => {
    // O gatilho do `CLAUDE.md` — três dias seguidos de fallback — é este valor
    // repetido três vezes com o mesmo `degradedBy`.
    const events = [
      ...cleanRun,
      warn(6, { message: 'Gemini API error 503', fallbackProvider: 'groq', provider: 'gemini' }),
    ];

    expect(deriveRunOutcome({ status: 'SUCCESS' }, events)).toBe('SUCCESS_DEGRADED');
    expect(degradedStages(events)).toEqual([6]);
  });

  it.each([8, 8.5, 9])('SUCCESS_DEGRADED: a etapa %s falhou sozinha', (stage) => {
    expect(deriveRunOutcome({ status: 'SUCCESS' }, [...cleanRun, warn(stage)])).toBe(
      'SUCCESS_DEGRADED',
    );
  });

  it('FAILED: sem briefing, qualquer que seja o resto', () => {
    expect(deriveRunOutcome({ status: 'FAILED' }, [info(1), error(6)])).toBe('FAILED');
    // Mesmo sem evento nenhum — o run morto que a idempotência enterra escreve
    // `FAILED` e um `ERROR` na etapa 0, mas o `status` já basta.
    expect(deriveRunOutcome({ status: 'FAILED' }, [])).toBe('FAILED');
  });

  it('null enquanto está RUNNING: não há desfecho para contar', () => {
    // Não é `SUCCESS` nem `FAILED` — e não é `NEVER_RAN`, que é ausência de
    // run num dia, derivada do calendário, do lado de quem desenha a faixa.
    expect(deriveRunOutcome({ status: 'RUNNING' }, [info(1), info(3)])).toBeNull();
  });
});

/**
 * **O achado do inventário de 15/09: "zero `WARN`" marcaria como degradado
 * todo dia em que um feed publicou nada.** O `WARN` da etapa 1 dispara para
 * qualquer aviso, e `feed-empty` está entre eles — a classe "publicou devagar"
 * que o item 46 tirou de `pipelineErrors` de propósito (fim de semana de um
 * feed de saúde é `feed-empty`). Sem esta linha, `SUCCESS_DEGRADED` vira o
 * estado normal e deixa de informar.
 */
describe('deriveRunOutcome — a colheita degradada é lida pelos avisos, não pelo nível', () => {
  it('SUCCESS quando os avisos da etapa 1 são só feeds vazios', () => {
    const events = [
      ...cleanRun,
      warn(1, {
        warnings: [
          { kind: 'feed-empty', source: 'Veja Saúde' },
          { kind: 'feed-empty', source: 'Drauzio Varella' },
        ],
      }),
    ];

    expect(deriveRunOutcome({ status: 'SUCCESS' }, events)).toBe('SUCCESS');
    expect(degradedStages(events)).toEqual([]);
  });

  it.each(['provider-failed', 'provider-empty', 'feed-failed'])(
    'SUCCESS_DEGRADED quando há um `%s` entre os avisos',
    (kind) => {
      // A mesma linha que `pipelineErrors` traça na etapa 1: só `feed-empty`
      // fica de fora. Um feed em `ETIMEDOUT` é `feed-failed`, e conta.
      const events = [
        ...cleanRun,
        warn(1, {
          warnings: [
            { kind: 'feed-empty', source: 'Veja Saúde' },
            { kind, source: 'Superinteressante', detail: 'ETIMEDOUT' },
          ],
        }),
      ];

      expect(deriveRunOutcome({ status: 'SUCCESS' }, events)).toBe('SUCCESS_DEGRADED');
      expect(degradedStages(events)).toEqual([1]);
    },
  );

  it('um aviso sem `kind` legível conta — o que não se sabe classificar não é benigno', () => {
    const events = [...cleanRun, warn(1, { warnings: [{ source: 'x' }] })];

    expect(degradedStages(events)).toEqual([1]);
  });

  it('um `WARN` com lista de avisos vazia não conta', () => {
    expect(degradedStages([...cleanRun, warn(1, { warnings: [] })])).toEqual([]);
  });

  it('isDegradingFetchWarning é a linha, e é uma só', () => {
    expect(isDegradingFetchWarning({ kind: 'feed-empty' })).toBe(false);
    expect(isDegradingFetchWarning({ kind: 'feed-failed' })).toBe(true);
    expect(isDegradingFetchWarning({ kind: 'provider-failed' })).toBe(true);
    expect(isDegradingFetchWarning({ kind: 'provider-empty' })).toBe(true);
  });
});

describe('degradedStages — o campo que torna o desfecho acionável', () => {
  it('lista cada etapa uma vez, em ordem, qualquer que seja a ordem dos eventos', () => {
    const events = [warn(8.5), warn(6), warn(8.5), warn(7.5), info(9)];

    expect(degradedStages(events)).toEqual([6, 7.5, 8.5]);
  });

  it('ignora `INFO` e `ERROR`: só o WARN é a falha engolida', () => {
    // O `ERROR` já é o `FAILED`; o enterro do run morto grava um na etapa 0 e
    // ele não é "degradação", é a morte do run.
    expect(degradedStages([info(1), error(0), error(6)])).toEqual([]);
  });

  it('é preenchido também num run FAILED — a colheita degradada antes da falha continua verdade', () => {
    const events = [
      warn(1, { warnings: [{ kind: 'provider-failed', source: 'newsdata' }] }),
      error(6),
    ];

    expect(deriveRunOutcome({ status: 'FAILED' }, events)).toBe('FAILED');
    expect(degradedStages(events)).toEqual([1]);
  });
});
