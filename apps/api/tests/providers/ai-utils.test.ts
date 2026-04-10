import { describe, it, expect } from 'vitest';
import { Category } from '@newranews/database';
import { formatNewsItems, parseMarkdownResponse } from '../../src/providers/ai/ai-utils';
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
