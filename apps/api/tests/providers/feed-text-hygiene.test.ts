import { describe, it, expect } from 'vitest';
import {
  extractImageFromHtml,
  htmlToText,
  isPlaceholderText,
  sanitizeContent,
  sanitizeDescription,
  splitDekAndBody,
  stripPublisherBoilerplate,
  toDek,
} from '../../src/providers/news/feed-text';

/**
 * A higiene que o `content` nunca teve, e o que ela custou.
 *
 * **Todo corpo destes testes veio do acervo de produção em 25/08/2026, colado
 * como estava.** Um caso inventado prova que a função faz o que quem a escreveu
 * quis; estes provam que ela faz o que o feed manda — e o feed é quem decide,
 * porque são 114 fontes e nenhuma delas combinou nada com este projeto.
 *
 * O que a varredura das 6.669 linhas mediu, e o que cada bloco aqui cobre:
 *
 * | Defeito | Alcance | Bloco |
 * |---|---|---|
 * | tag HTML no corpo | 63,7% | `htmlToText` |
 * | corpo abrindo com `<img>` | 51,9% | `htmlToText` |
 * | "Trecho" com corpo vazio | 23,2% | `sanitizeContent` |
 * | aviso de paywall no texto | 7,3% | `stripPublisherBoilerplate` |
 * | rodapé de WordPress | 3,9% | `stripPublisherBoilerplate` |
 * | a palavra `null` como texto | 158 linhas | `isPlaceholderText` |
 * | foto escondida dentro do corpo | 107 linhas | `extractImageFromHtml` |
 */
describe('htmlToText', () => {
  it('should keep the paragraphs the publisher wrote', () => {
    // Achatar tudo num espaço só entrega um parágrafo de três mil caracteres,
    // e a tela de leitura desenha exatamente isso.
    expect(htmlToText('<p>Primeira.</p>\n<p>Segunda.</p>')).toBe(
      'Primeira.\nSegunda.',
    );
    expect(htmlToText('Uma linha<br />Outra linha')).toBe(
      'Uma linha\nOutra linha',
    );
  });

  it('should drop the InfoMoney post image, srcset and all', () => {
    const raw =
      '<p><img width="300" height="167" src="https://www.infomoney.com.br/wp-content/uploads/2025/02/foto.jpg?fit=300%2C167" class="attachment-medium size-medium wp-post-image" alt="" style="float:right; margin:0 0 10px 10px;" decoding="async" srcset="https://www.infomoney.com.br/wp-content/uploads/2025/02/foto.jpg?w=1080 1080w" />Departamento de Estado deve anunciar o cancelamento.</p>';

    expect(htmlToText(raw)).toBe(
      'Departamento de Estado deve anunciar o cancelamento.',
    );
  });

  it('should drop the G1 lead image and keep its caption on its own line', () => {
    const raw =
      '   <img src="https://s2-g1.glbimg.com/foto.jpg" /><br />     Suspeito chorou no velório (Vídeo: Gabriel Vital)\nO empresário esteve no velório da vítima no Ceará.';

    expect(htmlToText(raw)).toBe(
      'Suspeito chorou no velório (Vídeo: Gabriel Vital)\nO empresário esteve no velório da vítima no Ceará.',
    );
  });

  it('should unescape the HTML Folha ships escaped inside description', () => {
    // A Folha manda a marcação escapada no XML. Sem decodificar antes de tirar
    // as tags, ela sobrevive como texto visível na tela.
    expect(
      htmlToText(
        'Havia um outdoor na costa da &lt;a href="https://x.com/v"&gt;Venezuela&lt;/a&gt; com uma foto.',
      ),
    ).toBe('Havia um outdoor na costa da Venezuela com uma foto.');
  });

  it('should decode the entities that only surface once the tags are gone', () => {
    expect(htmlToText('<p>balan&ccedil;o da Nvidia&#8217;s</p>')).toBe(
      'balanço da Nvidia’s',
    );
  });

  it('should take the content of script and style with them', () => {
    expect(
      htmlToText('<style>.a{color:red}</style><p>Texto.</p><script>x()</script>'),
    ).toBe('Texto.');
  });
});

describe('stripPublisherBoilerplate', () => {
  it('should drop the WordPress footer in its three shapes', () => {
    expect(
      stripPublisherBoilerplate(
        'Índices futuros dos EUA avançam.\nThe post Ibovespa Hoje Ao Vivo appeared first on InfoMoney.',
      ),
    ).toBe('Índices futuros dos EUA avançam.');

    expect(
      stripPublisherBoilerplate(
        'RPG protagonizado por Ciri não aparecerá na Gamescom.\nO post The Witcher 4 mira lançamento apareceu primeiro em Olhar Digital.',
      ),
    ).toBe('RPG protagonizado por Ciri não aparecerá na Gamescom.');

    expect(
      stripPublisherBoilerplate(
        'Os níveis de testosterona não são afetados.\nThe post A masturbação interfere na testosterona? first appeared on Portal Drauzio Varella.',
      ),
    ).toBe('Os níveis de testosterona não são afetados.');
  });

  it('should drop the Valor paywall notice wherever it sits', () => {
    expect(
      stripPublisherBoilerplate(
        'O preço do minério fechou em leve queda.\nMatéria exclusiva para assinantes. Para ter acesso completo, acesse o link da matéria e faça o seu cadastro.',
      ),
    ).toBe('O preço do minério fechou em leve queda.');
  });

  it('should keep the reporter writing "leia mais"', () => {
    // A varredura de 25/08 achou dezenas destas, e elas são texto de matéria.
    // Uma regra por padrão comeria jornalismo junto com a chamada do CMS.
    const body =
      'O acidente foi na madrugada. Leia mais notícias no g1 Paraná.\nA perícia segue em andamento. Saiba mais aqui.';

    expect(stripPublisherBoilerplate(body)).toBe(body);
  });

  it('should not eat a story that is about a post appearing somewhere', () => {
    // O rodapé só é rodapé quando abre a linha e fecha em "appeared first on".
    const body = 'A denúncia diz que the post foi publicado sem autorização.';

    expect(stripPublisherBoilerplate(body)).toBe(body);
  });
});

describe('isPlaceholderText', () => {
  it('should recognise the literal null the ESPN feed ships', () => {
    // O feed dela põe a palavra dentro do CDATA da descrição, em todos os
    // itens — 158 no acervo de 25/08. Não é o `null` de JavaScript: são quatro
    // letras que viajavam até a tela.
    expect(isPlaceholderText('null')).toBe(true);
    expect(isPlaceholderText(' NULL ')).toBe(true);
    expect(isPlaceholderText('N/A')).toBe(true);
    expect(isPlaceholderText('-')).toBe(true);
    expect(isPlaceholderText('')).toBe(true);
    expect(isPlaceholderText(null)).toBe(true);
  });

  it('should not swallow a story that merely mentions null', () => {
    expect(isPlaceholderText('Ponteiro null derruba o sistema')).toBe(false);
    expect(isPlaceholderText('Nulo')).toBe(false);
  });
});

describe('sanitizeContent', () => {
  it('should return null when the body is only the dek repeated', () => {
    // 23,2% do acervo. A tela deduplica o primeiro parágrafo contra o dek
    // exibido acima, e desenhava o rótulo "Trecho" com uma caixa vazia embaixo.
    const dek = 'Airbound ultra-lightweight approach has attracted backing.';

    expect(sanitizeContent(dek, dek)).toBeNull();
    expect(sanitizeContent(`<p>${dek}</p>`, dek)).toBeNull();
  });

  it('should return null for the ESPN body', () => {
    expect(sanitizeContent('null', '')).toBeNull();
  });

  it('should return null when nothing survives the cleaning', () => {
    expect(
      sanitizeContent('<p><img src="https://x.com/a.jpg" /></p>', ''),
    ).toBeNull();
    expect(sanitizeContent(null, 'dek')).toBeNull();
  });

  it('should keep a real excerpt, without the tags or the footer', () => {
    const raw =
      '<p><img width="300" src="https://www.infomoney.com.br/foto.jpg" /></p>\n<p>Departamento de Estado deve anunciar nas próximas semanas o cancelamento de até 200 mil documentos.</p>\n<p>The post EUA preparam a maior revogação appeared first on <a href="https://www.infomoney.com.br">InfoMoney</a>.</p>';

    expect(sanitizeContent(raw, 'Um dek diferente')).toBe(
      'Departamento de Estado deve anunciar nas próximas semanas o cancelamento de até 200 mil documentos.',
    );
  });

  it('should compare against the sanitised dek, not the raw one', () => {
    // As duas pontas carregam o mesmo rodapé de WordPress; comparar antes de
    // removê-lo faria dois textos iguais parecerem diferentes, e o corpo
    // redundante voltaria para a tela.
    const dek = 'Índices futuros dos EUA avançam à espera de balanço.';
    const raw = `<p>${dek} </p>\n<p>The post Ibovespa Hoje appeared first on InfoMoney.</p>`;

    expect(sanitizeContent(raw, dek)).toBeNull();
  });

  it('should be idempotent: cleaning a clean body changes nothing', () => {
    // A etapa 8.5 do pipeline roda todo dia sobre o acervo inteiro. Se a
    // higiene não convergisse, ela reescreveria as mesmas linhas para sempre —
    // que é o defeito que o `decodeEntities` já teve com escape duplo.
    const once = sanitizeContent(
      '<p>Texto de verdade, com corpo.</p>\n<p>Segundo parágrafo.</p>',
      'dek',
    );

    expect(once).not.toBeNull();
    expect(sanitizeContent(once, 'dek')).toBe(once);
  });
});

describe('extractImageFromHtml', () => {
  it('should recover the InfoMoney post image the extractor never looked for', () => {
    const raw =
      '<p><img width="300" height="167" src="https://www.infomoney.com.br/wp-content/uploads/2025/02/foto.jpg?fit=300%2C167" class="wp-post-image" srcset="https://www.infomoney.com.br/outra.jpg 1080w" />Texto.</p>';

    expect(extractImageFromHtml(raw)).toBe(
      'https://www.infomoney.com.br/wp-content/uploads/2025/02/foto.jpg?fit=300%2C167',
    );
  });

  it('should take the first image, which is the lead one', () => {
    expect(
      extractImageFromHtml(
        '<img src="https://a.com/1.jpg" /><img src="https://a.com/2.jpg" />',
      ),
    ).toBe('https://a.com/1.jpg');
  });

  it('should refuse a src that is not absolute http', () => {
    // `next/image` precisa de origem, e o host do veículo não é o nosso.
    expect(extractImageFromHtml('<img src="/uploads/foto.jpg" />')).toBeNull();
    expect(
      extractImageFromHtml('<img src="data:image/gif;base64,R0" />'),
    ).toBeNull();
  });

  it('should return null when there is no image at all', () => {
    expect(extractImageFromHtml('<p>Só texto.</p>')).toBeNull();
    expect(extractImageFromHtml(null)).toBeNull();
  });
});

describe('sanitizeDescription, the Fase 12 additions', () => {
  it('should drop the WordPress footer that 259 rows carried', () => {
    expect(
      sanitizeDescription(
        'Índices futuros dos EUA avançam à espera de balanço de Nvidia e dados de inflação\nThe post Ibovespa Hoje Ao Vivo appeared first on InfoMoney.',
        'Ibovespa Hoje Ao Vivo',
      ),
    ).toBe(
      'Índices futuros dos EUA avançam à espera de balanço de Nvidia e dados de inflação',
    );
  });

  it('should return empty for the ESPN description', () => {
    // Vazio a tela sabe desenhar; "null" ela imprime.
    expect(
      sanitizeDescription('null', 'Flaco é o melhor jogador do Brasil?'),
    ).toBe('');
  });

  it('should strip the markup the three HTML descriptions carried', () => {
    expect(
      sanitizeDescription(
        '<p>RPG protagonizado por Ciri não aparecerá na Gamescom 2026</p>',
        'The Witcher 4 mira lançamento em 2028',
      ),
    ).toBe('RPG protagonizado por Ciri não aparecerá na Gamescom 2026');
  });
});

describe('toDek', () => {
  it('should leave a text that is already a subtitle alone', () => {
    const dek = 'Índices futuros dos EUA avançam à espera de balanço de Nvidia.';

    expect(toDek(dek)).toBe(dek);
  });

  it('should stop at the first paragraph', () => {
    // Preferir o parágrafo não é estilo: a deduplicação da tela compara o
    // começo do corpo com o dek, e um dek que termina no meio de uma frase não
    // casa com nada. É o formato da G1 — legenda da foto, depois a matéria.
    expect(
      toDek(
        'Suspeito chorou no velório dela (Vídeo: Gabriel Vital)\nO empresário Alex Leandro esteve no velório da vítima no Ceará, segundo a família.',
      ),
    ).toBe('Suspeito chorou no velório dela (Vídeo: Gabriel Vital)');
  });

  it('should cut a long single paragraph at a sentence end', () => {
    const long = `${'Uma frase de tamanho razoável sobre o assunto. '.repeat(10)}`;

    const dek = toDek(long);

    expect(dek.length).toBeLessThanOrEqual(320);
    expect(dek.endsWith('.')).toBe(true);
    expect(long.startsWith(dek)).toBe(true);
  });

  it('should fall back to a whole word when there is no punctuation to cut at', () => {
    const long = 'palavra '.repeat(80).trim();

    const dek = toDek(long);

    expect(dek.length).toBeLessThanOrEqual(321);
    expect(dek.endsWith('…')).toBe(true);
    expect(dek).not.toMatch(/palav…$/);
  });
});

describe('splitDekAndBody', () => {
  // Os três formatos que os 114 veículos do acervo produzem. Ver o cabeçalho
  // da função: a regra ingênua descartava 5.635 corpos, com máximo de 33.073
  // caracteres, porque tratava "corpo igual ao dek" como corpo redundante
  // mesmo quando o texto repetido era a matéria inteira.
  it('should keep both when the feed sends a short dek and its own excerpt', () => {
    // InfoMoney: dek curto no `description`, trecho no `content:encoded`.
    const dek = 'Departamento de Estado deve anunciar o cancelamento de vistos.';
    const body = 'A medida deve ser contestada na Justiça, segundo advogados.';

    expect(splitDekAndBody(dek, body)).toEqual({ dek, body });
  });

  it('should promote a long text with no body into the body', () => {
    // G1, Valor, Folha, BBC, Trivela: a matéria inteira nos dois campos. Aqui
    // ela chega como texto longo sem corpo, porque `sanitizeContent` já
    // reconheceu que o `content` não acrescentava nada.
    const long = `Legenda da foto do velório\n${'Parágrafo com bastante texto da matéria. '.repeat(20)}`.trim();

    const { dek, body } = splitDekAndBody(long, null);

    expect(dek).toBe('Legenda da foto do velório');
    expect(body).toBe(long);
    expect(body!.length).toBeGreaterThan(320);
  });

  it('should leave a single short sentence as a dek with no body', () => {
    // TechCrunch: uma frase só nos dois campos. Promover criaria de volta o
    // rótulo "Trecho" com uma caixa vazia embaixo.
    const one = 'We all knew it was coming. The expected valuation may surprise.';

    expect(splitDekAndBody(one, null)).toEqual({ dek: one, body: null });
  });

  it('should never lose text: everything stays reachable in the pair', () => {
    const long = `${'Texto de matéria que precisa continuar existindo. '.repeat(30)}`.trim();

    const { dek, body } = splitDekAndBody(long, null);

    expect(body).toBe(long);
    expect(long.startsWith(dek)).toBe(true);
  });

  it('should be idempotent, because stage 8.5 runs over the archive every day', () => {
    // Sem isto o job reescreveria as mesmas linhas para sempre — o defeito que
    // o `decodeEntities` já teve com escape duplo. Medido sobre as 6.669 linhas
    // de produção: zero linhas mudam na segunda passada.
    const long = `Abertura curta.\n${'Corpo da matéria com bastante texto. '.repeat(20)}`.trim();

    const once = splitDekAndBody(long, null);
    const twice = splitDekAndBody(once.dek, once.body);

    expect(twice).toEqual(once);
  });
});
