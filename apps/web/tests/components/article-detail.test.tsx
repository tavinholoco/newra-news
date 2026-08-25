import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { BriefingSource } from '@newranews/types';
import { AiDisclosure } from '@/components/editorial/ai-disclosure';
import { ArticleBody, parseArticleBody } from '@/components/editorial/article-body';
import { SourceList } from '@/components/editorial/source-list';
import { renderWithIntl } from '@/tests/utils';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function makeSource(overrides: Partial<BriefingSource> = {}): BriefingSource {
  return {
    id: 'c0000000-0000-0000-0000-000000000001',
    position: 0,
    title: 'Matéria que entrou no briefing',
    source: 'G1',
    sourceUrl: 'https://g1.globo.com/materia',
    newsId: 'a0000000-0000-0000-0000-000000000001',
    ...overrides,
  };
}

describe('parseArticleBody', () => {
  it('should turn a ### line into a heading block', () => {
    expect(parseArticleBody('### Justiça e corrupção')).toEqual([
      { kind: 'heading', text: 'Justiça e corrupção' },
    ]);
  });

  it('should drop blank lines instead of emitting empty paragraphs', () => {
    expect(parseArticleBody('Um\n\n\nDois')).toHaveLength(2);
  });

  it('should keep paragraphs in order', () => {
    expect(parseArticleBody('Abertura\n### Seção\nCorpo')).toEqual([
      { kind: 'paragraph', text: 'Abertura' },
      { kind: 'heading', text: 'Seção' },
      { kind: 'paragraph', text: 'Corpo' },
    ]);
  });

  it('should drop the opening paragraph when it repeats the dek', () => {
    // No briefing acontece sempre: `summary` é definido como a primeira linha
    // do conteúdo, então dek e lide são o mesmo texto por construção.
    const lede = 'A sexta-feira se desenha com um panorama complexo.';
    const blocks = parseArticleBody(`${lede}
### Economia
O mercado abriu.`, lede);

    expect(blocks).toEqual([
      { kind: 'heading', text: 'Economia' },
      { kind: 'paragraph', text: 'O mercado abriu.' },
    ]);
  });

  it('should keep the opening when the dek stops mid-sentence', () => {
    // Recorte parcial não é repetição: cortar aqui comeria texto que o leitor
    // ainda não viu, e a matéria abriria por "com um panorama complexo".
    const lede = 'A sexta-feira se desenha';
    const blocks = parseArticleBody(`${lede} com um panorama complexo.`, lede);

    expect(blocks).toHaveLength(1);
  });

  it('should drop a dek that is a whole-sentence prefix of the body', () => {
    // O formato do Valor: a matéria inteira num parágrafo só. A ingestão corta
    // o dek no último fim de frase que cabe em 320 caracteres, então o corpo
    // **começa** com ele em vez de repeti-lo como linha — e a comparação por
    // igualdade não via nada. A tela mostrava as mesmas frases duas vezes.
    const lede = 'O preço do minério de ferro fechou em leve queda na China.';
    const blocks = parseArticleBody(
      `${lede} O movimento acompanhou o recuo dos contratos futuros em Dalian.`,
      lede,
    );

    expect(blocks).toEqual([
      {
        kind: 'paragraph',
        text: 'O movimento acompanhou o recuo dos contratos futuros em Dalian.',
      },
    ]);
  });

  it('should strip markup that survived the ingestion', () => {
    // A limpeza é da etapa 8.5, que roda uma vez por dia. Esta linha cobre a
    // janela até ela — e o React escapa o que recebe, então uma tag que passe
    // aparece na tela como texto, `srcset` e tudo.
    const blocks = parseArticleBody(
      '<p><img src="https://x.com/a.jpg" srcset="https://x.com/b.jpg 1080w" />O corpo da matéria.</p>',
    );

    expect(blocks).toEqual([
      { kind: 'paragraph', text: 'O corpo da matéria.' },
    ]);
  });

  it('should produce no blocks when the body was only markup', () => {
    // É o que faz a `/news/[id]` esconder o rótulo "Trecho" em vez de desenhá-lo
    // sobre uma caixa vazia.
    expect(parseArticleBody('<p><img src="https://x.com/a.jpg" /></p>')).toEqual(
      [],
    );
  });

  it('should keep the opening when there is no dek to compare against', () => {
    expect(parseArticleBody('Abertura do texto.')).toHaveLength(1);
    expect(parseArticleBody('Abertura do texto.', null)).toHaveLength(1);
  });

  it('should never drop a heading, even if the dek somehow matches it', () => {
    const blocks = parseArticleBody('### Economia\nCorpo.', 'Economia');
    expect(blocks[0]).toEqual({ kind: 'heading', text: 'Economia' });
  });

  it('should not treat a mid-sentence hash as a heading', () => {
    const blocks = parseArticleBody('O item #3 da pauta');
    expect(blocks[0]!.kind).toBe('paragraph');
  });
});

describe('ArticleBody', () => {
  it('should emit the subheadings as h2, not h3', () => {
    // A IA escreve `###`, mas o nível é decisão da página: o `h1` é o título do
    // artigo, então o próximo é `h2`. `h3` aqui abriria um salto de nível.
    renderWithIntl(<ArticleBody content={'### Economia\nO mercado abriu.'} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Economia' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});

describe('SourceList', () => {
  it('should render nothing when the briefing predates the audit migration', () => {
    // Seção com título e nada dentro é pior que seção nenhuma.
    const { container } = renderWithIntl(<SourceList sources={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should link each source to the original outlet, not to /news/[id]', () => {
    // `newsId` é ponteiro fraco: o cleanup apaga `News` aos 30 dias e o briefing
    // vive 90, então o link interno daria 404 vindo da seção que existe para
    // sustentar confiança.
    renderWithIntl(<SourceList sources={[makeSource()]} />);

    const link = screen.getByRole('link', { name: /Matéria que entrou/ });
    expect(link).toHaveAttribute('href', 'https://g1.globo.com/materia');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('should number the list from 1 even though position is 0-based', () => {
    renderWithIntl(
      <SourceList
        sources={[
          makeSource({ position: 0, title: 'Primeira' }),
          makeSource({ id: 'c2', position: 1, title: 'Segunda' }),
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('1');
    expect(items[1]).toHaveTextContent('2');
  });

  it('should be an ordered list — the order is data', () => {
    const { container } = renderWithIntl(
      <SourceList sources={[makeSource()]} />,
    );
    expect(container.querySelector('ol')).toBeInTheDocument();
  });
});

describe('AiDisclosure', () => {
  const full = {
    sourceCount: 15,
    generatedAt: '2026-08-21T11:00:10.888Z',
    modelVersion: 'gemini-2.5-flash',
    promptVersion: 'v1-ebb73b75',
  };

  it('should say the text was written by AI, with the source count', () => {
    renderWithIntl(<AiDisclosure {...full} />);

    expect(screen.getByText(/inteligência artificial/i)).toHaveTextContent('15');
  });

  it('should show the model and the prompt version', () => {
    renderWithIntl(<AiDisclosure {...full} />);

    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument();
    expect(screen.getByText('v1-ebb73b75')).toBeInTheDocument();
  });

  it('should omit each audit line that is null, one by one', () => {
    // Nulo é o estado normal dos briefings anteriores a 20/08 — nada os
    // registrava e não houve backfill possível.
    renderWithIntl(
      <AiDisclosure
        sourceCount={8}
        generatedAt={null}
        modelVersion={null}
        promptVersion={null}
      />,
    );

    expect(screen.queryByText('Gerado em')).not.toBeInTheDocument();
    expect(screen.queryByText('Modelo')).not.toBeInTheDocument();
    expect(screen.queryByText('Versão do prompt')).not.toBeInTheDocument();
  });

  it('should still declare the AI authorship with no audit fields at all', () => {
    // A declaração não depende de coluna nenhuma: vale para todo briefing, e é
    // ela que sustenta a promessa do produto.
    renderWithIntl(
      <AiDisclosure
        sourceCount={8}
        generatedAt={null}
        modelVersion={null}
        promptVersion={null}
      />,
    );

    expect(screen.getByText(/inteligência artificial/i)).toBeInTheDocument();
    expect(screen.getByText(/não verifica os fatos/i)).toBeInTheDocument();
  });
});
