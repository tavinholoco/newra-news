import { cn } from '@/lib/utils';

interface ArticleBodyProps {
  /** Corpo do texto. `###` vira subtítulo; o resto vira parágrafo. */
  content: string;
  /**
   * O dek já exibido acima. Quando o corpo **abre com ele**, o parágrafo sai.
   *
   * Não é defensividade: no briefing acontece **sempre**. O `summary` não é um
   * resumo escrito à parte — o `parseMarkdownResponse` o define como a primeira
   * linha não-vazia do conteúdo, então dek e lide são o mesmo texto por
   * construção, e a tela mostrava o parágrafo duas vezes seguidas. Nas notícias
   * de RSS acontece em parte do acervo (1 em 8, medido em produção).
   *
   * O conserto fica aqui e não na ingestão porque alcança **o acervo inteiro**:
   * corrigir o `parseMarkdownResponse` só arrumaria os briefings seguintes, e
   * os 90 dias retidos continuariam repetindo.
   */
  lede?: string | null;
  className?: string;
}

/** Uma linha do corpo já classificada. */
type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string };

/**
 * Quebra o corpo em blocos.
 *
 * **Não é um renderizador de Markdown, e não deve virar um.** O corpo é medido:
 * o briefing de produção tem 5 subtítulos, todos `###`, e nenhum negrito, lista
 * ou citação. Trazer `react-markdown` para reconhecer `###` seria ~40 kB no
 * bundle da rota mais lida do produto para cobrir sintaxe que a IA não produz.
 *
 * Se o prompt passar a pedir listas ou destaques, é aqui que se decide de novo
 * — com a mesma medição, não por precaução.
 */
export function parseArticleBody(content: string, lede?: string | null): Block[] {
  const blocks = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith('#')
        ? { kind: 'heading' as const, text: line.replace(/^#+\s*/, '') }
        : { kind: 'paragraph' as const, text: line },
    );

  const opening = lede?.trim();
  const first = blocks[0];
  if (opening && first?.kind === 'paragraph' && first.text === opening) {
    return blocks.slice(1);
  }

  return blocks;
}

/**
 * O corpo do artigo na medida de leitura da §8.
 *
 * `max-w-prose` são os 68ch dos tokens, dentro dos 65–75 que a §8 pede. A
 * medida não é estética: linha longa demais faz o olho perder o início da
 * seguinte, e é o defeito que a §2.2 aponta no texto corrido da V1.
 *
 * **Os subtítulos saem como `h2`, não `h3`.** A IA escreve `###`, mas o nível
 * do heading é uma decisão da página, não do texto: o `h1` é o título do
 * artigo, então o próximo nível é `h2`. Emitir `h3` aqui abriria um salto de
 * nível — o mesmo defeito que reprovou `heading-order` em `/news` e `/article`
 * na Fase 1.
 */
export function ArticleBody({ content, lede, className }: ArticleBodyProps) {
  const blocks = parseArticleBody(content, lede);

  return (
    <div className={cn('max-w-prose', className)}>
      {blocks.map((block, index) =>
        block.kind === 'heading' ? (
          <h2
            key={index}
            className='mt-10 font-display text-h3 font-bold text-ink first:mt-0'
          >
            {block.text}
          </h2>
        ) : (
          <p key={index} className='mt-5 text-body-lg text-ink first:mt-0'>
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
