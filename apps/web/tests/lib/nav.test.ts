import { describe, it, expect } from 'vitest';
import { resolveActiveHref } from '@/lib/nav';

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
