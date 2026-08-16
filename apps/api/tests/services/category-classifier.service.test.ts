import { describe, it, expect } from 'vitest';
import { Category } from '@newranews/database';
import { classifyCategory } from '../../src/services/category-classifier.service';

describe('classifyCategory', () => {
  it('should classify TECHNOLOGY by keywords', () => {
    const category = classifyCategory(
      'Google anuncia novo smartphone com chip de inteligência artificial',
      'A empresa apresentou o aparelho em evento de tecnologia.',
    );

    expect(category).toBe(Category.TECHNOLOGY);
  });

  it('should classify POLITICS by keywords', () => {
    const category = classifyCategory(
      'Senado aprova projeto de lei com impacto nas eleições',
      'Deputados e senadores votaram a proposta em Brasília.',
    );

    expect(category).toBe(Category.POLITICS);
  });

  it('should classify ECONOMY by keywords', () => {
    const category = classifyCategory(
      'Dólar cai e Bolsa sobe com juros do Banco Central',
      'Investidores reagem à nova taxa de inflação e aos lucros das empresas.',
    );

    expect(category).toBe(Category.ECONOMY);
  });

  it('should classify SPORTS by keywords', () => {
    const category = classifyCategory(
      'Futebol: time vence clássico e assume a liderança do campeonato',
      'O clube venceu por 2 a 0 com gol no segundo tempo.',
    );

    expect(category).toBe(Category.SPORTS);
  });

  it('should classify SCIENCE by keywords', () => {
    const category = classifyCategory(
      'Cientistas anunciam nova descoberta sobre o planeta Marte',
      'Pesquisa da NASA revela dados inéditos sobre a superfície do planeta.',
    );

    expect(category).toBe(Category.SCIENCE);
  });

  it('should classify ENTERTAINMENT by keywords', () => {
    const category = classifyCategory(
      'Novo filme de estúdio famoso estreia nos cinemas com elenco premiado',
      'A série ganhou novo episódio e a cantora lançou um álbum na mesma semana.',
    );

    expect(category).toBe(Category.ENTERTAINMENT);
  });

  it('should classify HEALTH by keywords', () => {
    const category = classifyCategory(
      'Campanha de vacinação contra a dengue avança nos hospitais',
      'Médicos reforçam que pacientes com sintomas devem procurar tratamento.',
    );

    expect(category).toBe(Category.HEALTH);
  });

  it('should fall back to WORLD when no keyword matches', () => {
    const category = classifyCategory(
      'Notícia genérica de interesse geral',
      'Apenas uma descrição sem termos específicos de nenhuma área.',
    );

    expect(category).toBe(Category.WORLD);
  });

  it('should be case-insensitive', () => {
    const category = classifyCategory('FUTEBOL: CLUBE VENCE PARTIDA', 'resumo');

    expect(category).toBe(Category.SPORTS);
  });

  it('should be insensitive to accents', () => {
    const category = classifyCategory(
      'Saúde: vacinação contra a gripe começa no SUS',
      'Médicos recomendam tratamento precoce dos sintomas.',
    );

    expect(category).toBe(Category.HEALTH);
  });

  it('should give more weight to title than description', () => {
    const category = classifyCategory(
      'Futebol: time vence e assume a liderança do campeonato',
      'Enquanto isso, a bolsa cai e investidores aguardam os juros do Banco Central.',
    );

    expect(category).toBe(Category.SPORTS);
  });

  it('should classify from description alone when title is generic', () => {
    const category = classifyCategory(
      'Acompanhe ao vivo',
      'Novo estudo da universidade analisa espécies descobertas no laboratório.',
    );

    expect(category).toBe(Category.SCIENCE);
  });

  it('should count multiple occurrences of the same keyword', () => {
    const category = classifyCategory(
      'Saúde pública: saúde em primeiro lugar na saúde da população',
      'resumo',
    );

    expect(category).toBe(Category.HEALTH);
  });

  it('should use priority order to break ties', () => {
    // "pesquisa" (Science) e "tratamento" (Health) empatam em 2 pontos no título;
    // a descrição não pontua → a prioridade (Science antes de Health) decide.
    const category = classifyCategory('Pesquisa sobre tratamento', 'resumo');

    expect(category).toBe(Category.SCIENCE);
  });
});
