import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { rssSources } from '../../src/config/rss-sources';

/**
 * A guarda contra o número que envelhece em oito lugares de uma vez.
 *
 * A Reuters saiu de `rss-sources.ts` em 24/08/2026 — não por URL errada: o
 * domínio deixou de existir, e `feeds.reuters.com` devolve NXDOMAIN. A lista
 * passou de treze para doze fontes, o comentário que **documenta a remoção**
 * ficou logo acima do array, e mesmo assim o `13` sobreviveu em oito arquivos:
 * os dois `CLAUDE.md`, dois diagramas, a peça de portfólio, o plano da V2, o
 * README e — o mais irônico — o parágrafo do próprio `rss.provider.ts` que
 * conta a história da Reuters, dizendo "uma suíte que bate nos treze feeds".
 *
 * **Nada acusa, e não é distração de ninguém.** Remover uma fonte é uma linha;
 * a contagem dela está escrita em prosa, longe do array, em arquivos que a
 * mudança não abre. O `tsc` não lê prosa, a suíte não lia, e o número só
 * reapareceu quando a padronização do README mandou conferir toda afirmação
 * contra um arquivo real do repositório.
 *
 * A varredura é estática e a lista de arquivos é explícita, por uma razão que
 * a Fase 11 já cobrou quatro vezes: guarda que varre repositório inteiro
 * reprova sobre registro histórico. O `docs/progress.md` e a §74 do plano da
 * V2 **guardam o `13` de propósito** — o primeiro é o diário fase a fase, e a
 * segunda cita o README de 15/08 nomeando a URL de onde copiou. Corrigir os
 * dois seria reescrever o passado; por isso eles não entram em `ARQUIVOS_VIVOS`.
 *
 * **Ela reprovou na estreia, e sobre o texto que a anuncia.** A armadilha
 * escrita no `CLAUDE.md` para explicar este defeito citava a string velha entre
 * aspas — e o regex não distingue "afirmo treze" de "cito quem dizia treze".
 * É a quinta vez que este projeto tropeça nisso, sempre na mesma família: a
 * guarda vê caractere, não intenção. **Ao escrever sobre uma contagem antiga em
 * arquivo vivo, parafraseie em vez de reproduzir** — o número solto (`treze`,
 * sem `feeds` colado) passa, e é o suficiente para contar a história.
 */

const RAIZ = path.resolve(__dirname, '../../../..');

/**
 * Os arquivos que descrevem o sistema **como ele é agora**.
 *
 * Registro histórico fica fora — ver o cabeçalho. Ao acrescentar documento que
 * cite a contagem de feeds, acrescente-o aqui: a guarda só alcança o que a
 * lista nomeia.
 */
const ARQUIVOS_VIVOS = [
  'CLAUDE.md',
  'README.md',
  'README.pt-BR.md',
  'apps/api/CLAUDE.md',
  'apps/api/src/config/rss-sources.ts',
  'apps/api/src/providers/ai/ai-utils.ts',
  'apps/api/src/providers/news/rss.provider.ts',
  'docs/presentation.md',
  'docs/Newra-News-Observability-Plan.md',
  'docs/diagrams/data-flow.mermaid',
  'docs/diagrams/pipeline-sequence.mermaid',
  'docs/diagrams/system-architecture.mermaid',
];

/** Numerais por extenso que este repositório escreve, nos dois idiomas. */
const POR_EXTENSO: Record<string, number> = {
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
};

/** O numeral, por extenso ou em dígito. Fragmento reusado pelos dois padrões. */
const NUMERAL = String.raw`\d{1,3}|onze|doze|treze|quatorze|catorze|quinze|eleven|twelve|thirteen|fourteen|fifteen`;

/**
 * "12 feeds", "doze feeds", "twelve RSS feeds", "(12 fontes)".
 *
 * O `fontes` exige parênteses **fora do escopo de RSS**: solto, ele casaria com
 * as **87 fontes** distintas do acervo que a armadilha do `CLAUDE.md` cita, que
 * é outro número e está certo.
 */
const CONTAGEM_ESCRITA = new RegExp(
  String.raw`\b(${NUMERAL})\s+(?:RSS\s+)?feeds\b|\((${NUMERAL})\s+fontes\)`,
  'gi',
);

/**
 * Dentro destes arquivos, **"N fontes" solto também é a contagem de feeds** —
 * eles não falam de outra coleção.
 *
 * **É a segunda metade do furo que a auditoria de 04/09/2026 achou.** O
 * `rss.provider.ts` dizia "e treze / fontes em paralelo significam que basta
 * uma", e a guarda passou verde por dois motivos somados: o padrão de `fontes`
 * exigia parênteses, e a varredura era **linha a linha** — a frase quebrava
 * entre a 105 e a 106, então nem o `feeds` teria casado. Guarda que lê prosa
 * tem de ler a prosa como ela é lida: corrida, sem a quebra de linha do editor.
 */
const ESCOPO_RSS = new Set([
  'apps/api/src/providers/news/rss.provider.ts',
  'apps/api/src/config/rss-sources.ts',
]);

const CONTAGEM_FONTES_SOLTA = new RegExp(String.raw`\b(${NUMERAL})\s+fontes\b`, 'gi');

function valorDe(bruto: string): number {
  return POR_EXTENSO[bruto.toLowerCase()] ?? Number(bruto);
}

/**
 * O arquivo como texto corrido, mais o índice de onde cada linha começa.
 *
 * O prefixo de comentário (`//`, `*`, `#`, `>`) sai: numa frase que atravessa
 * duas linhas de um bloco `/** *\/`, o `*` fica no meio das palavras e quebra o
 * `\s+` do padrão.
 */
function textoCorrido(conteudo: string): { texto: string; inicios: number[] } {
  const inicios: number[] = [];
  let acumulado = 0;

  const partes = conteudo.split('\n').map((linha) => {
    inicios.push(acumulado);
    const limpa = linha.replace(/^\s*(?:\/\/|\*|#|>)\s?/, '');
    acumulado += limpa.length + 1;
    return limpa;
  });

  return { texto: partes.join(' '), inicios };
}

/** A linha (1-based) em que um índice do texto corrido caiu. */
function linhaDe(indice: number, inicios: number[]): number {
  let baixo = 0;
  let alto = inicios.length - 1;
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2);
    if (inicios[meio]! <= indice) baixo = meio;
    else alto = meio - 1;
  }
  return baixo + 1;
}

describe('a contagem de feeds escrita em prosa acompanha rss-sources.ts', () => {
  const esperado = rssSources.length;

  it('a lista de fontes não está vazia — senão a guarda passaria por vacuidade', () => {
    expect(esperado).toBeGreaterThan(0);
  });

  it('acha uma contagem quebrada entre duas linhas — o furo de 04/09', () => {
    const { texto, inicios } = textoCorrido(
      ['// prende a etapa 1 do pipeline sem teto — e treze', '// fontes em paralelo bastam.'].join(
        '\n',
      ),
    );
    const achados = [...texto.matchAll(CONTAGEM_FONTES_SOLTA)];

    expect(achados).toHaveLength(1);
    expect(valorDe(achados[0]![1]!)).toBe(13);
    expect(linhaDe(achados[0]!.index!, inicios)).toBe(1);
  });

  it.each(ARQUIVOS_VIVOS)('%s não cita outra contagem', (relativo) => {
    const { texto, inicios } = textoCorrido(readFileSync(path.join(RAIZ, relativo), 'utf8'));

    const padroes = ESCOPO_RSS.has(relativo)
      ? [CONTAGEM_ESCRITA, CONTAGEM_FONTES_SOLTA]
      : [CONTAGEM_ESCRITA];

    const divergentes: string[] = [];

    for (const padrao of padroes) {
      for (const casamento of texto.matchAll(padrao)) {
        const escrito = valorDe(casamento[1] ?? casamento[2] ?? '');
        if (escrito !== esperado) {
          divergentes.push(
            `${relativo}:${linhaDe(casamento.index!, inicios)}  "${casamento[0].trim()}"`,
          );
        }
      }
    }

    expect(
      divergentes,
      `rss-sources.ts tem ${esperado} fontes, mas isto diz outra coisa:\n${divergentes.join('\n')}`,
    ).toEqual([]);
  });
});
