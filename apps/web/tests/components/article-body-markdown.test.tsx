import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import {
  ArticleBody,
  hasReadableBody,
  parseArticleBody,
  parseInline,
} from '@/components/editorial/article-body';
import { renderWithIntl } from '@/tests/utils';

/**
 * A sintaxe que o modelo realmente escreve, e que a tela mostrava como
 * caractere.
 *
 * **Contado sobre os 89 briefings retidos, em 25/08/2026** — a nota antiga do
 * componente dizia que o corpo só tinha `###`, sem negrito nem listas, e essa
 * medição tinha envelhecido:
 *
 * | Sintaxe | Briefings | O que aparecia na tela |
 * |---|---|---|
 * | `**negrito**` | 53 (60%) | os asteriscos, no meio da frase |
 * | `###` | 37 (42%) | subtítulo — funcionava |
 * | `##` | 26 (29%) | subtítulo, no mesmo nível do `###` |
 * | `---` | 18 (20%) | um parágrafo com três traços |
 * | `- item` | 7 (8%) | um parágrafo começando por hífen |
 * | `*ênfase*` | 3 (3%) | os asteriscos |
 *
 * Link, tabela, citação, código e lista numerada deram **zero** nos 89, e por
 * isso não são reconhecidos. Há teste afirmando isso — a lista do que o
 * renderizador entende é medida, não precavida.
 */
describe('parseInline', () => {
  it('should read the bold the model writes mid-sentence', () => {
    // Caso real do briefing de 25/08.
    expect(
      parseInline('foi, segundo a BBC, o **mais esvaziado desde 1989**.'),
    ).toEqual([
      { text: 'foi, segundo a BBC, o ' },
      { text: 'mais esvaziado desde 1989', emphasis: 'strong' },
      { text: '.' },
    ]);
  });

  it('should read single-asterisk emphasis', () => {
    expect(parseInline('o relatório *preliminar* aponta')).toEqual([
      { text: 'o relatório ' },
      { text: 'preliminar', emphasis: 'em' },
      { text: ' aponta' },
    ]);
  });

  it('should not turn a multiplication into emphasis', () => {
    // O delimitador precisa colar no texto, como manda o Markdown. Sem isso,
    // qualquer conta escrita com asterisco vira itálico e come o sinal.
    const text = 'o índice subiu 3 * 4 pontos no mês * seguinte';

    expect(parseInline(text)).toEqual([{ text }]);
  });

  it('should return the line whole when there is no markup', () => {
    const text = 'Uma frase inteiramente sem marcação.';

    expect(parseInline(text)).toEqual([{ text }]);
  });

  it('should handle several bold runs in one line', () => {
    expect(parseInline('**um** e **dois**')).toEqual([
      { text: 'um', emphasis: 'strong' },
      { text: ' e ' },
      { text: 'dois', emphasis: 'strong' },
    ]);
  });
});

describe('parseArticleBody — a hierarquia dos subtítulos', () => {
  it('should map ## to h2 and ### to h3 when both are present', () => {
    // O briefing de 25/08 tem 6 `##` e 10 `###`, e a regra antiga achatava os
    // dois em `h2` — a diferença entre seção e subseção sumia.
    const blocks = parseArticleBody(
      '## O Debate da Band\n### O que aconteceu\nTexto.\n### Relevância\nTexto.',
    );

    expect(blocks).toEqual([
      { kind: 'heading', level: 2, text: 'O Debate da Band' },
      { kind: 'heading', level: 3, text: 'O que aconteceu' },
      { kind: 'paragraph', text: 'Texto.' },
      { kind: 'heading', level: 3, text: 'Relevância' },
      { kind: 'paragraph', text: 'Texto.' },
    ]);
  });

  it('should map ### to h2 when it is the shallowest in the document', () => {
    // 39% dos briefings são assim. `h3` aqui abriria salto a partir do `h1`.
    const blocks = parseArticleBody('### Um\nTexto.\n### Dois\nTexto.');

    expect(blocks.filter((b) => b.kind === 'heading')).toEqual([
      { kind: 'heading', level: 2, text: 'Um' },
      { kind: 'heading', level: 2, text: 'Dois' },
    ]);
  });

  it('should never go deeper than h4', () => {
    const blocks = parseArticleBody('# A\n## B\n### C\n#### D\n##### E');

    expect(blocks.map((b) => (b.kind === 'heading' ? b.level : null))).toEqual([
      2, 3, 4, 4, 4,
    ]);
  });

  it('should never emit a heading level that skips one', () => {
    // A propriedade que o `heading-order` do Lighthouse mede, e que já reprovou
    // duas vezes neste projeto. Vale para qualquer combinação de profundidades.
    for (const body of [
      '## A\n### B',
      '### A\n#### B',
      '#### A\n##### B',
      '## A\n#### B',
      '### A\nTexto\n### B',
    ]) {
      const levels = parseArticleBody(body).flatMap((b) =>
        b.kind === 'heading' ? [b.level] : [],
      );

      expect(levels[0], body).toBe(2);
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i]! - levels[i - 1]!, body).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('parseArticleBody — listas e régua', () => {
  it('should gather consecutive bullets into one list', () => {
    // `<ul>` por item daria listas de um elemento, e o leitor de tela
    // anunciaria "lista com 1" a cada linha.
    const blocks = parseArticleBody('Abertura.\n- Primeiro\n- Segundo\n- Terceiro');

    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'Abertura.' },
      { kind: 'list', items: ['Primeiro', 'Segundo', 'Terceiro'] },
    ]);
  });

  it('should start a new list after a paragraph breaks the run', () => {
    const blocks = parseArticleBody('- Um\nTexto no meio.\n- Dois');

    expect(blocks).toEqual([
      { kind: 'list', items: ['Um'] },
      { kind: 'paragraph', text: 'Texto no meio.' },
      { kind: 'list', items: ['Dois'] },
    ]);
  });

  it('should not read a numbered line as a list', () => {
    // Lista numerada deu zero nos 89 briefings; o que existe é `## 1. Título`,
    // que é heading. Reconhecer o que ninguém escreve é adivinhar.
    expect(parseArticleBody('1. Primeiro item')).toEqual([
      { kind: 'paragraph', text: '1. Primeiro item' },
    ]);
  });

  it('should turn --- into a rule', () => {
    expect(parseArticleBody('Antes.\n---\nDepois.')).toEqual([
      { kind: 'paragraph', text: 'Antes.' },
      { kind: 'rule' },
      { kind: 'paragraph', text: 'Depois.' },
    ]);
  });

  it('should drop a rule that separates nothing', () => {
    expect(parseArticleBody('---\nTexto.\n---\n---\nMais.\n---')).toEqual([
      { kind: 'paragraph', text: 'Texto.' },
      { kind: 'rule' },
      { kind: 'paragraph', text: 'Mais.' },
    ]);
  });
});

describe('parseArticleBody — o que ele deliberadamente não entende', () => {
  it('should leave a link, a table, a quote and code as plain text', () => {
    // Os quatro deram zero nos 89 briefings. Quando algum aparecer, é a
    // contagem que decide de novo — não a precaução.
    expect(parseArticleBody('[texto](https://exemplo.com)')).toEqual([
      { kind: 'paragraph', text: '[texto](https://exemplo.com)' },
    ]);
    expect(parseArticleBody('| a | b |')).toEqual([
      { kind: 'paragraph', text: '| a | b |' },
    ]);
    expect(parseArticleBody('> uma citação')).toEqual([
      { kind: 'paragraph', text: '> uma citação' },
    ]);
  });
});

describe('hasReadableBody', () => {
  it('should say no when all that is left is ornament', () => {
    expect(hasReadableBody([])).toBe(false);
    expect(hasReadableBody([{ kind: 'rule' }])).toBe(false);
  });

  it('should say yes for anything with words in it', () => {
    expect(hasReadableBody([{ kind: 'paragraph', text: 'Texto.' }])).toBe(true);
    expect(hasReadableBody([{ kind: 'list', items: ['Um'] }])).toBe(true);
  });
});

describe('ArticleBody — o que sai no HTML', () => {
  it('should render bold as strong, not as asterisks on screen', () => {
    renderWithIntl(
      <ArticleBody content='O debate foi o **mais esvaziado desde 1989**.' />,
    );

    expect(screen.getByText('mais esvaziado desde 1989').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it('should render the two heading levels as h2 and h3', () => {
    renderWithIntl(
      <ArticleBody content={'## Seção\n### Subseção\nTexto.'} />,
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Seção');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Subseção',
    );
  });

  it('should render bullets as a real list', () => {
    renderWithIntl(<ArticleBody content={'- Um\n- Dois'} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('should hide the rule from the accessibility tree', () => {
    const { container } = renderWithIntl(
      <ArticleBody content={'Antes.\n---\nDepois.'} />,
    );

    const rule = container.querySelector('hr');
    expect(rule).not.toBeNull();
    expect(rule).toHaveAttribute('aria-hidden', 'true');
  });
});
