import { createHash } from 'node:crypto';

export const ARTICLE_SYSTEM_PROMPT = `Você é um jornalista editorial experiente. Seu papel é analisar as notícias do dia e criar um artigo coeso que informe o leitor sobre os principais acontecimentos. O artigo deve ser escrito em português brasileiro, com tom informativo e acessível.`;

export const ARTICLE_USER_PROMPT = `INSTRUÇÕES:
- Crie um título impactante para o artigo do dia
- Escreva uma introdução que contextualize o cenário geral
- Desenvolva 3-5 tópicos principais baseados nas notícias mais relevantes
- Para cada tópico, explique o fato e sua relevância
- Conclua com uma síntese do panorama geral do dia
- O artigo deve ter entre 800-1200 palavras
- Não invente informações, use apenas o que está nas notícias fornecidas
- Retorne o conteúdo em formato Markdown

NOTÍCIAS DO DIA:
`;

/**
 * Época do prompt. Suba manualmente quando a mudança for conceitual (outro
 * formato de saída, outra persona) e a comparação com briefings antigos deixar
 * de fazer sentido.
 */
const ARTICLE_PROMPT_EPOCH = 'v1';

/**
 * Versão do prompt gravada em `Article.promptVersion` (plano V2 §18.4).
 *
 * O sufixo é a impressão digital do conteúdo dos dois prompts, não um número
 * escrito à mão: uma versão manual que alguém esquece de subir é pior que
 * nenhuma, porque passa a mentir sobre qual prompt gerou o artigo. Com o hash,
 * editar o texto acima muda a versão sozinho.
 */
export const ARTICLE_PROMPT_VERSION = `${ARTICLE_PROMPT_EPOCH}-${createHash('sha256')
  .update(ARTICLE_SYSTEM_PROMPT)
  .update(ARTICLE_USER_PROMPT)
  .digest('hex')
  .slice(0, 8)}`;
