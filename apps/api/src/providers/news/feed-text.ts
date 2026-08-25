import { decodeEntities } from '../ai/ai-utils';

/**
 * Higiene do texto que chega dos feeds.
 *
 * O que os feeds entregam em `title`/`description` não é o que os nomes
 * sugerem. Medido na resposta de produção de 21/08:
 *
 * - um título começava com quebra de linha literal;
 * - a `description` da matéria em destaque tinha 1.876 caracteres e **abria
 *   repetindo o título palavra por palavra**, seguida do crédito da foto
 *   ("Divulgação/Polícia Civil do Maranhão") e só então do corpo.
 *
 * Isso vaza para tudo que consome o campo: o `dek` do contrato editorial, o
 * resumo dos cards e o texto que o classificador de categoria lê. Limpar na
 * ingestão é o único lugar onde se conserta uma vez.
 *
 * **A medição de 25/08/2026, contra as 6.669 linhas de produção, mostrou que o
 * `content` nunca passou por higiene nenhuma:**
 *
 * - **63,7%** carregam tag HTML, e **51,9% abrem com um `<img>`** — a tela de
 *   leitura imprimia a tag inteira como texto, `srcset` e tudo, porque o React
 *   escapa o que recebe;
 * - **23,2%** ficavam com o rótulo "Trecho" seguido de **nada**: o corpo era o
 *   dek repetido, e a tela deduplica o primeiro parágrafo;
 * - **3,9%** terminavam no rodapé de WordPress ("The post … appeared first on
 *   …"), que é chamada do veículo e não matéria;
 * - **7,3%** carregavam o aviso de paywall do Valor no meio do texto;
 * - **158** — a ESPN inteira — traziam a string `"null"`, literalmente, porque
 *   é isso que o feed dela põe dentro do `<description>`.
 */

/** Comprimento máximo de uma linha para ela ainda parecer crédito, não texto. */
const CREDIT_MAX_LENGTH = 80;

/** Como um crédito de imagem costuma começar nos veículos brasileiros. */
const CREDIT_PREFIX =
  /^(divulgacao|reproducao|foto|fotos|imagem|arquivo pessoal|credito|acervo|montagem|arte)\b/i;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Título em uma linha só.
 *
 * Colapsa qualquer corrida de espaço em branco — inclusive a quebra de linha
 * que apareceu em produção — porque um título é, por definição, uma linha.
 */
export function sanitizeTitle(raw: string): string {
  return normalizeWhitespace(raw);
}

/**
 * Uma linha é crédito de imagem/autoria?
 *
 * Três condições **juntas**, e de propósito: curta, sem pontuação final, e ou
 * com o formato `Autor/Veículo` ou começando por uma palavra de crédito. Só
 * "curta e sem ponto" comeria abertura legítima de matéria.
 */
function looksLikeCredit(line: string): boolean {
  if (line.length === 0 || line.length > CREDIT_MAX_LENGTH) return false;
  if (/[.!?:;]$/.test(line)) return false;
  return line.includes('/') || CREDIT_PREFIX.test(stripAccents(line));
}

/**
 * Descrição sem o título repetido na frente e sem a linha de crédito.
 *
 * Conservador por escolha: só remove a primeira linha quando ela **é** o
 * título, e só remove o crédito quando sobra corpo depois dele. Descrição que
 * não casa com nenhum dos dois padrões sai apenas com o espaço em branco das
 * pontas aparado.
 *
 * **Passa por `htmlToText` e pelo rodape do veiculo desde a Fase 12.** A
 * descricao chega limpa na maioria dos feeds — e o `contentSnippet`, que o
 * `rss-parser` ja entrega sem tag —, mas nao em todos: tres linhas do acervo
 * de producao tinham marcacao, e **259 terminavam no rodape "The post …
 * appeared first on …"**, que e o mesmo do corpo. Ela alimenta o dek do card,
 * a `<meta name="description">` e o texto que o classificador de categoria
 * le; deixar o rodape ali e deixa-lo nos tres.
 *
 * Devolve **string vazia** para o texto que e marcador de ausencia — a ESPN
 * manda a palavra `null` em todos os itens. Vazio a tela sabe desenhar;
 * "null" ela imprime.
 */
export function sanitizeDescription(raw: string, title: string): string {
  if (isPlaceholderText(raw)) return '';

  const lines = stripPublisherBoilerplate(htmlToText(raw))
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim());

  while (lines.length > 0 && lines[0] === '') lines.shift();

  const normalizedTitle = stripAccents(normalizeWhitespace(title)).toLowerCase();
  if (lines.length > 1) {
    const first = stripAccents(normalizeWhitespace(lines[0] as string)).toLowerCase();
    if (first === normalizedTitle) lines.shift();
  }

  while (lines.length > 0 && lines[0] === '') lines.shift();

  if (lines.length > 1 && looksLikeCredit(lines[0] as string)) lines.shift();

  const text = lines.join('\n').trim();
  return isPlaceholderText(text) ? '' : text;
}

/**
 * Onde o HTML tem quebra de bloco. Ver `htmlToText`.
 *
 * Só o **fechamento** entra, mais os dois que não fecham (`<br>`, `<li>`):
 * abrir e fechar cada parágrafo daria uma linha em branco entre todos.
 */
const BLOCK_BOUNDARY =
  /<\/(?:p|div|li|ul|ol|h[1-6]|blockquote|section|article|tr|table|figure|figcaption)\s*>|<br\s*\/?>|<li\b[^>]*>/gi;

/** Elementos cujo **conteúdo** também sai, não só a tag. */
const NON_TEXT_ELEMENT = /<(script|style|noscript)\b[\s\S]*?<\/\1\s*>/gi;

/**
 * HTML de feed vira texto legível, com os parágrafos preservados.
 *
 * **A diferença para um `replace(/<[^>]*>/g, ' ')` é a quebra de bloco.** O
 * corpo do RSS é o HTML do veículo; achatar tudo num espaço só entrega um
 * parágrafo de três mil caracteres, e a tela de leitura desenha exatamente
 * isso. Trocar o fechamento de bloco por `\n` antes de tirar o resto é o que
 * mantém a matéria com a forma que ela tinha.
 *
 * **Decodifica antes e depois.** Antes, porque parte do acervo chega com o HTML
 * escapado — a Folha manda `&lt;a href=…&gt;` dentro do `<description>`, e sem
 * decodificar primeiro a tag sobreviveria como texto visível. Depois, porque a
 * entidade que estava **dentro** do texto (`&nbsp;`, `&#8217;`) só aparece
 * quando as tags saem do caminho.
 */
export function htmlToText(raw: string): string {
  const withBreaks = decodeEntities(raw)
    .replace(NON_TEXT_ELEMENT, '\n')
    .replace(BLOCK_BOUNDARY, '\n')
    .replace(/<[^>]*>/g, '');

  return decodeEntities(withBreaks)
    // Espaço horizontal, e não `\s`: `\s` comeria a quebra recém-criada.
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

/**
 * O rodapé que o WordPress carimba em todo item do feed.
 *
 * Três formas no acervo, e as três são a mesma coisa: "The post <título>
 * appeared first on <Veículo>." (InfoMoney), "O post <título> apareceu primeiro
 * em <Veículo>." (Olhar Digital) e "The post <título> first appeared on
 * <Veículo>." (Drauzio Varella). É chamada do veículo, não matéria — e o
 * título já está no `<h1>` da tela logo acima.
 *
 * **Não exige início de linha, e a primeira versão exigia.** Ela deixava passar
 * 110 das 368 ocorrências medidas em produção, todas do mesmo formato: o feed
 * emenda o rodapé no fim do parágrafo, sem quebra — "…nem prevê punição pela
 * ausência The post Debate da Band… appeared first on InfoMoney." Quem ancora
 * o padrão é a frase de fechamento, não a posição.
 *
 * O risco de comer texto legítimo é o de uma matéria escrever "the post" e
 * "appeared first on" dentro dos mesmos 400 caracteres, em português. Não
 * aconteceu em 6.669 linhas, e há teste para os dois lados.
 */
const PUBLISHER_FOOTER =
  /(?:the|o)\s+post\b[\s\S]{0,400}?(?:appeared\s+first\s+on|apareceu\s+primeiro\s+em|first\s+appeared\s+on)[^\n]*?\./gi;

/**
 * O aviso de paywall do Valor, literal.
 *
 * **Só este, e escrito por extenso de propósito.** A varredura de 25/08 achou
 * dezenas de frases que *parecem* chamada — "Leia mais abaixo", "Leia mais
 * notícias no g1 Paraná", "Saiba mais aqui" — e elas são texto do repórter,
 * dentro da matéria. Uma regra por padrão comeria jornalismo junto. O aviso do
 * Valor é uma string fixa que o CMS injeta, e por isso é o único que dá para
 * remover sem adivinhar.
 */
const PAYWALL_NOTICE =
  /Matéria exclusiva para assinantes\.(?:\s*Para ter acesso completo[^\n]*?\.)?/gi;

export function stripPublisherBoilerplate(text: string): string {
  return text
    .replace(PUBLISHER_FOOTER, '\n')
    .replace(PAYWALL_NOTICE, ' ')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

/**
 * Texto que o feed mandou no lugar de não mandar nada.
 *
 * A ESPN Brasil escreve `<description><![CDATA[null]]></description>` em todos
 * os itens — 158 no acervo de 25/08 —, e o valor viajava inteiro até a tela: o
 * dek do card dizia "null" e o corpo da matéria também. `undefined`, `N/A` e o
 * travessão solto entram pela mesma porta.
 *
 * **Não é defensividade contra `null` de JavaScript**: o campo é `string`, e o
 * que está gravado ali são quatro letras.
 */
const PLACEHOLDER_TEXT = /^(?:null|undefined|nil|none|n\/?a|-{1,3}|\.{1,3})$/i;

export function isPlaceholderText(text: string | null | undefined): boolean {
  if (!text) return true;
  return PLACEHOLDER_TEXT.test(text.trim());
}

/**
 * O corpo da notícia como texto, ou `null` quando não há corpo.
 *
 * **`null` quando o corpo não acrescenta nada ao dek.** Em 23,2% do acervo o
 * `content` é o dek repetido — a TechCrunch manda a mesma frase nos dois campos
 * —, e a tela de leitura já deduplica o primeiro parágrafo contra o dek exibido
 * acima: ela desenhava o rótulo "Trecho" com uma caixa vazia embaixo. Devolver
 * `null` faz a tela dizer o que é verdade, que a matéria inteira está na fonte.
 *
 * A comparação é contra a `description` **já higienizada**, senão o rodapé de
 * WordPress presente nas duas pontas faria dois textos iguais parecerem
 * diferentes.
 *
 * **Quem decide o que é dek e o que é corpo não é esta função — é
 * `splitDekAndBody`.** Aqui "o corpo repete o dek" significa só isso; se o
 * texto repetido for uma matéria de 3.400 caracteres, jogá-lo fora seria jogar
 * a matéria fora. Ver lá.
 */
export function sanitizeContent(
  raw: string | null | undefined,
  description: string,
): string | null {
  if (isPlaceholderText(raw)) return null;

  const text = stripPublisherBoilerplate(htmlToText(raw as string));
  if (text.length === 0 || isPlaceholderText(text)) return null;

  const dek = description.trim();
  if (dek.length > 0 && text === dek) return null;

  return text;
}

/**
 * Quanto pode medir um subtítulo.
 *
 * **O número saiu da distribuição, não do gosto.** Medido sobre as 6.669 linhas
 * de produção em 25/08, o campo `description` tem **mediana de 594 caracteres**,
 * p90 de 5.613 e **máximo de 33.073** — metade do acervo usa o campo de
 * subtítulo para guardar a matéria inteira. A tela de leitura imprime o dek num
 * parágrafo **sem clamp**, então uma dessas notícias abre com trinta mil
 * caracteres de texto cinza antes do corpo começar.
 *
 * 320 é a ordem de grandeza de três linhas em `text-body-lg` na medida de
 * leitura, que é o que o card já clampa por CSS. E é perto dos 300 que o
 * `formatNewsItems` corta para mandar ao modelo — o mesmo julgamento sobre o
 * que é resumo, feito em outro lugar.
 */
const DEK_MAX_LENGTH = 320;

/** Fim de frase seguido de espaço: onde dá para cortar sem truncar palavra. */
const SENTENCE_END = /[.!?…](?=\s|$)/g;

/**
 * A abertura de um texto, no tamanho de um subtítulo.
 *
 * **Prefere o parágrafo, e isso não é detalhe de estilo.** Cortar por
 * caractere no meio do primeiro parágrafo deixaria o corpo repetindo esses
 * caracteres logo abaixo: a deduplicação da tela compara o começo do corpo com
 * o dek, e um dek que termina no meio de uma frase não casa com nada. Terminar
 * o dek onde o parágrafo termina é o que faz as duas pontas se encontrarem.
 */
export function toDek(text: string): string {
  const firstParagraph = text.split('\n')[0]?.trim() ?? '';
  if (firstParagraph.length <= DEK_MAX_LENGTH) return firstParagraph;

  // Parágrafo único e longo: corta no último fim de frase que ainda cabe.
  const window = firstParagraph.slice(0, DEK_MAX_LENGTH);
  let cut = -1;
  for (const match of window.matchAll(SENTENCE_END)) cut = match.index + 1;
  if (cut > 0) return window.slice(0, cut).trim();

  // Sem pontuação nenhuma no trecho — corta na última palavra inteira.
  const space = window.lastIndexOf(' ');
  return `${(space > 0 ? window.slice(0, space) : window).trim()}…`;
}

/** O par que a ingestão grava: um subtítulo e um corpo. */
export interface DekAndBody {
  dek: string;
  body: string | null;
}

/**
 * Separa o que o feed entregou em **subtítulo** e **corpo**.
 *
 * **É a correção de leitura de maior alcance da Fase 12, e nasceu de um número
 * que contradisse a primeira versão desta higiene.** A regra ingênua — "corpo
 * igual ao dek vira `null`" — descartava **5.635 corpos**, com mediana de 1.080
 * caracteres e máximo de 33.073. Ela estava certa sobre a TechCrunch, onde os
 * dois campos trazem a mesma frase única, e catastrófica sobre a G1, a Folha, o
 * Valor, a BBC e a Trivela, onde os dois campos trazem **a matéria inteira**.
 *
 * O erro era de premissa: quando os dois campos carregam o mesmo texto longo,
 * aquele texto é o **corpo**, e o dek é a abertura dele. Não havia corpo
 * repetido para descartar — havia uma matéria no campo errado.
 *
 * Os três casos, e o que cada um recebe:
 *
 * | O que o feed manda | dek | corpo |
 * |---|---|---|
 * | dek curto + trecho próprio (InfoMoney) | o dek | o trecho |
 * | um texto longo nos dois campos (G1, Valor) | a abertura dele | o texto |
 * | uma frase só nos dois campos (TechCrunch) | a frase | `null` |
 *
 * A promoção só acontece quando o texto **não cabe** num dek: abaixo disso ele
 * já é um subtítulo, e promovê-lo criaria o "Trecho" vazio de volta.
 */
export function splitDekAndBody(
  description: string,
  content: string | null,
): DekAndBody {
  if (content) return { dek: toDek(description), body: content };

  const full = description.trim();
  if (full.length <= DEK_MAX_LENGTH) return { dek: full, body: null };

  return { dek: toDek(full), body: full };
}

/**
 * A primeira imagem de dentro do corpo HTML.
 *
 * **Existe porque parte do acervo tem foto e diz que não tem.** O extrator dos
 * feeds olhava `enclosure`, `media:content` e `media:thumbnail`; a InfoMoney não
 * usa nenhum dos três e põe a foto do post como primeiro elemento do
 * `content:encoded`. Medido em 25/08: **107 das 108 notícias da InfoMoney** no
 * acervo tinham `imageUrl` nulo com uma imagem dentro do corpo.
 *
 * **É pouco, e o número está aqui para não crescer sozinho na cabeça de
 * ninguém.** Das 1.810 sem imagem, 107 são recuperáveis — o acervo sem foto cai
 * de 27,1% para 25,5%. As outras 1.703 não têm imagem em lugar nenhum do feed:
 * a Folha, a TechCrunch e a ESPN simplesmente não mandam uma. Quem resolve
 * aquelas é a tela, não o extrator.
 */
export function extractImageFromHtml(html: string | null | undefined): string | null {
  if (!html) return null;

  const match = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i.exec(
    decodeEntities(html),
  );
  const src = match?.[1]?.trim();
  if (!src) return null;

  // Relativa não serve: o `next/image` precisa de origem, e o host de imagem do
  // veículo não é o nosso.
  return /^https?:\/\//i.test(src) ? src : null;
}
