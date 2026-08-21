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
 */
export function sanitizeDescription(raw: string, title: string): string {
  const lines = raw
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

  return lines.join('\n').trim();
}
