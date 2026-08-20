import { describe, it, expect } from 'vitest';
import {
  readingTimeMinutes,
  toEditorialStory,
} from '../../src/services/editorial.mapper';

const AT = new Date('2026-08-20T12:00:00.000Z');

const NEWS = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  title: 'Titulo',
  description: 'Descricao da noticia',
  content: null as string | null,
  source: 'G1',
  sourceUrl: 'https://g1.globo.com/x',
  imageUrl: null as string | null,
  category: 'ECONOMY' as const,
  publishedAt: AT,
  createdAt: AT,
  updatedAt: AT,
};

describe('readingTimeMinutes', () => {
  it('should round up to the next full minute', () => {
    expect(readingTimeMinutes(Array(201).fill('palavra').join(' '))).toBe(2);
    expect(readingTimeMinutes(Array(200).fill('palavra').join(' '))).toBe(1);
  });

  it('should return null, not zero, when there is nothing to read', () => {
    // Zero minutos e uma afirmacao; ausencia de conteudo e outra coisa. Um
    // terco do acervo vem de RSS so com o resumo.
    expect(readingTimeMinutes(null)).toBeNull();
    expect(readingTimeMinutes(undefined)).toBeNull();
    expect(readingTimeMinutes('   ')).toBeNull();
  });

  it('should use the first candidate that has text', () => {
    expect(readingTimeMinutes(null, 'duas palavras')).toBe(1);
    expect(readingTimeMinutes('', '  ', 'texto')).toBe(1);
  });
});

describe('toEditorialStory', () => {
  it('should rename description to dek', () => {
    expect(toEditorialStory(NEWS).dek).toBe('Descricao da noticia');
  });

  it('should turn an empty description into null rather than an empty string', () => {
    expect(toEditorialStory({ ...NEWS, description: '' }).dek).toBeNull();
  });

  it('should prefer content over the dek for reading time', () => {
    const long = Array(400).fill('palavra').join(' ');
    expect(toEditorialStory({ ...NEWS, content: long }).readingTimeMinutes).toBe(2);
    expect(toEditorialStory(NEWS).readingTimeMinutes).toBe(1);
  });

  it('should emit ISO strings for the dates', () => {
    const story = toEditorialStory(NEWS);
    expect(story.publishedAt).toBe('2026-08-20T12:00:00.000Z');
    expect(story.updatedAt).toBe('2026-08-20T12:00:00.000Z');
  });

  it('should omit the position flags unless they are true', () => {
    // Mandar `false` em toda materia triplicaria o ruido sem dizer nada que a
    // ausencia ja nao diga.
    const plain = toEditorialStory(NEWS);
    expect('isFeatured' in plain).toBe(false);
    expect('isTrending' in plain).toBe(false);

    const featured = toEditorialStory(NEWS, { isFeatured: true });
    expect(featured.isFeatured).toBe(true);
    expect('isTrending' in featured).toBe(false);
  });
});
