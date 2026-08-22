import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { applyThemePreference, readStoredTheme } from '@/lib/theme';

function mockPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches, media: '(prefers-color-scheme: dark)' }),
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  mockPrefersDark(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyThemePreference', () => {
  it('should store and apply an explicit choice', () => {
    expect(applyThemePreference('DARK')).toBe('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('should clear the choice on SYSTEM, so the device keeps deciding', () => {
    applyThemePreference('DARK');
    mockPrefersDark(false);

    expect(applyThemePreference('SYSTEM')).toBe('light');
    // Gravar o valor que o sistema tem agora congelaria o tema: à noite, o
    // aparelho viraria e a página não.
    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should follow the system when it prefers dark', () => {
    mockPrefersDark(true);

    expect(applyThemePreference('SYSTEM')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('readStoredTheme', () => {
  it('should return null when nothing was chosen', () => {
    expect(readStoredTheme()).toBeNull();
  });

  it('should ignore a value that is not one of the two', () => {
    // A chave é editável à mão, e o conteúdo não é confiável.
    localStorage.setItem('theme', 'banana');

    expect(readStoredTheme()).toBeNull();
  });

  it('should read back what was applied', () => {
    applyThemePreference('LIGHT');

    expect(readStoredTheme()).toBe('light');
  });
});
