import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * A guarda contra a lista de tabelas escrita em prosa.
 *
 * O `packages/database/CLAUDE.md` enumera **os models e os enums, um por um**,
 * numa seção que a mudança de schema não abre — é a forma exata do `13` dos
 * feeds (`feed-count-drift.test.ts`) e da lista de tabelas do diagrama ER, com
 * a diferença de que aqui a deriva não é um número, é uma ausência: a tabela
 * nova simplesmente não aparece, e nada no repositório fica vermelho.
 *
 * Este arquivo é o índice que uma sessão fria lê para saber o que existe no
 * banco. Uma tabela que ele não cita é uma tabela que ninguém sabe que pode
 * consultar — e o custo é o mesmo do documento errado: a próxima fase reimplanta
 * o que já existe, ou consulta o que já não existe.
 *
 * **Conjunto derivado da fonte, nunca contagem.** Ela lê os `model` e os `enum`
 * do `schema.prisma` e cobra que cada nome apareça na seção correspondente do
 * documento. Model novo entra na varredura sozinho, que é a razão de a guarda
 * existir.
 */

const RAIZ = path.resolve(__dirname, '../../../..');

const SCHEMA = 'packages/database/prisma/schema.prisma';
const DOC = 'packages/database/CLAUDE.md';

const ler = (relativo: string): string => readFileSync(path.join(RAIZ, relativo), 'utf8');

/**
 * Comentário fora antes do regex. O `schema.prisma` deste projeto é mais
 * comentário que declaração, e os comentários citam nomes de model — sem esta
 * linha, uma frase como "o `ErrorEvent` vive 14 dias" viraria uma declaração.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/\/?.*$/gm, '$1');
}

function modelosDoSchema(): string[] {
  return [...semComentarios(ler(SCHEMA)).matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1] as string);
}

function enumsDoSchema(): string[] {
  return [...semComentarios(ler(SCHEMA)).matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1] as string);
}

/**
 * Uma seção do documento, do seu título `## <nome>` até o próximo `## `.
 *
 * A seção importa: `PipelineStatus` aparece no corpo do arquivo em outra
 * conversa, e cobrar a presença no documento inteiro deixaria a lista de enums
 * poder ficar vazia sem a guarda notar.
 */
function secao(titulo: string): string {
  const conteudo = ler(DOC);
  const inicio = conteudo.indexOf(`## ${titulo}`);
  if (inicio === -1) return '';
  const resto = conteudo.slice(inicio + 3);
  const fim = resto.indexOf('\n## ');
  return fim === -1 ? resto : resto.slice(0, fim);
}

describe('o CLAUDE.md do database acompanha o schema', () => {
  it('acha o que precisa achar — seção vazia aprovaria tudo', () => {
    expect(modelosDoSchema()).toContain('PipelineLog');
    expect(enumsDoSchema()).toContain('PipelineEventLevel');
    expect(secao('Models')).toContain('PipelineLog');
    expect(secao('Enums')).toContain('PipelineEventLevel');
  });

  it('lista todo model do schema na seção Models', () => {
    const secaoModels = secao('Models');
    const ausentes = modelosDoSchema().filter((nome) => !secaoModels.includes(nome));

    expect(ausentes).toEqual([]);
  });

  it('lista todo enum do schema na seção Enums', () => {
    const secaoEnums = secao('Enums');
    const ausentes = enumsDoSchema().filter((nome) => !secaoEnums.includes(nome));

    expect(ausentes).toEqual([]);
  });
});
