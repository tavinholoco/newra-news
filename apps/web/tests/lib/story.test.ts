import { describe, it, expect } from 'vitest';
import { Category, type News } from '@newranews/types';
import { newsToStory } from '@/lib/story';

const news: News = {
  id: 'a0000000-0000-0000-0000-000000000001',
  title: 'Título',
  description: 'Resumo da matéria',
  content: null,
  source: 'G1',
  sourceUrl: 'https://g1.com/x',
  imageUrl: null,
  category: Category.SPORTS,
  publishedAt: '2024-01-15T10:00:00.000Z',
  createdAt: '2024-01-15T10:05:00.000Z',
  updatedAt: '2024-01-15T10:05:00.000Z',
};

describe('newsToStory', () => {
  it('should carry the description over as the dek', () => {
    expect(newsToStory(news).dek).toBe('Resumo da matéria');
  });

  it('should turn an empty description into null, not an empty dek', () => {
    // O card decide *se* desenha o dek pela ausência; string vazia deixaria um
    // parágrafo de altura zero entre a manchete e a metadata.
    expect(newsToStory({ ...news, description: '' }).dek).toBeNull();
  });

  it('should prefer the content over the description for reading time', () => {
    const content = Array.from({ length: 400 }, () => 'palavra').join(' ');
    expect(newsToStory({ ...news, content }).readingTimeMinutes).toBe(2);
  });

  it('should fall back to the description when there is no content', () => {
    // Cerca de um terço do acervo vem do RSS só com o resumo.
    expect(newsToStory(news).readingTimeMinutes).toBe(1);
  });

  it('should return null, not zero, when there is no text at all', () => {
    const story = newsToStory({ ...news, content: null, description: '' });
    expect(story.readingTimeMinutes).toBeNull();
  });

  it('should not infer the positional flags', () => {
    const story = newsToStory(news);
    expect(story.isFeatured).toBeUndefined();
    expect(story.isTrending).toBeUndefined();
  });
});
