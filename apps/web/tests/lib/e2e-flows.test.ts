import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * **A prosa nomeia os fluxos do smoke; o diretório é quem os define.**
 *
 * Esta guarda nasceu de um número que estava prestes a apodrecer exatamente
 * como o `13` dos feeds RSS. A contagem de specs do smoke — "29", depois "31" —
 * estava escrita em **cinco arquivos vivos** (os dois `README`, a
 * `presentation.md` e três lugares do `CLAUDE.md`), e nada a derivava de coisa
 * nenhuma: acrescentar um spec era uma linha, e a contagem morava longe dela,
 * em arquivos que a mudança não abre.
 *
 * **A correção não foi guardar o número — foi parar de escrevê-lo.** Contagem
 * de *testes* é volátil (muda a cada asserção acrescentada) e não informa quem
 * lê; o que informa é **quais fluxos** o smoke cobre. E fluxo é derivável: há
 * um arquivo de spec por fluxo, então o diretório é a fonte.
 *
 * ## O que reprova de verdade, e o que é só uma rede grossa
 *
 * A asserção que **de fato** segura isto é a de exaustividade sobre o
 * diretório: `FLOWS` tem de ter exatamente uma entrada por `e2e/*.spec.ts`.
 * Arquivo novo reprova até alguém declarar o fluxo aqui — e é nesse momento que
 * a pessoa é mandada aos documentos.
 *
 * A segunda asserção — cada documento vivo nomeia cada fluxo — é **rede
 * grossa, e está escrito de propósito**: "conta" e "acervo" são palavras
 * comuns em português e podem aparecer num documento por outro motivo, deixando
 * passar um fluxo não documentado. Ela não substitui a primeira; ela pega o
 * caso barato (um fluxo removido cujo nome sumiu de um `README` só).
 *
 * **Não há varredura proibindo um número novo em prosa**, e isso também é
 * decisão: `CLAUDE.md` guarda o registro datado da Fase 11, que cita a
 * contagem da estreia. Um regex numérico reprovaria sobre ele — é a quinta
 * ocorrência da família em que a guarda vê caractere e não intenção, e o
 * `feed-count-drift` já pagou por ela.
 */

const WEB_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(WEB_ROOT, '../..');
const E2E_DIR = path.join(WEB_ROOT, 'e2e');

/**
 * O nome de cada fluxo nos dois idiomas, chaveado pelo arquivo que o cobre.
 *
 * Ao acrescentar um spec, acrescente a linha aqui **e** nomeie o fluxo nos
 * documentos vivos abaixo — é para isso que a primeira asserção reprova.
 */
const FLOWS: Record<string, { pt: string; en: string }> = {
  account: { pt: 'conta', en: 'account' },
  archive: { pt: 'acervo', en: 'archive' },
  authorization: { pt: 'autorização', en: 'authorization' },
  newsletter: { pt: 'newsletter', en: 'newsletter' },
  visitor: { pt: 'visitante', en: 'visitor' },
};

/**
 * Os documentos que descrevem o smoke **como ele é agora**.
 *
 * Registro histórico fica fora, pela mesma razão do `feed-count-drift`: o
 * `docs/progress.md` é o diário fase a fase e cita a contagem de cada época.
 */
const LIVE_DOCS: Array<{ file: string; lang: 'pt' | 'en' }> = [
  { file: 'CLAUDE.md', lang: 'pt' },
  { file: 'README.pt-BR.md', lang: 'pt' },
  { file: 'README.md', lang: 'en' },
  { file: 'docs/presentation.md', lang: 'pt' },
];

/** `account.spec.ts` → `account`. */
function specFlows(): string[] {
  return readdirSync(E2E_DIR)
    .filter((entry) => entry.endsWith('.spec.ts'))
    .map((entry) => entry.replace(/\.spec\.ts$/, ''))
    .sort();
}

function read(file: string): string {
  return readFileSync(path.join(REPO_ROOT, file), 'utf8').toLowerCase();
}

describe('os fluxos do smoke E2E', () => {
  it('declares exactly one flow per spec file', () => {
    // A asserção que segura as outras. Spec novo sem linha em `FLOWS` reprova
    // aqui, e é aí que quem escreveu o spec é mandado aos documentos.
    expect(Object.keys(FLOWS).sort()).toEqual(specFlows());
  });

  it('finds spec files at all — an empty directory would pass everything', () => {
    const flows = specFlows();

    expect(flows.length).toBeGreaterThan(3);
    expect(flows).toContain('authorization');
  });

  it.each(LIVE_DOCS.map((doc) => [doc.file, doc] as const))(
    '%s names every flow the smoke covers',
    (_name, doc) => {
      const content = read(doc.file);

      const missing = specFlows().filter((flow) => {
        const term = FLOWS[flow]?.[doc.lang];
        return term === undefined || !content.includes(term.toLowerCase());
      });

      expect(missing).toEqual([]);
    },
  );
});
