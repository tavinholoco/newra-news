import type { ThemePreference } from '@newranews/types';

/** O que o `localStorage` guarda. Ausente significa "seguir o sistema". */
export type StoredTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * O tema **não vem de uma biblioteca**: são o `ThemeInit` (script inline, antes
 * do paint) e a classe `.dark` no `<html>`, com a escolha no `localStorage`.
 *
 * Este arquivo existe para haver **um** escritor dessa chave. Desde a Fase 6 são
 * dois os controles que a mexem — o botão do cabeçalho e as preferências da
 * conta —, e duas cópias da mesma escrita divergiriam no primeiro ajuste.
 *
 * Toda leitura é defensiva: `localStorage` lança em modo privativo e o conteúdo
 * é editável à mão.
 */
export function readStoredTheme(): StoredTheme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/**
 * Aplica a preferência e a guarda. `SYSTEM` **apaga** a escolha em vez de
 * gravar o valor que o sistema tem agora: gravado, o tema deixaria de
 * acompanhar o aparelho quando ele virasse à noite.
 *
 * Devolve o tema que ficou valendo, para quem precisa refletir isso na UI.
 */
export function applyThemePreference(preference: ThemePreference): StoredTheme {
  const resolved: StoredTheme =
    preference === 'SYSTEM'
      ? prefersDark()
        ? 'dark'
        : 'light'
      : preference === 'DARK'
        ? 'dark'
        : 'light';

  document.documentElement.classList.toggle('dark', resolved === 'dark');

  try {
    if (preference === 'SYSTEM') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, resolved);
    }
  } catch {
    // localStorage indisponível (modo privativo, testes) — a classe já valeu
  }

  return resolved;
}
