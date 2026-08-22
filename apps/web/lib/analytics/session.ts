/**
 * O identificador de sessão — **e o que ele deliberadamente não é**.
 *
 * `sessionStorage` e não `localStorage`: a §4 dos slots exige que o id não
 * persista entre visitas. Em `localStorage` ele viraria identificador estável,
 * e um identificador estável é o que separa "medição anônima" de "dado
 * pessoal" — exatamente a linha que permite esta camada existir sem
 * consentimento. Fechar a aba apaga.
 *
 * Também não há `userId` aqui, nem quando a pessoa está logada. É a mesma §4:
 * cruzar comportamento com conta é o que a camada não faz.
 */
export const SESSION_STORAGE_KEY = 'newra:analytics-session';

/**
 * Um UUID v4 sem depender de `crypto.randomUUID`.
 *
 * O nativo existe em todo navegador moderno **em contexto seguro** — e `http://`
 * numa rede local não é um. Sem o fallback, medir num aparelho de teste apontado
 * para o IP da máquina lançaria em vez de medir.
 */
function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Versão 4 e variante RFC 4122 — a API valida o formato com `z.string().uuid()`.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/**
 * O id da sessão atual, criado na primeira chamada.
 *
 * Devolve `null` no servidor e quando `sessionStorage` não está disponível
 * (modo privativo em alguns navegadores). **`null` desliga a medição** — evento
 * sem sessão não tem como ser agrupado, e a API o recusaria de qualquer forma.
 */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const created = randomId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
}
