import { describe, it, expect } from 'vitest';
import { resolveActiveHref, sessionNavLinks } from '@/lib/nav';

const MENU = ['/', '/news', '/article', '/about', '/admin', '/admin/metrics'];

describe('resolveActiveHref', () => {
  it('should match an exact route', () => {
    expect(resolveActiveHref(MENU, '/news')).toBe('/news');
  });

  it('should only match home on home', () => {
    expect(resolveActiveHref(MENU, '/')).toBe('/');
    expect(resolveActiveHref(MENU, '/news')).not.toBe('/');
    expect(resolveActiveHref(MENU, '/about')).not.toBe('/');
  });

  it('should keep a parent section active on its detail routes', () => {
    expect(resolveActiveHref(MENU, '/article/2026-08-20')).toBe('/article');
    expect(resolveActiveHref(MENU, '/news/abc-123')).toBe('/news');
  });

  it('should let the deepest listed route win over its parent', () => {
    // `startsWith` sozinho devolveria os dois e a navegação marcaria ambos.
    expect(resolveActiveHref(MENU, '/admin/metrics')).toBe('/admin/metrics');
    expect(resolveActiveHref(MENU, '/admin')).toBe('/admin');
  });

  it('should not match a route that merely shares a prefix', () => {
    // `/newsletter` começa com `/news`, mas não é uma rota-filha dele.
    expect(resolveActiveHref(MENU, '/newsletter')).toBeNull();
  });

  it('should return null when nothing matches', () => {
    expect(resolveActiveHref(MENU, '/signin')).toBeNull();
    expect(resolveActiveHref([], '/news')).toBeNull();
  });
});

describe('sessionNavLinks', () => {
  it('should offer nothing before the session resolves', () => {
    // `loading` é o estado do primeiro render. Tratá-lo como anônimo é o certo:
    // mostrar o painel e escondê-lo meio segundo depois pisca na tela.
    expect(sessionNavLinks('loading', 'ADMIN')).toEqual([]);
    expect(sessionNavLinks('unauthenticated', 'ADMIN')).toEqual([]);
  });

  it('should offer account and saved to a signed-in reader', () => {
    expect(sessionNavLinks('authenticated', 'USER').map((l) => l.href)).toEqual([
      '/account',
      '/favorites',
    ]);
  });

  it('should add the panel only for ADMIN', () => {
    expect(sessionNavLinks('authenticated', 'ADMIN').map((l) => l.href)).toEqual(
      ['/account', '/favorites', '/admin'],
    );
    expect(sessionNavLinks('authenticated', null).map((l) => l.href)).not.toContain(
      '/admin',
    );
    expect(
      sessionNavLinks('authenticated', undefined).map((l) => l.href),
    ).not.toContain('/admin');
  });

  it('should not carry the metrics route: it is a tab inside the panel', () => {
    expect(
      sessionNavLinks('authenticated', 'ADMIN').map((l) => l.href),
    ).not.toContain('/admin/metrics');
  });
});
