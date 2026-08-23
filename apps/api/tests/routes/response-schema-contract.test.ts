import { describe, it, expect } from 'vitest';
import { Prisma } from '@newranews/database';
import { z } from 'zod';
import {
  articleItemSchema,
  articleWithSourcesSchema,
  briefingSourceSchema,
} from '../../src/routes/articles/schemas';
import { newsItemSchema } from '../../src/routes/news/schemas';

/**
 * **O que não está no schema não existe** — e agora há guarda.
 *
 * Este é o defeito mais caro já pago por este backend, e ele passou um dia em
 * produção sem que nada acusasse: o `article.service` carregava os campos de
 * auditoria e as 15 fontes desde a Fase 0.5, o `articleItemSchema` era o da V1,
 * e o `fastify-type-provider-zod` serializa **pelo schema**. Campo que o
 * serviço busca e o schema não declara é lido do banco e jogado fora na saída,
 * sem erro, sem log e sem teste vermelho — a `docs/api.md` até descrevia o
 * comportamento certo.
 *
 * A guarda inverte a comparação: em vez de conferir o schema contra o `select`
 * (que muda), confere contra **a coluna do Prisma**. Toda coluna de um modelo
 * servido ou está no schema de resposta, ou está na lista de omitidas — com o
 * motivo escrito. Coluna nova no `schema.prisma` reprova aqui até alguém
 * decidir o que fazer com ela, que é exatamente a decisão que ninguém tomou em
 * 21/08.
 */

type Model = { name: string; fields: Array<{ name: string; kind: string }> };

/** Colunas escalares do modelo — relação não é campo de resposta. */
function scalarColumns(modelName: string): string[] {
  const models = Prisma.dmmf.datamodel.models as unknown as Model[];
  const model = models.find((m) => m.name === modelName);
  if (!model) throw new Error(`model ${modelName} not found in the Prisma DMMF`);
  return model.fields.filter((f) => f.kind !== 'object').map((f) => f.name);
}

function schemaKeys(schema: z.ZodObject<z.ZodRawShape>): string[] {
  return Object.keys(schema.shape);
}

/**
 * Coluna que **de propósito** não sai na resposta, com o motivo.
 *
 * Lista curta é o ponto: cada linha aqui é uma decisão, e uma decisão sem
 * motivo escrito vira a próxima surpresa.
 */
const OMITTED: Record<string, Record<string, string>> = {
  Article: {},
  News: {},
  BriefingSource: {
    // Chave estrangeira do dono. A resposta já chega aninhada no artigo; repetir
    // o id do pai em cada fonte é ruído.
    articleId: 'a fonte já vem dentro do artigo que a possui',
    // Timestamp de escrita da linha de auditoria, não do briefing.
    createdAt: 'instante de gravação da linha, sem leitor na interface',
  },
};

describe('9.1 — o schema de resposta declara o que o modelo tem', () => {
  it.each([
    ['Article', articleItemSchema],
    ['News', newsItemSchema],
    ['BriefingSource', briefingSourceSchema],
  ])('%s', (modelName, schema) => {
    const declared = new Set(schemaKeys(schema as z.ZodObject<z.ZodRawShape>));
    const omitted = OMITTED[modelName] ?? {};

    const dropped = scalarColumns(modelName).filter(
      (column) => !declared.has(column) && !(column in omitted),
    );

    expect(dropped).toEqual([]);
  });

  it('keeps the omission list honest — no entry for a column that no longer exists', () => {
    for (const [modelName, omitted] of Object.entries(OMITTED)) {
      const columns = new Set(scalarColumns(modelName));
      for (const column of Object.keys(omitted)) {
        expect(columns.has(column)).toBe(true);
      }
    }
  });

  it('finds columns at all — an empty model list would pass everything', () => {
    expect(scalarColumns('Article').length).toBeGreaterThan(5);
    expect(scalarColumns('Article')).toContain('promptVersion');
  });

  it('carries the sources only on the detail schema', () => {
    // A decisão da §18.4: 15 linhas por artigo × 10 por página seriam 150
    // objetos de peso morto na listagem. O que a guarda tranca é a **assimetria
    // deliberada** — para que ela continue sendo decisão, e não esquecimento.
    expect(schemaKeys(articleWithSourcesSchema)).toContain('sources');
    expect(schemaKeys(articleItemSchema)).not.toContain('sources');
  });
});
