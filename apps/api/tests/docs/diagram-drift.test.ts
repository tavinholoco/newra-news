import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * A guarda contra o diagrama que descreve um sistema que já mudou.
 *
 * **Os quatro diagramas de `docs/diagrams/` eram de 16/08/2026 e foram tocados
 * uma única vez desde então** — no commit que corrigiu a contagem de feeds.
 * Em 01/09, a conferência achou o estrago: o ER documentava **4 das 12**
 * tabelas, o de arquitetura anunciava um keep-alive removido dois dias antes e
 * uma UI de Swagger que produção não registra desde a Fase 9, os dois do
 * pipeline diziam **9 etapas** quando são **11**, e o mapa de rotas mostrava 4
 * das 15 páginas.
 *
 * **Nada acusava, e é a mesma família da `feed-count-drift`:** o `tsc` não lê
 * diagrama, a suíte não lia, e ninguém reabre um `.mermaid` ao acrescentar uma
 * tabela ou uma rota. A diferença é que aqui o número não está escrito em prosa
 * — está na *forma* do desenho, e por isso a guarda compara **conjuntos**, não
 * contagens: é a lista de modelos do schema, a de rotas do `app/`, e a de
 * etapas que o pipeline registra.
 *
 * **Contagem seria a guarda errada.** A etapa 2 (normalização) não grava
 * `PipelineEvent` — ela acontece dentro dos providers —, então contar
 * marcadores daria 10 e a prosa diz 11, os dois certos. Conjunto não tem esse
 * problema: exige que toda etapa **que se anuncia** esteja desenhada, e não
 * opina sobre as que não se anunciam.
 *
 * A varredura tira comentário antes do regex, pela razão que a Fase 11 cobrou
 * quatro vezes: guarda que vê caractere conta prosa como código.
 */

const RAIZ = path.resolve(__dirname, '../../../..');

const ler = (relativo: string): string => readFileSync(path.join(RAIZ, relativo), 'utf8');

const SCHEMA = 'packages/database/prisma/schema.prisma';
const ER = 'docs/diagrams/er-diagram.mermaid';
const ROTAS = 'docs/diagrams/frontend-routes.mermaid';
const SEQUENCIA = 'docs/diagrams/pipeline-sequence.mermaid';
const FLUXO = 'docs/diagrams/data-flow.mermaid';
const PIPELINE = 'apps/api/src/services/pipeline.service.ts';

/** `BriefingSource` → `BRIEFING_SOURCE`, que é como o erDiagram nomeia. */
function paraEntidade(modelo: string): string {
  return modelo.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

/** Comentário de bloco e de linha saem antes de qualquer regex sobre código. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function modelosDoSchema(): string[] {
  return [...semComentarios(ler(SCHEMA)).matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1] as string);
}

function enumsDoSchema(): string[] {
  return [...semComentarios(ler(SCHEMA)).matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1] as string);
}

/** As entidades que o próprio diagrama declara — `^    NOME {`. */
function entidadesDoDiagrama(): string[] {
  return [...ler(ER).matchAll(/^ {4}([A-Z][A-Z_]*)\s*\{/gm)].map((m) => m[1] as string);
}

/** Toda `page.tsx` sob `app/[locale]`, como rota: `/`, `/news/[id]`, … */
function rotasDoApp(): string[] {
  const base = path.join(RAIZ, 'apps/web/app/[locale]');
  const paginas: string[] = [];

  const varrer = (dir: string): void => {
    for (const entrada of readdirSync(dir)) {
      const completo = path.join(dir, entrada);
      if (statSync(completo).isDirectory()) varrer(completo);
      else if (entrada === 'page.tsx') paginas.push(completo);
    }
  };
  varrer(base);

  return paginas
    .map((arquivo) => path.relative(base, arquivo).replace(/\\/g, '/').replace(/\/?page\.tsx$/, ''))
    .map((rota) => `/${rota}`)
    .sort();
}

/**
 * As etapas que o pipeline **anuncia** — o segundo argumento de
 * `logPipelineEvent`. É o que um leitor do diagrama espera ver desenhado.
 */
function etapasAnunciadas(): string[] {
  const fonte = semComentarios(ler(PIPELINE));
  const vistas = new Set<string>();
  for (const m of fonte.matchAll(/logPipelineEvent\(\s*pipelineLogId\s*,\s*(\d+(?:\.\d+)?)\s*,/g)) {
    vistas.add(m[1] as string);
  }
  return [...vistas].sort((a, b) => Number(a) - Number(b));
}

describe('os diagramas acompanham o sistema que descrevem', () => {
  it('acha o que precisa achar — matcher vazio aprovaria tudo', () => {
    expect(modelosDoSchema()).toContain('BriefingSource');
    expect(enumsDoSchema()).toContain('FavoriteItemType');
    expect(entidadesDoDiagrama()).toContain('BRIEFING_SOURCE');
    expect(rotasDoApp()).toContain('/news/[id]');
    expect(etapasAnunciadas()).toContain('8.5');
  });

  it('o ER declara uma entidade para cada model do schema', () => {
    const esperadas = modelosDoSchema().map(paraEntidade).sort();
    expect(entidadesDoDiagrama().sort()).toEqual(esperadas);
  });

  it('o ER nomeia todos os enums do schema', () => {
    const conteudo = ler(ER);
    const ausentes = enumsDoSchema().filter((nome) => !conteudo.includes(nome));
    expect(ausentes).toEqual([]);
  });

  it('o mapa de rotas desenha toda page.tsx de app/[locale]', () => {
    const conteudo = ler(ROTAS);
    // `["` na frente separa `/newsletter` de `/account/newsletter`, que
    // `includes` sozinho confundiria.
    const ausentes = rotasDoApp().filter((rota) => !conteudo.includes(`["${rota} · `));
    expect(ausentes).toEqual([]);
  });

  it('o mapa de rotas não inventa rota que não existe', () => {
    const declaradas = [...ler(ROTAS).matchAll(/\["(\/[^"·]*?) · /g)].map((m) => m[1] as string);
    expect(declaradas.length).toBeGreaterThan(0);
    expect(declaradas.filter((rota) => !rotasDoApp().includes(rota))).toEqual([]);
  });

  it.each([SEQUENCIA, FLUXO])('%s desenha toda etapa que o pipeline anuncia', (relativo) => {
    const conteudo = ler(relativo);
    const ausentes = etapasAnunciadas().filter((etapa) => !conteudo.includes(`${etapa} · `));
    expect(ausentes).toEqual([]);
  });
});
