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
  'apps/api/src/providers/ai/ai-utils.ts',
  'apps/api/src/providers/news/rss.provider.ts',
  'docs/presentation.md',
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

/**
 * "12 feeds", "doze feeds", "twelve RSS feeds", "(12 fontes)" — todas as formas
 * em que este repositório escreve a contagem, e nenhuma a mais.
 *
 * O `fontes` exige parênteses de propósito: solto, ele casaria com as **87
 * fontes** distintas do acervo que a armadilha do `CLAUDE.md` cita, que é outro
 * número e está certo. Só o rótulo do nó de RSS no diagrama escreve
 * `(12 fontes)`.
 */
const CONTAGEM_ESCRITA =
  /\b(\d{1,3}|onze|doze|treze|quatorze|catorze|quinze|eleven|twelve|thirteen|fourteen|fifteen)\s+(?:RSS\s+)?feeds\b|\((\d{1,3}|doze|twelve)\s+fontes\)/gi;

function valorDe(bruto: string): number {
  const chave = bruto.toLowerCase();
  return POR_EXTENSO[chave] ?? Number(chave);
}

describe('a contagem de feeds escrita em prosa acompanha rss-sources.ts', () => {
  const esperado = rssSources.length;

  it('a lista de fontes não está vazia — senão a guarda passaria por vacuidade', () => {
    expect(esperado).toBeGreaterThan(0);
  });

  it.each(ARQUIVOS_VIVOS)('%s não cita outra contagem', (relativo) => {
    const conteudo = readFileSync(path.join(RAIZ, relativo), 'utf8');
    const linhas = conteudo.split('\n');

    const divergentes: string[] = [];

    linhas.forEach((linha, indice) => {
      for (const casamento of linha.matchAll(CONTAGEM_ESCRITA)) {
        const escrito = valorDe(casamento[1] ?? casamento[2] ?? '');
        if (escrito !== esperado) {
          divergentes.push(`${relativo}:${indice + 1}  "${casamento[0].trim()}"`);
        }
      }
    });

    expect(
      divergentes,
      `rss-sources.ts tem ${esperado} fontes, mas estas linhas dizem outra coisa:\n${divergentes.join('\n')}`,
    ).toEqual([]);
  });
});
