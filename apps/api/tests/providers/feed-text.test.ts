import { describe, it, expect } from 'vitest';
import {
  sanitizeDescription,
  sanitizeTitle,
} from '../../src/providers/news/feed-text';

describe('sanitizeTitle', () => {
  // Medido em produção em 21/08: um título da resposta de `/api/home` começava
  // com quebra de linha literal, e ela chegava ao HTML.
  it('should collapse the literal newline production shipped in a title', () => {
    expect(sanitizeTitle('\nAo atacar aliados, Trump desmantela alianças')).toBe(
      'Ao atacar aliados, Trump desmantela alianças',
    );
  });

  it('should collapse any run of whitespace into a single space', () => {
    expect(sanitizeTitle('  Título   com \n\t espaços  ')).toBe('Título com espaços');
  });

  it('should leave a clean title untouched', () => {
    expect(sanitizeTitle('Bitcoin sobe 8%')).toBe('Bitcoin sobe 8%');
  });
});

describe('sanitizeDescription', () => {
  const title = 'Criança de 4 anos morre após acidente; condutor não tinha CNH';

  // O caso real: a `description` do hero abria repetindo o título, seguida do
  // crédito da foto, e só então o corpo — 1.876 caracteres ao todo.
  it('should drop a first line that repeats the title, then the photo credit', () => {
    const raw = [
      title,
      'Divulgação/Polícia Civil do Maranhão',
      'Uma criança de 4 anos morreu após um acidente na MA-272.',
    ].join('\n');

    expect(sanitizeDescription(raw, title)).toBe(
      'Uma criança de 4 anos morreu após um acidente na MA-272.',
    );
  });

  it('should match the repeated title regardless of accents and spacing', () => {
    const raw = `Crianca  de 4 anos morre apos acidente; condutor nao tinha CNH\nO corpo da matéria.`;

    expect(sanitizeDescription(raw, title)).toBe('O corpo da matéria.');
  });

  it('should recognise a credit that starts with a credit word and has no slash', () => {
    const raw = 'Arquivo pessoal\nA família divulgou a nota nesta sexta.';

    expect(sanitizeDescription(raw, title)).toBe(
      'A família divulgou a nota nesta sexta.',
    );
  });

  // Conservador de propósito: as três condições valem juntas. Só "curta e sem
  // ponto final" comeria a abertura legítima de uma matéria.
  it('should keep a short first line that is neither a credit nor the title', () => {
    const raw = 'O acidente foi na madrugada\nA polícia investiga o caso.';

    expect(sanitizeDescription(raw, title)).toBe(raw);
  });

  it('should keep a line with a slash when it ends like a sentence', () => {
    const raw = 'A rodovia MA-272/BR-226 segue interditada.\nO trânsito é desviado.';

    expect(sanitizeDescription(raw, title)).toBe(raw);
  });

  it('should never strip away the entire description', () => {
    expect(sanitizeDescription(title, title)).toBe(title);
    expect(sanitizeDescription('Divulgação/PM', 'outro título')).toBe('Divulgação/PM');
  });

  it('should trim surrounding blank lines', () => {
    expect(sanitizeDescription('\n\n  Corpo da matéria.  \n\n', title)).toBe(
      'Corpo da matéria.',
    );
  });

  it('should leave a clean description untouched', () => {
    const raw = 'Investidores reagem à alta do dólar nesta sexta-feira.';

    expect(sanitizeDescription(raw, title)).toBe(raw);
  });
});
