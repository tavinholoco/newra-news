import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ArticleBodyProps {
  /**
   * `id` do contêner, para a `ScrollDepth` medir **o corpo do texto** e não a
   * página: a tela termina em relacionadas e num CTA, e incluí-los faria "90%
   * da página" ser alcançável sem ler o último terço da matéria.
   */
  id?: string;
  /** Corpo do texto. Ver `parseArticleBody` para a sintaxe reconhecida. */
  content: string;
  /**
   * O dek já exibido acima. Quando o corpo **abre com ele**, o parágrafo sai.
   *
   * Não é defensividade: no briefing acontece **sempre**. O `summary` não é um
   * resumo escrito à parte — o `parseMarkdownResponse` o define como a primeira
   * linha não-vazia do conteúdo, então dek e lide são o mesmo texto por
   * construção, e a tela mostrava o parágrafo duas vezes seguidas. Nas notícias
   * de RSS acontece em parte do acervo.
   *
   * O conserto fica aqui e não na ingestão porque alcança **o acervo inteiro**:
   * corrigir o `parseMarkdownResponse` só arrumaria os briefings seguintes, e
   * os 90 dias retidos continuariam repetindo.
   */
  lede?: string | null;
  className?: string;
}

/** O nível de heading que um bloco recebe. `h1` é o título da página. */
export type BodyHeadingLevel = 2 | 3 | 4;

/** Uma linha do corpo já classificada. */
export type Block =
  | { kind: 'heading'; level: BodyHeadingLevel; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'rule' };

/** Um pedaço de texto com ou sem ênfase. */
export interface InlineSegment {
  text: string;
  emphasis?: 'strong' | 'em';
}

/**
 * Marcação que sobreviveu à ingestão.
 *
 * **A limpeza é da ingestão, e esta linha não a substitui.** Ela existe porque
 * o corpo é texto de terceiro e o React escapa o que recebe: uma tag que passe
 * aparece na tela **como texto**, `srcset` e tudo, que é exatamente o que 63,7%
 * do acervo mostrava antes da Fase 12. O acervo se cura pela etapa 8.5, que
 * roda uma vez por dia — esta linha cobre a janela até lá, e o dia em que um
 * veículo novo inventar um formato.
 */
const LEFTOVER_TAG = /<[^>]*>/g;

/** `- item`, `* item`, `+ item`. Lista numerada não entra — ver o cabeçalho. */
const BULLET = /^[-*+]\s+(?=\S)/;

/** `---`, `***`, `___` numa linha sozinha. */
const THEMATIC_BREAK = /^(?:-{3,}|\*{3,}|_{3,})$/;

/** `## Título`. O número de `#` é a profundidade **relativa**. */
const HEADING = /^(#{1,6})\s+(.*)$/;

/**
 * `**forte**` e `*ênfase*`, na regra do Markdown: o delimitador cola no texto.
 *
 * O `\S` das duas pontas é o que impede `3 * 4 = 12` de virar ênfase — sem ele,
 * qualquer multiplicação escrita com asterisco viraria itálico e comeria o
 * sinal.
 */
const EMPHASIS = /(\*\*)(\S(?:[^*]*\S)?)\1|(\*)(\S(?:[^*]*\S)?)\3/g;

/**
 * Quebra uma linha em pedaços com e sem ênfase.
 *
 * Devolve um segmento só quando não há marcação nenhuma, que é o caso da
 * imensa maioria das linhas.
 */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(EMPHASIS)) {
    const start = match.index;
    if (start > cursor) segments.push({ text: text.slice(cursor, start) });

    segments.push({
      text: (match[2] ?? match[4]) as string,
      emphasis: match[1] ? 'strong' : 'em',
    });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments.length > 0 ? segments : [{ text }];
}

/**
 * Quebra o corpo em blocos.
 *
 * **Continua não sendo um renderizador de Markdown, e a lista do que ele
 * entende saiu de medição — não de precaução.** A versão anterior reconhecia
 * `#` e mais nada, com uma nota dizendo que o briefing de produção só usava
 * `###`, sem negrito nem listas. **Essa medição envelheceu.** Contados os 89
 * briefings retidos, em 25/08/2026:
 *
 * | Sintaxe | Briefings que usam | O que a tela mostrava |
 * |---|---|---|
 * | `**negrito**` | **53 (60%)** | os asteriscos, literais, no meio da frase |
 * | `###` | 37 (42%) | subtítulo — funcionava |
 * | `##` | 26 (29%) | subtítulo, **no mesmo nível do `###`** |
 * | `---` | 18 (20%) | um parágrafo com três traços |
 * | `- item` | 7 (8%) | um parágrafo começando por hífen |
 * | `*ênfase*` | 3 (3%) | os asteriscos, literais |
 *
 * Não entra o que ninguém escreve: link, tabela, citação, código e lista
 * numerada deram **zero** nos 89. Quando algum aparecer, é aqui que se decide
 * de novo — com a mesma contagem.
 *
 * **O nível do heading é relativo, e é o que impede `heading-order` de
 * reprovar.** `##` e `###` não podem virar `h2` os dois (era o que acontecia,
 * e achatava a hierarquia do briefing de 25/08, que tem 6 `##` e 10 `###`),
 * mas `###` também não pode virar `h3` sempre: **39% dos briefings usam `###`
 * sem nenhum `##`**, e ali um `h3` abriria um salto a partir do `h1` do título.
 *
 * A saída é mapear as profundidades **presentes** para níveis consecutivos: a
 * mais rasa vira `h2`, a seguinte `h3`, e o teto é `h4`. **Por posição na
 * lista, e não por diferença aritmética** — um documento com `##` e `####`,
 * sem `###` no meio, daria `h2` e `h4` na subtração, que é exatamente o salto
 * que `heading-order` reprova. Há teste sobre a propriedade, não sobre os
 * casos.
 */
export function parseArticleBody(content: string, lede?: string | null): Block[] {
  const lines = content
    .split('\n')
    .map((line) => line.replace(LEFTOVER_TAG, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Passada de reconhecimento: as profundidades presentes, em ordem, viram
  // `h2`, `h3`, `h4`. É a posição na lista que decide, nunca a subtração.
  const depths = [
    ...new Set(
      lines.flatMap((line) => {
        const match = HEADING.exec(line);
        return match?.[1] ? [match[1].length] : [];
      }),
    ),
  ].sort((a, b) => a - b);

  const blocks: Block[] = [];

  for (const line of lines) {
    if (THEMATIC_BREAK.test(line)) {
      // Régua colada em régua, ou abrindo o corpo, não separa nada.
      if (blocks.length > 0 && blocks[blocks.length - 1]?.kind !== 'rule') {
        blocks.push({ kind: 'rule' });
      }
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading?.[1] && heading[2]) {
      const level = Math.min(2 + depths.indexOf(heading[1].length), 4);
      blocks.push({
        kind: 'heading',
        level: level as BodyHeadingLevel,
        text: heading[2].trim(),
      });
      continue;
    }

    if (BULLET.test(line)) {
      const item = line.replace(BULLET, '');
      const previous = blocks[blocks.length - 1];
      // Itens seguidos são uma lista só: `<ul>` por item daria sete listas de
      // um elemento, e o leitor de tela anunciaria sete vezes "lista com 1".
      if (previous?.kind === 'list') previous.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: line });
  }

  // Régua no fim não separa nada do que vem depois, porque não vem nada.
  if (blocks[blocks.length - 1]?.kind === 'rule') blocks.pop();

  const opening = lede?.trim();
  const first = blocks[0];
  if (!opening || first?.kind !== 'paragraph') return blocks;

  if (first.text === opening) return blocks.slice(1);

  /**
   * **O dek pode ser um prefixo do corpo, e não só um parágrafo igual a ele.**
   *
   * Quando o feed manda a matéria inteira num parágrafo só — o formato do Valor
   * —, a ingestão corta o dek no último fim de frase que cabe em 320
   * caracteres. O corpo então **começa** com o dek em vez de repeti-lo como
   * linha, e a comparação por igualdade não via nada: a tela mostrava aquelas
   * frases duas vezes seguidas, uma como subtítulo e outra abrindo o corpo.
   *
   * **Só corta quando o dek termina em fim de frase**, e é isso que separa esta
   * regra de comer texto. Recorte parcial não é repetição: um dek que acaba no
   * meio de uma oração ("A sexta-feira se desenha") é resumo, e tirá-lo do
   * corpo deixaria a matéria abrindo por "com um panorama complexo". A
   * fronteira de frase é justamente a garantia que o `toDek` da ingestão dá.
   */
  if (/[.!?]$/.test(opening) && first.text.startsWith(opening)) {
    const rest = first.text.slice(opening.length).trim();
    return rest.length > 0
      ? [{ kind: 'paragraph', text: rest }, ...blocks.slice(1)]
      : blocks.slice(1);
  }

  return blocks;
}

/** Há algo para ler, ou o corpo era só ornamento? Ver a `/news/[id]`. */
export function hasReadableBody(blocks: readonly Block[]): boolean {
  return blocks.some((block) => block.kind !== 'rule');
}

function Inline({ text }: { text: string }): ReactNode {
  return parseInline(text).map((segment, index) => {
    if (segment.emphasis === 'strong') {
      return (
        <strong key={index} className='font-semibold text-ink'>
          {segment.text}
        </strong>
      );
    }
    if (segment.emphasis === 'em') return <em key={index}>{segment.text}</em>;
    return <span key={index}>{segment.text}</span>;
  });
}

const HEADING_CLASS: Record<BodyHeadingLevel, string> = {
  2: 'mt-10 font-display text-h3 font-bold text-ink first:mt-0',
  3: 'mt-8 font-display text-h4 font-bold text-ink first:mt-0',
  4: 'mt-6 font-display text-body-lg font-bold text-ink first:mt-0',
};

/**
 * O corpo do artigo na medida de leitura da §8.
 *
 * `max-w-prose` são os 68ch dos tokens, dentro dos 65–75 que a §8 pede. A
 * medida não é estética: linha longa demais faz o olho perder o início da
 * seguinte, e é o defeito que a §2.2 aponta no texto corrido da V1.
 *
 * **O nível dos subtítulos vem do documento, normalizado** — ver
 * `parseArticleBody`. A regra antiga ("tudo vira `h2`") existia para não abrir
 * salto a partir do `h1`, e resolvia isso achatando a hierarquia: um briefing
 * com `##` e `###` perdia a diferença entre seção e subseção.
 */
export function ArticleBody({
  content,
  lede,
  id,
  className,
}: ArticleBodyProps) {
  const blocks = parseArticleBody(content, lede);

  return (
    <div id={id} className={cn('max-w-prose', className)}>
      {blocks.map((block, index) => {
        if (block.kind === 'rule') {
          return (
            <hr
              key={index}
              className='my-10 border-0 border-t border-line'
              aria-hidden='true'
            />
          );
        }

        if (block.kind === 'list') {
          return (
            <ul
              key={index}
              className='mt-5 list-disc space-y-2 pl-6 text-body-lg text-ink marker:text-brand-accent first:mt-0'
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === 'heading') {
          const Tag = `h${block.level}` as 'h2' | 'h3' | 'h4';
          return (
            <Tag key={index} className={HEADING_CLASS[block.level]}>
              <Inline text={block.text} />
            </Tag>
          );
        }

        return (
          <p key={index} className='mt-5 text-body-lg text-ink first:mt-0'>
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
