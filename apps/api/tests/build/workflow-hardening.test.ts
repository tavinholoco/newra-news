import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * **O CI conferindo a própria configuração** — a mesma família do
 * `env-parity.test.ts`, e pelo mesmo motivo: o arquivo que decide como o código
 * é construído e publicado não passa por revisor nenhum depois que entra.
 *
 * A inspeção que abriu a Fase 10 do plano de observabilidade mediu quatro
 * coisas nos workflows que existiam então, e achou as quatro abertas:
 *
 * | Achado | Estado **antes** desta guarda (05/09/2026) |
 * |---|---|
 * | `permissions:` declarado | um só, o `gitleaks.yml` |
 * | Actions fixadas em SHA | nenhuma — todas em tag movível |
 * | Auditoria de dependência | nenhuma |
 * | SAST | nenhum |
 *
 * (As contagens ficam por extenso e sem o total de propósito: número que
 * descreve uma coleção envelhece em prosa, e o item 41 do `docs/progress.md` é
 * o registro do que isso custou. O total vivo é o que `arquivosDeWorkflow()`
 * devolve.)
 *
 * **Tag é um ponteiro, não um release.** `actions/checkout@v5` é uma referência
 * que o dono da action reescreve quando quer; quem controla a action controla
 * todo job que a usa, retroativamente e sem abrir um PR aqui. Fixar em SHA
 * completo é o único jeito de tratar uma action de terceiro como imutável, e é
 * o que a documentação do GitHub recomenda.
 *
 * **`permissions:` ausente não é neutro.** Sem a linha, o `GITHUB_TOKEN` do job
 * herda o padrão do repositório — que hoje é permissivo — e vai inteiro para
 * dentro de cada action de terceiro que o job executa.
 *
 * **A leitura é estática**, como as outras guardas de `tests/build/`: o `.yml` é
 * lido como texto. Não há parser de YAML nas dependências da API, e trazer um
 * para conferir cinco arquivos seria pagar dependência nova para guardar contra
 * supply chain — o que tem um nome.
 */

const RAIZ = path.resolve(__dirname, '../../../..');
const WORKFLOWS = path.join(RAIZ, '.github/workflows');

/**
 * Fim de linha normalizado.
 *
 * O `.yml` chega com CRLF numa checkout do Windows e com LF no runner do CI.
 * Guarda que casa fim de linha mede o sistema operacional de quem rodou — foi a
 * primeira coisa que o `env-parity.test.ts` reprovou.
 */
function ler(arquivo: string): string {
  return readFileSync(arquivo, 'utf8').split('\r\n').join('\n');
}

function arquivosDeWorkflow(): string[] {
  return readdirSync(WORKFLOWS)
    .filter((nome) => nome.endsWith('.yml') || nome.endsWith('.yaml'))
    .sort();
}

/**
 * As linhas de código de um `.yml`, sem comentário e sem linha em branco.
 *
 * É a armadilha que a Fase 11 pagou quatro vezes, nas duas direções: um `201`
 * dentro de prosa contado como declaração de rota, e um `assertContract`
 * **comentado** contando como asserção presente — a guarda passou verde
 * exatamente sobre o defeito que existe para achar. Aqui o risco é simétrico:
 * este arquivo cita `uses: actions/checkout@v5` no cabeçalho para contar a
 * história, e os `.yml` têm comentários longos em português.
 *
 * O `#` só inicia comentário quando está no começo da linha ou depois de um
 * espaço — `sha256#abc` não é comentário. O corte respeita isso.
 */
function linhasDeCodigo(conteudo: string): { numero: number; texto: string }[] {
  return conteudo
    .split('\n')
    .map((texto, indice) => ({ numero: indice + 1, texto }))
    .map(({ numero, texto }) => {
      const comentario = texto.search(/(?:^|\s)#/);
      return { numero, texto: comentario === -1 ? texto : texto.slice(0, comentario) };
    })
    .filter(({ texto }) => texto.trim().length > 0);
}

describe('workflows: permissões declaradas', () => {
  /**
   * Todo workflow declara `permissions:` na raiz.
   *
   * A checagem é por **coluna zero**: `permissions:` indentado é a chave de um
   * job, e um job com permissão declarada não diz nada sobre os outros. Exigir
   * no topo é a regra que não depende de contar jobs — quem precisar de mais
   * num job específico ainda pode declarar lá, e o topo continua sendo o piso.
   */
  it('todo workflow declara `permissions:` no topo', () => {
    const semPermissoes = arquivosDeWorkflow().filter((nome) => {
      const linhas = linhasDeCodigo(ler(path.join(WORKFLOWS, nome)));
      return !linhas.some(({ texto }) => /^permissions:/.test(texto));
    });

    expect(semPermissoes, 'workflows sem `permissions:` na raiz').toEqual([]);
  });

  /**
   * O `contents: read` é o piso, e escrever mais que isso pede motivo.
   *
   * Só duas escritas são esperadas hoje, e as duas estão nomeadas aqui: o
   * Gitleaks comenta no PR, e o CodeQL publica o SARIF na aba Security.
   *
   * **A primeira versão desta asserção tinha o buraco que ela existe para
   * fechar.** Ela procurava `^\s+chave: write` — indentado, porque é assim que
   * uma permissão aparece dentro do mapa. Só que `permissions: write-all` é
   * escrito **na coluna zero**, como escalar, e concede tudo de uma vez: ele
   * passava na asserção anterior (declara `permissions:`) e escapava desta.
   * A guarda ficava verde exatamente sobre o pior caso que existe.
   *
   * É a quinta ou sexta vez que este repositório tropeça na mesma família — a
   * guarda vê caractere, não intenção —, e por isso as duas formas são
   * procuradas: o escalar `write-all` e a entrada `chave: write`.
   */
  it('escrita no `GITHUB_TOKEN` só onde há motivo escrito', () => {
    const ESCRITA_PERMITIDA: Record<string, string> = {
      'gitleaks.yml': 'pull-requests: write — comenta o achado no próprio PR',
      'codeql.yml': 'security-events: write — publica o SARIF na aba Security',
    };

    /** `permissions: write-all`, em qualquer indentação: concede tudo. */
    const TUDO = /^\s*permissions:\s*write-all\s*$/;
    /** `chave: write` dentro do mapa de permissões. */
    const UMA = /^\s+[a-z-]+:\s*write\s*$/;

    const comEscrita = arquivosDeWorkflow().filter((nome) =>
      linhasDeCodigo(ler(path.join(WORKFLOWS, nome))).some(
        ({ texto }) => TUDO.test(texto) || UMA.test(texto),
      ),
    );

    expect(comEscrita.sort()).toEqual(Object.keys(ESCRITA_PERMITIDA).sort());
  });
});

describe('workflows: actions fixadas em SHA', () => {
  /** `uses: dono/action@ref` — o `ref` é o que interessa. */
  const USES = /^\s*(?:-\s*)?uses:\s*(\S+)/;

  function todosOsUses(): { arquivo: string; linha: number; valor: string }[] {
    const encontrados: { arquivo: string; linha: number; valor: string }[] = [];

    for (const nome of arquivosDeWorkflow()) {
      for (const { numero, texto } of linhasDeCodigo(ler(path.join(WORKFLOWS, nome)))) {
        const casou = texto.match(USES);
        if (casou?.[1]) encontrados.push({ arquivo: nome, linha: numero, valor: casou[1] });
      }
    }

    return encontrados;
  }

  /**
   * Actions do próprio repositório (`./.github/actions/...`) não têm SHA a
   * fixar: elas são o código que está sendo revisado. Nenhuma existe hoje; a
   * exceção fica escrita porque a primeira que existir vai reprovar aqui e o
   * motivo tem de estar à mão.
   */
  const LOCAL = /^\.\//;

  it('todo `uses:` de terceiro aponta para um SHA de 40 hex', () => {
    const naoFixadas = todosOsUses()
      .filter(({ valor }) => !LOCAL.test(valor))
      .filter(({ valor }) => !/@[0-9a-f]{40}$/.test(valor))
      .map(({ arquivo, linha, valor }) => `${arquivo}:${linha} ${valor}`);

    expect(naoFixadas, 'actions em tag movível — fixar em SHA completo').toEqual([]);
  });

  /**
   * **SHA sem o comentário da versão é indecifrável, e ninguém atualiza o que
   * não consegue ler.** É a armadilha 20 do §17 do plano, e é a razão de esta
   * asserção existir ao lado da anterior: fixar em SHA sem dizer qual versão
   * ele é troca um risco de supply chain por um congelamento permanente.
   */
  it('todo SHA carrega o comentário da versão ao lado', () => {
    const semVersao: string[] = [];

    for (const nome of arquivosDeWorkflow()) {
      const conteudo = ler(path.join(WORKFLOWS, nome));

      conteudo.split('\n').forEach((texto, indice) => {
        if (!/^\s*(?:-\s*)?uses:\s*\S+@[0-9a-f]{40}\b/.test(texto)) return;
        if (!/#\s*v?\d+\.\d+\.\d+/.test(texto)) {
          semVersao.push(`${nome}:${indice + 1} ${texto.trim()}`);
        }
      });
    }

    expect(semVersao, 'SHA sem `# vX.Y.Z` ao lado').toEqual([]);
  });
});

describe('os portões de PR aceitam as mesmas bases', () => {
  /**
   * **O achado que esta asserção existe para impedir, e ele nasceu no mesmo PR
   * que criou o arquivo.**
   *
   * O `codeql.yml` da Fase 10 nasceu com `pull_request: branches: [main]`,
   * porque naquele momento tudo mergeava na `main`. No dia seguinte a política
   * mudou — as fases passaram a integrar na **`dev`**, e a `main` a receber só
   * promoção deliberada. O `ci.yml` já aceitava as duas; o `codeql.yml`, não.
   *
   * O efeito seria **SAST pulado em silêncio** em todo PR de fase: o PR ficaria
   * verde, com Lint, Test e Build passando, e nenhuma linha dizendo que a
   * análise não rodou. É a família do PR empilhado na base errada, que este
   * repositório já registrou uma vez.
   *
   * Por isso a guarda compara **conjunto**, e não confere uma lista escrita à
   * mão: acrescentar uma base integradora em um dos dois e esquecer o outro é
   * a única coisa que ela precisa pegar.
   */

  /** Os workflows que existem para reprovar um PR antes do merge. */
  const PORTOES = ['ci.yml', 'codeql.yml'];

  /**
   * Os que **não** entram, e por quê. Nenhum dos dois é portão de PR: eles agem
   * sobre o que já foi publicado, e ampliá-los para a `dev` os faria medir ou
   * escrever fora de produção.
   */
  const FORA: Record<string, string> = {
    'gitleaks.yml': 'roda em todo `pull_request`, sem filtro de base',
    'smoke.yml': 'mede o site no ar — só faz sentido no push da `main`',
    'migrate.yml': 'aplica migration em produção — só no push da `main`',
    'lighthouse.yml': 'agendado e manual, contra produção; não reage a PR',
  };

  /**
   * A lista de `branches:` do bloco `pull_request:` de um workflow.
   *
   * Textual, como o resto do arquivo. Procura a chave e lê o primeiro
   * `branches:` **mais indentado** que venha depois — que é a forma que os dois
   * arquivos usam, e a única que o GitHub aceita aqui.
   */
  function basesDePullRequest(nome: string): string[] {
    const linhas = linhasDeCodigo(ler(path.join(WORKFLOWS, nome))).map((l) => l.texto);
    const inicio = linhas.findIndex((texto) => /^\s*pull_request:\s*$/.test(texto));
    if (inicio === -1) return [];

    const indentacao = (linhas[inicio] ?? '').search(/\S/);

    for (let i = inicio + 1; i < linhas.length; i += 1) {
      const linha = linhas[i] ?? '';
      if (linha.search(/\S/) <= indentacao) break;

      const casou = linha.match(/^\s*branches:\s*\[(.*)\]\s*$/);
      if (casou?.[1] !== undefined) {
        return casou[1]
          .split(',')
          .map((b) => b.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
          .sort();
      }
    }

    return [];
  }

  it('`ci.yml` e `codeql.yml` reprovam PR nas mesmas bases', () => {
    const porArquivo = Object.fromEntries(PORTOES.map((n) => [n, basesDePullRequest(n)]));

    // Sem isto, um parser que devolvesse vazio faria a comparação passar para
    // sempre — a lição da terceira asserção do `api-docs-drift.test.ts`.
    for (const [nome, bases] of Object.entries(porArquivo)) {
      expect(bases.length, `${nome} não declara base de \`pull_request\``).toBeGreaterThan(0);
    }

    const [primeiro, ...resto] = PORTOES;
    for (const nome of resto) {
      expect(porArquivo[nome], `bases de ${nome} × ${primeiro}`).toEqual(porArquivo[primeiro ?? '']);
    }
  });

  it('todo workflow é portão de PR ou tem motivo escrito para não ser', () => {
    const classificados = new Set([...PORTOES, ...Object.keys(FORA)]);
    const semClassificacao = arquivosDeWorkflow().filter((nome) => !classificados.has(nome));

    expect(semClassificacao, 'workflow novo: portão de PR, ou linha em `FORA`').toEqual([]);
  });
});

describe('CI: a auditoria de dependência e a lista de exceções', () => {
  const CI = path.join(WORKFLOWS, 'ci.yml');
  const PACKAGE_JSON = path.join(RAIZ, 'package.json');
  const DOCUMENTO = path.join(RAIZ, 'docs/security-advisories.md');

  /**
   * O passo existe, e é `--prod`.
   *
   * **A escolha do `--prod` é deliberada e vale escrever.** Sem ele, `pnpm audit
   * --audit-level=high` devolve 35 advisories em 17 pacotes, e a esmagadora
   * maioria é ferramenta de desenvolvimento que nunca é publicada — `eslint@8`,
   * `vitest@2`, o CLI do `shadcn`. Uma lista de exceção com 35 linhas é
   * exatamente a armadilha 21 do §17: vira ruído, alguém desliga o passo, e aí
   * ele deixa de existir de fato enquanto continua existindo no arquivo.
   *
   * Com `--prod` são **18**, todas já analisadas nos itens 9.S e 10.S do
   * `docs/progress.md`, e o que fecha o outro lado é o Dependabot: ele abre PR
   * semanal para dependência de desenvolvimento também.
   */
  it('o job de lint roda `pnpm audit --audit-level=high --prod`', () => {
    const ci = ler(CI);
    expect(ci).toMatch(/pnpm audit --audit-level=high --prod/);
  });

  function ghsasIgnoradas(): string[] {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as {
      pnpm?: { auditConfig?: { ignoreGhsas?: string[] } };
    };
    return pkg.pnpm?.auditConfig?.ignoreGhsas ?? [];
  }

  /**
   * As linhas da tabela do documento, que é onde mora o motivo.
   *
   * O `package.json` é JSON e não aceita comentário — então a lista lá é só o
   * identificador, e o motivo, a data e o gatilho vivem num markdown. Os dois
   * podem divergir, e é essa divergência que esta suíte existe para impedir.
   */
  function linhasDoDocumento(): { ghsa: string; colunas: string[] }[] {
    const linhas = ler(DOCUMENTO).split('\n');
    const encontradas: { ghsa: string; colunas: string[] }[] = [];

    for (const linha of linhas) {
      if (!linha.trimStart().startsWith('|')) continue;
      const colunas = linha
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      const ghsa = colunas[0]?.match(/GHSA-[0-9a-z-]+/)?.[0];
      if (ghsa) encontradas.push({ ghsa, colunas });
    }

    return encontradas;
  }

  it('toda GHSA silenciada tem linha no documento, e vice-versa', () => {
    const noPackageJson = [...ghsasIgnoradas()].sort();
    const noDocumento = [...new Set(linhasDoDocumento().map((l) => l.ghsa))].sort();

    expect(noDocumento, 'GHSA em `docs/security-advisories.md` × `package.json`').toEqual(
      noPackageJson,
    );
  });

  /**
   * **Cada linha diz por quê, quem aceitou, quando, e o que a reabre.**
   *
   * Sem as quatro, a lista é um `--force` com passos extras. O gatilho é o campo
   * que impede a exceção de virar permanente: `next` sai com a major 15,
   * `fastify` com a 5, e o dia em que isso acontecer a linha some sozinha
   * porque a advisory some do `audit`.
   */
  it('cada linha traz motivo, data e gatilho', () => {
    const incompletas = linhasDoDocumento()
      .filter(({ colunas }) => {
        const [, , motivo, data, gatilho] = colunas;
        const temData = /\b\d{2}\/\d{2}\/\d{4}\b/.test(data ?? '');
        return !motivo || motivo.length < 20 || !temData || !gatilho || gatilho.length < 5;
      })
      .map(({ ghsa }) => ghsa);

    expect(incompletas, 'linhas sem motivo, sem data ou sem gatilho').toEqual([]);
  });

  /**
   * A guarda que segura as outras três.
   *
   * Um parser que devolvesse vazio faria "toda GHSA tem linha" e "toda linha
   * está completa" passarem para sempre — é a lição do `api-docs-drift.test.ts`,
   * cuja terceira asserção existe pelo mesmo motivo.
   */
  it('a lista não está vazia', () => {
    expect(ghsasIgnoradas().length).toBeGreaterThan(0);
    expect(linhasDoDocumento().length).toBe(ghsasIgnoradas().length);
  });
});

describe('a contagem de workflows escrita em prosa', () => {
  /**
   * **É o item 41 outra vez, e num número que esta fase muda.**
   *
   * Os dois READMEs afirmam quantos workflows sustentam o projeto. A Fase 10
   * acrescenta o CodeQL — e a contagem em prosa mora em dois arquivos que a
   * mudança não abre, exatamente como o `13` dos feeds sobreviveu em oito.
   * O `tsc` não lê prosa; esta asserção lê.
   *
   * A lista de arquivos é explícita pelo mesmo motivo que a do
   * `feed-count-drift.test.ts`: varrer o repositório inteiro reprovaria sobre
   * registro histórico, e `docs/progress.md` guarda os números antigos de
   * propósito.
   */
  const POR_EXTENSO: Record<string, number> = {
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };

  const NUMERAL = String.raw`\d{1,2}|quatro|cinco|seis|sete|oito|four|five|six|seven|eight`;
  const CONTAGEM = new RegExp(String.raw`\b(${NUMERAL})\s+(?:GitHub Actions\s+)?workflows\b`, 'gi');

  const ARQUIVOS_VIVOS = ['README.md', 'README.pt-BR.md'];

  it('os READMEs contam os workflows que existem', () => {
    const reais = arquivosDeWorkflow().length;
    const erradas: string[] = [];

    for (const relativo of ARQUIVOS_VIVOS) {
      const conteudo = ler(path.join(RAIZ, relativo));
      for (const casou of conteudo.matchAll(CONTAGEM)) {
        const bruto = casou[1] ?? '';
        const escrito = POR_EXTENSO[bruto.toLowerCase()] ?? Number(bruto);
        if (escrito !== reais) {
          erradas.push(`${relativo}: "${casou[0]}" — existem ${reais}`);
        }
      }
    }

    expect(erradas, 'contagem de workflows desatualizada').toEqual([]);
  });
});
