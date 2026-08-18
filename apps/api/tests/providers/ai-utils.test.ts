import { describe, it, expect } from 'vitest';
import { Category } from '@newranews/database';
import {
  attachRetryAfter,
  decodeEntities,
  formatNewsItems,
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
  it('should extract title from H1 heading', () => {
    const markdown = '# Meu Artigo\n\nResumo aqui.\n\nConteúdo.';
    const result = parseMarkdownResponse(markdown);

    expect(result.title).toBe('Meu Artigo');
  });

  it('should extract summary from first non-empty non-heading line', () => {
    const markdown = '# Título\n\nEste é o resumo.\n\n## Seção\n\nConteúdo.';
    const result = parseMarkdownResponse(markdown);

    expect(result.summary).toBe('Este é o resumo.');
  });

  it('should exclude H1 from content', () => {
    const markdown = '# Título\n\nResumo.\n\n## Seção\n\nConteúdo.';
    const result = parseMarkdownResponse(markdown);

    expect(result.content).not.toContain('# Título');
    expect(result.content).toContain('## Seção');
    expect(result.content).toContain('Conteúdo.');
  });

  it('should use first non-empty line as title when no H1 exists', () => {
    const markdown = 'Título Simples\n\nResumo.\n\nConteúdo.';
    const result = parseMarkdownResponse(markdown);

    expect(result.title).toBe('Título Simples');
  });

  it('should handle markdown with only a title', () => {
    const markdown = '# Apenas Título';
    const result = parseMarkdownResponse(markdown);

    expect(result.title).toBe('Apenas Título');
    expect(result.summary).toBe('');
  });

  it('should handle empty string', () => {
    const result = parseMarkdownResponse('');

    expect(result.title).toBe('');
    expect(result.summary).toBe('');
    expect(result.content).toBe('');
  });

  it('should skip empty lines when finding summary', () => {
    const markdown = '# Título\n\n\n\nResumo depois de linhas vazias.\n\nMais conteúdo.';
    const result = parseMarkdownResponse(markdown);

    expect(result.summary).toBe('Resumo depois de linhas vazias.');
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
