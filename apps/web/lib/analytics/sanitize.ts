import { SEARCH_QUERY_MAX_LENGTH } from '@newranews/types';

/**
 * O termo de busca é o único dado do catálogo **digitado por uma pessoa**, e
 * por isso é o único que passa por aqui.
 *
 * A §4 dos slots pede truncar em 100 e descartar o que tiver `@`. Isto vai
 * além, e de propósito: quem digita numa caixa de busca às vezes digita no
 * lugar errado — o campo do lado era o de login, ou a pessoa colou o que tinha
 * na área de transferência. O que a métrica quer é "que assunto o acervo não
 * cobre"; nenhum assunto precisa de um CPF para ser nomeado.
 *
 * Devolve `null` quando o termo não deve sair do navegador. **`null` descarta o
 * evento inteiro** — mandar `search` sem o termo entregaria "alguém buscou algo
 * e achou zero", que não diz o que faltou e não vale o registro.
 */
export function sanitizeSearchQuery(raw: string): string | null {
  const trimmed = raw.trim();

  if (trimmed.length === 0) return null;

  // Parece e-mail, ou usuário de rede social, ou qualquer coisa com arroba.
  if (trimmed.includes('@')) return null;

  // Parece segredo colado: chaves, tokens e URLs com credencial.
  if (/\b(?:senha|password|passwd|token|secret|api[-_ ]?key)\b/i.test(trimmed)) {
    return null;
  }
  // Cadeia longa, sem espaço, **misturando letra e dígito** — que é a forma de
  // uma chave. Exigir a mistura evita o falso positivo que a suite pegou: sem
  // ela, qualquer palavra longa sem dígito era descartada, e
  // "anticonstitucionalissimamente" tem 29 letras.
  if (/^(?=.*\d)(?=.*[A-Za-z])[A-Za-z0-9_-]{24,}$/.test(trimmed)) return null;

  // Dígitos demais: CPF, CNPJ, cartão, telefone, CEP. Assunto de notícia é
  // nomeado por palavras — um ano ("eleições 2026") tem quatro dígitos, e onze
  // é onde começa o que não deve ser gravado.
  const digits = trimmed.replace(/\D/g, '').length;
  if (digits >= 11) return null;

  return trimmed.slice(0, SEARCH_QUERY_MAX_LENGTH);
}
