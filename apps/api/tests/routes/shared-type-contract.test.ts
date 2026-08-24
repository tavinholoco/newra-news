import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * **Rota com resposta ⇒ contrato declarado.** A guarda que a §11.1 pediu.
 *
 * `packages/types` é a fonte única do contrato, mas até esta fase nada ligava
 * os dois lados: a API validava com Zod, o web consumia o tipo TypeScript, e
 * **uma rota só** — `POST /api/events` — tinha uma guarda de compilação
 * comparando os dois. Todas as outras podiam derivar em silêncio, e uma delas
 * derivou: na Fase 5 o `articleItemSchema` era o da V1 enquanto o serviço já
 * carregava auditoria e fontes, e o serializador do
 * `fastify-type-provider-zod` descartou os campos sem erro nenhum.
 *
 * A guarda de compilação mora ao lado de cada schema (`assertContract`, em
 * `src/utils/contract.ts`). O que **esta** suíte acrescenta é a exaustividade:
 * ela enumera as respostas que o roteador declara e exige, para cada uma, ou a
 * asserção, ou uma linha nesta lista com o motivo. Sem isso, a rota seguinte
 * nasce sem contrato e ninguém percebe — que é a diferença entre uma convenção
 * e uma guarda.
 *
 * É o mesmo formato de `api-docs-drift`, `response-schema-contract` e
 * `authorization-matrix`: enumerar a superfície e exigir decisão por item.
 */

const ROUTES_DIR = join(__dirname, '../../src/routes');
const SRC_DIR = join(__dirname, '../../src');

/**
 * Respostas sem tipo compartilhado, e por quê.
 *
 * Duas famílias, e nenhuma delas é "ainda não fizemos":
 *
 * - **o que só operador lê** (`curl`, painel dev, disparo de job): não há tela,
 *   não há `fetch` do web e não há tipo em `packages/types` a proteger.
 *   Inventar um seria escrever contrato para um consumidor que não existe — a
 *   armadilha da tabela sem leitor, em outra forma;
 * - **os dois booleanos de confirmação**: `{ removed }` e `{ unsubscribed }`.
 *   O web os declara inline em `lib/api.ts`, e um tipo exportado por booleano
 *   custaria mais do que protege.
 *
 * `weeklyMetricsResponseSchema` merece nota: ele **está** coberto, de graça —
 * o mesmo `weeklyMetricsSchema` é reusado dentro de `dashboardMetricsSchema`,
 * que é o que a tela de admin lê e que tem asserção própria. A entrada aqui é
 * sobre a rota `/api/metrics/weekly`, que nenhuma tela chama.
 */
const WITHOUT_SHARED_TYPE: Record<string, string> = {
  removeFavoriteResponseSchema: 'booleano de confirmação, declarado inline no web',
  unsubscribeResponseSchema: 'booleano de confirmação, declarado inline no web',
  sendNewsletterResponseSchema: 'disparo de job, sem consumidor no web',
  jobTriggerResponseSchema: 'disparo de job, sem consumidor no web',
  renormalizeResponseSchema: 'disparo de job, sem consumidor no web',
  pipelineStatusResponseSchema: 'status de job, lido por operador',
  devLogsResponseSchema: 'painel dev, fora do produto',
  devLogDetailResponseSchema: 'painel dev, fora do produto',
  healthResponseSchema: 'sonda de plataforma (Render), sem consumidor no web',
  providersHealthResponseSchema: 'sonda de operador, sem consumidor no web',
  httpMetricsResponseSchema: 'observabilidade lida por operador, sem tela',
  weeklyMetricsResponseSchema: 'rota sem tela; o mesmo schema é coberto dentro do dashboard',
  monthlyMetricsResponseSchema: 'rota sem tela, sem tipo compartilhado equivalente',
};

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? collectFiles(full)
      : full.endsWith('.ts')
        ? [full]
        : [];
  });
}

/**
 * Fora comentário, antes de qualquer regex.
 *
 * **Uma asserção comentada continuava contando.** Ao verificar esta guarda
 * reprovando — trocando `assertContract<typeof homeResponseSchema` por
 * `// assertContract<...>` —, ela passou verde: o regex lia o comentário como
 * declaração. É o mesmo defeito que fez a primeira versão casar um `201` dentro
 * de prosa, pela outra ponta, e é o tipo de coisa que só aparece quando se
 * insiste em ver a guarda falhar.
 *
 * O corte é grosseiro de propósito (`//` até o fim da linha, `/* … *\/` inteiro):
 * ele pode comer o miolo de uma string com `//`, e nenhuma das duas buscas
 * abaixo procura dentro de string.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * O corpo do `response: { ... }`, com as chaves balanceadas.
 *
 * Recortar o bloco antes de procurar o status é o que separa declaração de
 * prosa: a primeira versão desta guarda varria o arquivo inteiro e casou
 * `// 201 e não 200: a requisição criou linhas`, num comentário. Guarda que lê
 * comentário como código acusa o que não existe — e, no dia em que o comentário
 * mudar, deixa de acusar sem que nada tenha mudado no roteador.
 */
function responseBlocks(source: string): string[] {
  const blocks: string[] = [];

  for (const match of source.matchAll(/\bresponse\s*:\s*\{/g)) {
    let depth = 1;
    let index = (match.index ?? 0) + match[0].length;
    const start = index;

    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      index += 1;
    }

    blocks.push(source.slice(start, index - 1));
  }

  return blocks;
}

/**
 * Os schemas que o roteador declara como resposta de sucesso.
 *
 * Lê os arquivos de rota e não os `export const` dos `schemas.ts`: o que
 * importa é o que **sai pela rede**, não o que foi escrito e pode nunca ter
 * sido usado.
 */
function collectSuccessResponseSchemas(): string[] {
  const names = collectFiles(ROUTES_DIR)
    .filter((file) => !file.endsWith('schemas.ts'))
    .flatMap((file) => responseBlocks(stripComments(readFileSync(file, 'utf8'))))
    .flatMap((block) =>
      [...block.matchAll(/\b(?:200|201|204)\s*:\s*([A-Za-z_$][\w$]*)/g)].map(
        (match) => match[1] as string,
      ),
    );

  return [...new Set(names)].sort();
}

/** Onde as asserções vivem: ao lado do schema, em `src/`. */
function collectAssertedSchemas(): string[] {
  const names = collectFiles(SRC_DIR).flatMap((file) => {
    const source = stripComments(readFileSync(file, 'utf8'));
    return [
      ...source.matchAll(/assertContract<\s*typeof\s+([A-Za-z_$][\w$]*)/g),
    ].map((match) => match[1] as string);
  });

  return [...new Set(names)].sort();
}

describe('contrato de tipos entre a API e packages/types', () => {
  it('declares a shared-type contract for every success response', () => {
    const asserted = new Set(collectAssertedSchemas());

    const undeclared = collectSuccessResponseSchemas().filter(
      (schema) => !asserted.has(schema) && !(schema in WITHOUT_SHARED_TYPE),
    );

    expect(undeclared).toEqual([]);
  });

  it('does not carry an exception for a response that no longer exists', () => {
    // Exceção órfã é pior que exceção: ela sugere que alguém decidiu algo sobre
    // uma rota que já saiu, e a lista deixa de descrever a superfície real.
    const declared = new Set(collectSuccessResponseSchemas());
    const stale = Object.keys(WITHOUT_SHARED_TYPE).filter(
      (schema) => !declared.has(schema),
    );

    expect(stale).toEqual([]);
  });

  it('does not carry an exception for a response that is asserted anyway', () => {
    const asserted = new Set(collectAssertedSchemas());
    const redundant = Object.keys(WITHOUT_SHARED_TYPE).filter((schema) =>
      asserted.has(schema),
    );

    expect(redundant).toEqual([]);
  });

  it('keeps the bridge between the two Category enums in a single place', () => {
    // O `Category` do Prisma e o de `packages/types` têm exatamente os mesmos
    // membros e são enums **nominalmente distintos** para o TypeScript: o
    // primeiro é união de literais, o segundo é `enum`. Atravessar de um para o
    // outro exige um cast, e cast espalhado é como uma conversão errada entra
    // sem ninguém ver. A §11.1 pergunta se a ponte continua num lugar só; esta
    // asserção responde a cada PR.
    const bridges = collectFiles(SRC_DIR).filter((file) => {
      const source = stripComments(readFileSync(file, 'utf8'));
      const importsSharedCategory =
        /import\s+(?:type\s+)?\{[^}]*\bCategory\b[^}]*\}\s*from\s*'@newranews\/types'/.test(
          source,
        );
      return importsSharedCategory && /\bas\s+Category\b/.test(source);
    });

    expect(bridges.map((file) => file.replace(/\\/g, '/').split('/src/')[1])).toEqual([
      'services/editorial.mapper.ts',
    ]);
  });

  it('finds schemas at all — a parser that returns nothing would pass everything', () => {
    // A asserção que segura as três de cima. Sem ela, um regex quebrado numa
    // refatoração de nomenclatura faria a guarda passar para sempre, vazia.
    const declared = collectSuccessResponseSchemas();
    const asserted = collectAssertedSchemas();

    expect(declared.length).toBeGreaterThan(25);
    expect(declared).toContain('listNewsResponseSchema');
    expect(declared).toContain('getArticleResponseSchema');
    expect(asserted.length).toBeGreaterThan(15);
    expect(asserted).toContain('homeResponseSchema');
  });
});
