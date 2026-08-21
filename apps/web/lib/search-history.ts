const STORAGE_KEY = 'newra:news-search-history';

/** Quantos termos o histórico guarda. Além disso a lista deixa de ser um atalho. */
export const SEARCH_HISTORY_LIMIT = 6;

/**
 * Histórico local de buscas (§7).
 *
 * **`localStorage` e não o servidor.** O que alguém procurou é dado sensível o
 * bastante para não virar registro numa conta que a `/news` nem exige — a tela
 * é pública. Ficando no aparelho, o histórico serve de atalho sem que o projeto
 * passe a guardar o que cada leitor procura.
 *
 * Toda leitura é defensiva: `localStorage` lança em modo privativo de alguns
 * navegadores e o conteúdo pode ter sido editado à mão. Um histórico corrompido
 * volta vazio — nunca derruba a busca, que é a função principal da tela.
 */
export function readSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
      .slice(0, SEARCH_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function write(terms: string[]): string[] {
  if (typeof window === 'undefined') return terms;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
  } catch {
    // Cota estourada ou storage bloqueado: o histórico é conveniência, e
    // perdê-lo não pode custar a busca.
  }

  return terms;
}

/**
 * Põe o termo no topo, sem repetir.
 *
 * A comparação é sem acento nem caixa para "Economia" não conviver com
 * "economia" na mesma lista de seis itens; a grafia guardada é a que a pessoa
 * acabou de digitar.
 */
export function pushSearchTerm(term: string): string[] {
  const trimmed = term.trim();
  if (!trimmed) return readSearchHistory();

  const key = normalize(trimmed);
  const rest = readSearchHistory().filter((item) => normalize(item) !== key);

  return write([trimmed, ...rest].slice(0, SEARCH_HISTORY_LIMIT));
}

export function removeSearchTerm(term: string): string[] {
  const key = normalize(term);
  return write(readSearchHistory().filter((item) => normalize(item) !== key));
}

export function clearSearchHistory(): string[] {
  return write([]);
}

function normalize(term: string): string {
  return term
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
