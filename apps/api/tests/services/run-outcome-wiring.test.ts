import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * **A fiação do `degradedBy` — pós-merge da Fase 8.**
 *
 * O pipeline monta `degradedBy` enquanto corre e a API o deriva dos eventos
 * gravados; `pipeline.test.ts` cobra que as duas contas batam **nos cenários
 * que ele exercita**. Esta guarda pergunta a outra coisa, sobre a estrutura:
 * **todo `WARN` que uma etapa emite dentro do run tem o `degradedBy.push` da
 * mesma etapa no mesmo bloco.** É a armadilha 28 do plano — guarda sobre a
 * função sem guarda sobre a fiação —, e o caso que ela pega é o de uma etapa
 * nova (a 5.5 e a 6.5 da Fase 9 chegam com `WARN` próprio) que escreva o
 * aviso e esqueça o `push`: a listagem diria degradado e o resumo não.
 *
 * Pelo parser, não por regex (§17.27): a pergunta é sobre blocos, que é
 * gramática.
 */

const PIPELINE_SOURCE = path.resolve(__dirname, '../../src/services/pipeline.service.ts');

interface WarnCall {
  /** O texto do argumento de etapa: `7.5`, ou `currentStage`. */
  stageText: string;
  /** Os `degradedBy.push(...)` do mesmo bloco, pelo texto do argumento. */
  pushesInBlock: string[];
  line: number;
}

function collectWarnCalls(): WarnCall[] {
  const source = ts.createSourceFile(
    PIPELINE_SOURCE,
    readFileSync(PIPELINE_SOURCE, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const calls: WarnCall[] = [];

  const enclosingBlock = (node: ts.Node): ts.Block | undefined => {
    let current: ts.Node | undefined = node.parent;
    while (current && !ts.isBlock(current)) current = current.parent;
    return current;
  };

  const pushesOf = (block: ts.Block): string[] => {
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText() === 'degradedBy' &&
        node.expression.name.text === 'push'
      ) {
        found.push(node.arguments[0]?.getText() ?? '');
      }
      // Só o bloco imediato: um `push` dentro de um bloco aninhado é de
      // outra etapa (ou de outro `try`), e não conta para esta.
      if (!ts.isBlock(node) || node === block) ts.forEachChild(node, visit);
    };
    visit(block);
    return found;
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'logPipelineEvent'
    ) {
      const level = node.arguments[2];
      if (level && ts.isStringLiteral(level) && level.text === 'WARN') {
        const block = enclosingBlock(node);
        calls.push({
          stageText: node.arguments[1]?.getText() ?? '',
          pushesInBlock: block ? pushesOf(block) : [],
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return calls;
}

describe('todo WARN de etapa dentro do run entra em `degradedBy`', () => {
  const calls = collectWarnCalls();

  it('finds the WARN emissions at all — a parser that finds nothing would pass everything', () => {
    // Doze dentro do run (1, 4, 5.5, 6, duas da 6.5, 7.5, 8, 8.5, 9 e duas da
    // 9.5 — a Fase 11 pôs a 4, a Fase 6 as duas da 9.5, e a Fase 9 a 5.5 e
    // as duas da 6.5) e uma no `catch`.
    expect(calls.length).toBeGreaterThanOrEqual(13);
  });

  it('sees the two gate stages of Phase 9 — the case this guard was written for', () => {
    const stages = calls.map((call) => call.stageText);
    expect(stages).toContain('5.5');
    expect(stages).toContain('6.5');
  });

  it.each(calls.map((call) => [call.stageText, call.line, call] as const))(
    'stage %s (line %s) pushes the same stage in its block',
    (stageText, _line, call) => {
      // A exceção, e o motivo: o `WARN` do `catch` final escreve o erro
      // primário de um run que vai sair `FAILED` — não há resumo da etapa 9
      // para carregar `degradedBy`, e a etapa é uma variável, não um literal
      // (`primaryStage` desde a Fase 9: a do portão de saída quando foi ele
      // que bloqueou o primário, 6 no resto). **Nomeada, e não "qualquer
      // variável"**: um `WARN` dentro do run com etapa em variável seria uma
      // forma nova, e tem de reprovar aqui até alguém escrever o motivo.
      if (stageText === 'primaryStage') return;

      // A etapa 1 empurra sob condição (`if (degrading > 0) degradedBy.push(1)`,
      // sem chaves): o `if` não abre bloco, então o `push` continua sendo do
      // mesmo bloco que o `logPipelineEvent` — e é assim que tem de ficar. Um
      // `if` com chaves ali reprovaria aqui, e o motivo estaria escrito.
      expect(call.pushesInBlock).toContain(stageText);
    },
  );
});
