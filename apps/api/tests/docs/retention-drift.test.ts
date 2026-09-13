import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PRODUCT_EVENT_RETENTION_DAYS } from '@newranews/types';
import { AUDIT_EVENT_RETENTION_DAYS } from '../../src/services/audit.service';
import { ERROR_EVENT_RETENTION_DAYS } from '../../src/services/error-event.service';
import {
  ARTICLE_RETENTION_DAYS,
  NEWS_RETENTION_DAYS,
  PIPELINE_LOG_RETENTION_DAYS,
} from '../../src/services/pipeline.service';

/**
 * A guarda contra a retenção que envelhece em prosa.
 *
 * A etapa 8 apaga seis tabelas por idade, e o número de cada uma está escrito
 * — em dias — em documentos que a etapa não abre: os dois diagramas do
 * pipeline, a seção "Pipeline Diário" do `apps/api/CLAUDE.md` e a lista de
 * models do `packages/database/CLAUDE.md`. A verificação pós-merge do 5a
 * (item 63 do `docs/progress.md`) mediu que **nenhuma guarda alcançava esses
 * números**: o `diagram-drift` compara etapas, não retenção, e quando o 5b pôs
 * os 365 dias do `AuditEvent` na etapa 8 os quatro envelheceriam juntos.
 *
 * É a família do `13` dos feeds (`feed-count-drift.test.ts`): número que
 * descreve uma coleção quer guarda derivada da coleção, nunca um segundo lugar
 * onde ele é digitado. Aqui a fonte são as **constantes dos services** — que
 * até este PR nem existiam para notícia, log e artigo: eram literais dentro da
 * etapa.
 *
 * **Cada padrão é positivo e negativo ao mesmo tempo.** Precisa casar ao menos
 * uma vez (a frase existe) e toda ocorrência precisa trazer o número certo (a
 * frase velha não sobreviveu ao lado da nova). Sem a primeira metade, apagar a
 * frase inteira passaria; sem a segunda, acrescentar em vez de trocar passaria.
 */

const RAIZ = path.resolve(__dirname, '../../../..');

interface Claim {
  /** Regex com **um** grupo de captura: o número de dias. */
  pattern: RegExp;
  expected: number;
}

/**
 * O que cada arquivo vivo afirma, no formato em que afirma.
 *
 * Registro histórico (`docs/progress.md`, o plano de observabilidade) fica de
 * fora, pelo mesmo motivo do `feed-count-drift`: ele guarda o número antigo de
 * propósito.
 */
const AFIRMACOES: Record<string, Claim[]> = {
  'docs/diagrams/data-flow.mermaid': [
    { pattern: /news >(\d+)d/g, expected: NEWS_RETENTION_DAYS },
    { pattern: /logs >(\d+)d/g, expected: PIPELINE_LOG_RETENTION_DAYS },
    { pattern: /artigos e eventos >(\d+)d/g, expected: ARTICLE_RETENTION_DAYS },
    { pattern: /erros >(\d+)d/g, expected: ERROR_EVENT_RETENTION_DAYS },
    { pattern: /auditoria >(\d+)d/g, expected: AUDIT_EVENT_RETENTION_DAYS },
  ],
  'docs/diagrams/pipeline-sequence.mermaid': [
    { pattern: /news >(\d+)d/g, expected: NEWS_RETENTION_DAYS },
    { pattern: /logs >(\d+)d/g, expected: PIPELINE_LOG_RETENTION_DAYS },
    { pattern: /artigos e eventos >(\d+)d/g, expected: ARTICLE_RETENTION_DAYS },
    { pattern: /erros >(\d+)d/g, expected: ERROR_EVENT_RETENTION_DAYS },
    { pattern: /auditoria >(\d+)d/g, expected: AUDIT_EVENT_RETENTION_DAYS },
  ],
  'apps/api/CLAUDE.md': [
    { pattern: /News >(\d+) dias/g, expected: NEWS_RETENTION_DAYS },
    { pattern: /PipelineLogs >(\d+) dias/g, expected: PIPELINE_LOG_RETENTION_DAYS },
    { pattern: /Articles >(\d+) dias/g, expected: ARTICLE_RETENTION_DAYS },
    { pattern: /ProductEvents >(\d+) dias/g, expected: PRODUCT_EVENT_RETENTION_DAYS },
    { pattern: /ErrorEvents >(\d+) dias/g, expected: ERROR_EVENT_RETENTION_DAYS },
    { pattern: /AuditEvents >(\d+) dias/g, expected: AUDIT_EVENT_RETENTION_DAYS },
  ],
  'packages/database/CLAUDE.md': [
    // A lista de models, um por linha…
    { pattern: /^- News →[^\n]*\(retenção: (\d+) dias/gm, expected: NEWS_RETENTION_DAYS },
    { pattern: /^- Article →[^\n]*\(retenção: (\d+) dias/gm, expected: ARTICLE_RETENTION_DAYS },
    {
      pattern: /^- PipelineLog →[^\n]*\(retenção: (\d+) dias/gm,
      expected: PIPELINE_LOG_RETENTION_DAYS,
    },
    {
      pattern: /^- ProductEvent →[^\n]*\(retenção: (\d+) dias/gm,
      expected: PRODUCT_EVENT_RETENTION_DAYS,
    },
    {
      pattern: /^- ErrorEvent →[^\n]*\(retenção: (\d+) dias/gm,
      expected: ERROR_EVENT_RETENTION_DAYS,
    },
    {
      pattern: /^- AuditEvent →[^\n]*\(retenção: (\d+) dias/gm,
      expected: AUDIT_EVENT_RETENTION_DAYS,
    },
    // …e a linha do cleanup, que os repete na forma curta.
    { pattern: /News \((\d+)d\)/g, expected: NEWS_RETENTION_DAYS },
    { pattern: /PipelineLog \((\d+)d\)/g, expected: PIPELINE_LOG_RETENTION_DAYS },
    { pattern: /Article \((\d+)d\)/g, expected: ARTICLE_RETENTION_DAYS },
    { pattern: /ProductEvent \((\d+)d\)/g, expected: PRODUCT_EVENT_RETENTION_DAYS },
    { pattern: /ErrorEvent \((\d+)d\)/g, expected: ERROR_EVENT_RETENTION_DAYS },
    { pattern: /AuditEvent \((\d+)d\)/g, expected: AUDIT_EVENT_RETENTION_DAYS },
  ],
  'README.md': [{ pattern: /cleaned up after (\d+) days/g, expected: NEWS_RETENTION_DAYS }],
  'README.pt-BR.md': [{ pattern: /expurgados após (\d+) dias/g, expected: NEWS_RETENTION_DAYS }],
};

function leia(relativo: string): string {
  return readFileSync(path.join(RAIZ, relativo), 'utf8');
}

describe('a retenção escrita em prosa bate com as constantes da etapa 8', () => {
  it.each(Object.entries(AFIRMACOES))('%s', (relativo, claims) => {
    const texto = leia(relativo);
    const divergencias: string[] = [];

    for (const { pattern, expected } of claims) {
      const matches = [...texto.matchAll(pattern)];
      if (matches.length === 0) {
        divergencias.push(`${pattern.source}: frase ausente`);
        continue;
      }
      for (const match of matches) {
        const found = Number(match[1]);
        if (found !== expected) {
          divergencias.push(`${match[0]}: diz ${found}, o código diz ${expected}`);
        }
      }
    }

    expect(divergencias).toEqual([]);
  });

  it('os dois diagramas dizem "artigos e eventos" porque os dois têm a mesma retenção', () => {
    // A frase junta as duas tabelas num número só. Se um dia divergirem, a
    // frase — e este teste — precisam se partir em duas.
    expect(ARTICLE_RETENTION_DAYS).toBe(PRODUCT_EVENT_RETENTION_DAYS);
  });

  it('as constantes são as que o produto decidiu — mudar aqui é mudar de propósito', () => {
    // Não é redundância com os services: é o que faz o teste acima reprovar
    // quando alguém trocar uma constante sem passar por aqui, e é onde a
    // decisão de cada número está escrita com o motivo.
    expect(NEWS_RETENTION_DAYS).toBe(30);
    expect(PIPELINE_LOG_RETENTION_DAYS).toBe(30);
    expect(ARTICLE_RETENTION_DAYS).toBe(90);
    expect(PRODUCT_EVENT_RETENTION_DAYS).toBe(90);
    // 14 e não 30: responde "o que está quebrado agora".
    expect(ERROR_EVENT_RETENTION_DAYS).toBe(14);
    // 365: log de segurança responde pergunta feita meses depois.
    expect(AUDIT_EVENT_RETENTION_DAYS).toBe(365);
  });
});
