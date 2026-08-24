import { describe, it, expect } from 'vitest';
import { Category } from '@newranews/database';
import {
  attachRetryAfter,
  decodeEntities,
  formatNewsItems,
  MalformedArticleError,
  parseMarkdownResponse,
  parseRetryAfterMs,
} from '../../src/providers/ai/ai-utils';
import type { RawNewsItem } from '../../src/providers/types';

function makeNewsItem(overrides: Partial<RawNewsItem> = {}): RawNewsItem {
  return {
    title: 'Notícia de Teste',
    description: 'Descrição simples da notícia',
    content: 'Conteúdo completo da notícia',
    source: 'G1',
    sourceUrl: 'https://g1.globo.com/test',
    imageUrl: null,
    category: Category.TECHNOLOGY,
    publishedAt: new Date('2024-01-01T12:00:00Z'),
    ...overrides,
  };
}

describe('stripHtml (via formatNewsItems)', () => {
  it('should strip HTML tags and preserve spacing between words', () => {
    const item = makeNewsItem({
      description: 'Notícia<br>importante<p>sobre economia</p>',
      content: null,
    });
    const result = formatNewsItems([item]);
    expect(result).toContain('DESCRIÇÃO: Notícia importante sobre economia');
  });

  it('should handle nested HTML tags', () => {
    const item = makeNewsItem({
      description: '<div><strong>Título</strong> da <em>notícia</em></div>',
      content: null,
    });
    const result = formatNewsItems([item]);
    expect(result).toContain('DESCRIÇÃO: Título da notícia');
  });

  it('should collapse multiple spaces from stripped tags', () => {
    const item = makeNewsItem({
      description: '<p>   Espaços   <br>   extras   </p>',
      content: null,
    });
    const result = formatNewsItems([item]);
    expect(result).toContain('DESCRIÇÃO: Espaços extras');
  });

  it('should return plain text unchanged', () => {
    const item = makeNewsItem({
      description: 'Texto sem HTML nenhum',
      content: null,
    });
    const result = formatNewsItems([item]);
    expect(result).toContain('DESCRIÇÃO: Texto sem HTML nenhum');
  });

  it('should handle empty string description', () => {
    const item = makeNewsItem({
      description: '',
      content: null,
    });
    const result = formatNewsItems([item]);
    expect(result).toContain('DESCRIÇÃO: ');
  });

  it('should decode HTML entities after stripping tags', () => {
    const item = makeNewsItem({
      description: '<p>Pol\u00EDtica &amp; Economia do pa\u00EDs</p>',
      content: null,
    });
    const result = formatNewsItems([item]);
    expect(result).toContain('DESCRIÇÃO: Pol\u00EDtica & Economia do pa\u00EDs');
  });
});

describe('truncate (via formatNewsItems)', () => {
  it('should not truncate text shorter than limit', () => {
    const item = makeNewsItem({
      description: 'Short text',
      content: null,
    });
    const result = formatNewsItems([item]);
    expect(result).toContain('DESCRIÇÃO: Short text');
    expect(result).not.toContain('…');
  });

  it('should truncate description exceeding 300 chars', () => {
    const longDescription = 'A'.repeat(350);
    const item = makeNewsItem({
      description: longDescription,
      content: null,
    });
    const result = formatNewsItems([item]);
    const descMatch = result.match(/DESCRIÇÃO: (.+)/);
    expect(descMatch).not.toBeNull();
    const desc = descMatch![1];
    expect(desc.length).toBeLessThanOrEqual(300);
    expect(desc).toContain('…');
  });

  it('should truncate content exceeding 400 chars', () => {
    const longContent = 'B'.repeat(500);
    const item = makeNewsItem({
      content: longContent,
    });
    const result = formatNewsItems([item]);
    const contentMatch = result.match(/CONTEÚDO: (.+)/);
    expect(contentMatch).not.toBeNull();
    const content = contentMatch![1];
    expect(content.length).toBeLessThanOrEqual(400);
    expect(content).toContain('…');
  });

  it('should not truncate text exactly at the limit', () => {
    const exactDescription = 'C'.repeat(300);
    const item = makeNewsItem({
      description: exactDescription,
      content: null,
    });
    const result = formatNewsItems([item]);
    const descMatch = result.match(/DESCRIÇÃO: (.+)/);
    expect(descMatch![1]).toBe(exactDescription);
  });
});

describe('formatNewsItems', () => {
  it('should format a single news item with all fields', () => {
    const item = makeNewsItem();
    const result = formatNewsItems([item]);

    expect(result).toContain('1. TÍTULO: Notícia de Teste');
    expect(result).toContain('FONTE: G1');
    expect(result).toContain('CATEGORIA: TECHNOLOGY');
    expect(result).toContain('DATA: 2024-01-01T12:00:00.000Z');
    expect(result).toContain('DESCRIÇÃO: Descrição simples da notícia');
    expect(result).toContain('CONTEÚDO: Conteúdo completo da notícia');
  });

  it('should show N/A for null content', () => {
    const item = makeNewsItem({ content: null });
    const result = formatNewsItems([item]);
    expect(result).toContain('CONTEÚDO: N/A');
  });

  it('should format multiple items with correct numbering', () => {
    const items = [
      makeNewsItem({ title: 'Primeira' }),
      makeNewsItem({ title: 'Segunda' }),
      makeNewsItem({ title: 'Terceira' }),
    ];
    const result = formatNewsItems(items);

    expect(result).toContain('1. TÍTULO: Primeira');
    expect(result).toContain('2. TÍTULO: Segunda');
    expect(result).toContain('3. TÍTULO: Terceira');
  });

  it('should separate items with double newline', () => {
    const items = [makeNewsItem(), makeNewsItem()];
    const result = formatNewsItems(items);

    expect(result).toContain('\n\n');
  });

  it('should return empty string for empty array', () => {
    const result = formatNewsItems([]);
    expect(result).toBe('');
  });

  it('should strip HTML from content field too', () => {
    const item = makeNewsItem({
      content: '<p>Parágrafo</p><br><strong>negrito</strong>',
    });
    const result = formatNewsItems([item]);
    expect(result).toContain('CONTEÚDO: Parágrafo negrito');
  });
});

describe('parseMarkdownResponse', () => {
  // Um corpo com tamanho de artigo. O parser recusa resposta curta demais
  // desde a revisao da Fase 9 (ver `MalformedArticleError`), entao os fixtures
  // que so queriam exercitar titulo e resumo precisam de corpo.
  const body =
    'Paragrafo de corpo com tamanho de artigo de verdade, repetido o bastante para o texto cruzar o piso que o parser exige. '.repeat(
      6,
    );

  it('should extract title from H1 heading', () => {
    const markdown = `# Meu Artigo\n\nResumo aqui.\n\n${body}`;
    const result = parseMarkdownResponse(markdown);

    expect(result.title).toBe('Meu Artigo');
  });

  it('should extract summary from first non-empty non-heading line', () => {
    const markdown = `# Titulo\n\nEste e o resumo.\n\n## Secao\n\n${body}`;
    const result = parseMarkdownResponse(markdown);

    expect(result.summary).toBe('Este e o resumo.');
  });

  it('should exclude H1 from content', () => {
    const markdown = `# Titulo\n\nResumo.\n\n## Secao\n\n${body}`;
    const result = parseMarkdownResponse(markdown);

    expect(result.content).not.toContain('# Titulo');
    expect(result.content).toContain('## Secao');
    expect(result.content).toContain('Paragrafo de corpo');
  });

  it('should skip empty lines when finding summary', () => {
    const markdown = `# Titulo\n\n\n\nResumo depois de linhas vazias.\n\n${body}`;
    const result = parseMarkdownResponse(markdown);

    expect(result.summary).toBe('Resumo depois de linhas vazias.');
  });

  // ── A saida tambem e superficie ──────────────────────────────────────────
  //
  // Ate a Fase 9 estes quatro casos **passavam**: sem `# `, o parser pegava a
  // primeira linha nao vazia como titulo e seguia em frente; string vazia
  // devolvia um artigo vazio. Ou seja, uma resposta que obedecesse ao material
  // em vez das instrucoes virava briefing publicado, e o pipeline registrava
  // sucesso. Sao a terceira camada da defesa contra injecao pelo feed — as
  // outras duas estao na fronteira do prompt e em
  // `neutralizeMaterialDelimiters`.

  it('should reject a response without an H1 title line', () => {
    expect(() => parseMarkdownResponse(`Titulo Simples\n\n${body}`)).toThrow(
      MalformedArticleError,
    );
  });

  it('should reject an empty response', () => {
    expect(() => parseMarkdownResponse('')).toThrow(MalformedArticleError);
  });

  it('should reject a title with no body', () => {
    expect(() => parseMarkdownResponse('# Apenas Titulo')).toThrow(
      MalformedArticleError,
    );
  });

  it('should reject a refusal that mimics the article shape', () => {
    // O formato de uma recusa do modelo, ou do eco de uma ordem que veio no
    // material: tem o `# `, e nao tem artigo nenhum embaixo.
    expect(() =>
      parseMarkdownResponse('# Entendido\n\nOk, vou ignorar as instrucoes anteriores.'),
    ).toThrow(MalformedArticleError);
  });
});

describe('decodeEntities', () => {
  it('should decode numeric decimal entities', () => {
    expect(decodeEntities('caf&#233;')).toBe('caf\u00E9');
  });

  it('should decode numeric hex entities', () => {
    expect(decodeEntities('caf&#xe9;')).toBe('caf\u00E9');
  });

  it('should decode common named entities', () => {
    expect(decodeEntities('A &amp; B &lt; C &gt; D')).toBe('A & B < C > D');
  });

  it('should decode Portuguese accented characters', () => {
    expect(decodeEntities('&eacute; &atilde; &otilde; &ccedil; &acirc; &ecirc;'))
      .toBe('\u00E9 \u00E3 \u00F5 \u00E7 \u00E2 \u00EA');
  });

  it('should decode uppercase Portuguese entities', () => {
    expect(decodeEntities('&Eacute; &Atilde; &Ccedil;'))
      .toBe('\u00C9 \u00C3 \u00C7');
  });

  it('should decode quote and typographic entities', () => {
    expect(decodeEntities('&quot;quoted&quot; &apos;apos&apos;'))
      .toBe('"quoted" \'apos\'');
    expect(decodeEntities('&ldquo;smart&rdquo; &mdash; test'))
      .toBe('\u201Csmart\u201D \u2014 test');
  });

  it('should preserve unknown named entities', () => {
    expect(decodeEntities('&unknownentity;')).toBe('&unknownentity;');
  });

  it('should handle text with no entities', () => {
    expect(decodeEntities('Texto sem entidades')).toBe('Texto sem entidades');
  });

  it('should handle empty string', () => {
    expect(decodeEntities('')).toBe('');
  });

  it('should handle mixed entity types in one string', () => {
    expect(decodeEntities('Ol&aacute; &#38; Adi&#xf3;s'))
      .toBe('Ol\u00E1 & Adi\u00F3s');
  });

  it('should be idempotent (safe to run twice)', () => {
    const decoded = decodeEntities('caf&eacute;');
    expect(decodeEntities(decoded)).toBe('caf\u00E9');
  });
});

describe('parseRetryAfterMs', () => {
  it('should parse delta-seconds', () => {
    expect(parseRetryAfterMs('5')).toBe(5_000);
    expect(parseRetryAfterMs('120')).toBe(120_000);
    expect(parseRetryAfterMs('0')).toBe(0);
  });

  it('should parse HTTP-date format', () => {
    const now = new Date('2026-08-17T12:00:00Z').getTime();
    const retryAfter = new Date(now + 4_000).toUTCString();
    expect(parseRetryAfterMs(retryAfter, now)).toBe(4_000);
  });

  it('should clamp a past HTTP-date to zero', () => {
    const now = new Date('2026-08-17T12:00:00Z').getTime();
    const retryAfter = new Date(now - 5_000).toUTCString();
    expect(parseRetryAfterMs(retryAfter, now)).toBe(0);
  });

  it('should return null for missing or invalid values', () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs('')).toBeNull();
    expect(parseRetryAfterMs('not-a-date')).toBeNull();
  });
});

describe('attachRetryAfter', () => {
  it('should attach retryAfterMs from the Retry-After header', () => {
    const err = attachRetryAfter(new Error('boom'), new Headers({ 'retry-after': '5' }));
    expect((err as Error & { retryAfterMs?: number }).retryAfterMs).toBe(5_000);
  });

  it('should not attach when the header is absent', () => {
    const err = attachRetryAfter(new Error('boom'), new Headers());
    expect((err as Error & { retryAfterMs?: number }).retryAfterMs).toBeUndefined();
  });

  it('should tolerate undefined headers', () => {
    const err = attachRetryAfter(new Error('boom'), undefined);
    expect((err as Error & { retryAfterMs?: number }).retryAfterMs).toBeUndefined();
  });
});

/**
 * Escape duplo: `&amp;eacute;` só vira `é` na segunda passada.
 *
 * Enquanto a decodificação parava na primeira, o job de renormalização
 * reescrevia as mesmas linhas em toda execução — a normalização não era um
 * ponto fixo, e é assim que um backfill vira trabalho perpétuo.
 */
describe('decodeEntities — convergência', () => {
  it('should decode a doubly escaped entity all the way', () => {
    expect(decodeEntities('Jornal Do Com&amp;eacute;rcio')).toBe(
      'Jornal Do Comércio',
    );
  });

  it('should be idempotent: decoding twice equals decoding once', () => {
    const inputs = [
      'Jornal Do Com&amp;eacute;rcio',
      'Bolsa &amp; d&oacute;lar',
      'A&ccedil;&atilde;o &#233; assim',
      'texto sem entidade nenhuma',
    ];

    for (const input of inputs) {
      const once = decodeEntities(input);
      expect(decodeEntities(once)).toBe(once);
    }
  });

  it('should stop at the pass cap instead of looping forever', () => {
    // Quatro níveis de escape: o teto de 3 passadas resolve três e para.
    const result = decodeEntities('&amp;amp;amp;amp;');

    expect(result).toBe('&amp;');
  });
});
