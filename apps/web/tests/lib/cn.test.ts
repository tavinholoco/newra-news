import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

/**
 * Guarda do `cn` contra a escala tipográfica nomeada da V2.
 *
 * O `tailwind-merge` só sabe que `text-h3` é tamanho e `text-ink` é cor porque
 * `lib/utils.ts` diz. Sem essa configuração as duas classes caem no mesmo
 * grupo, a última apaga a primeira, e o resultado é invisível para build,
 * lint e tipos — a classe simplesmente não chega ao HTML.
 */
describe('cn com a escala tipográfica da V2', () => {
  it.each([
    ['text-meta', 'text-ink-muted'],
    ['text-h1', 'text-ink'],
    ['text-h3', 'text-link'],
    ['text-body-sm', 'text-ink-secondary'],
    ['text-overline', 'text-brand-accent'],
    ['text-display', 'text-on-brand'],
  ])('should keep %s and %s together', (size, color) => {
    expect(cn(size, color).split(' ').sort()).toEqual([size, color].sort());
    // E na ordem inversa: quem escreve a cor antes do tamanho não pode perder
    // nenhuma das duas por causa disso.
    expect(cn(color, size).split(' ').sort()).toEqual([size, color].sort());
  });

  it('should still let a later size win over an earlier one', () => {
    expect(cn('text-body', 'text-h2')).toBe('text-h2');
  });

  it('should still let a later colour win over an earlier one', () => {
    expect(cn('text-ink', 'text-ink-muted')).toBe('text-ink-muted');
  });

  it('should keep merging the classes tailwind-merge already understood', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });
});
