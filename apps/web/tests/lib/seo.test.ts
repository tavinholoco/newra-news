import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_URL,
  absoluteUrl,
  alternatesFor,
  localePath,
  pageMetadata,
} from '@/lib/seo';

describe('alternatesFor', () => {
  it('declara canonical auto-referente, e não aponta para o outro idioma', () => {
    // Canonizar `/en` para `/pt-BR` removeria a versão em inglês do índice —
    // que é justamente a que serve quem busca em inglês. O par certo é
    // auto-canonical + hreflang recíproco.
    expect(alternatesFor('en', '/news').canonical).toBe('/en/news');
    expect(alternatesFor('pt-BR', '/news').canonical).toBe('/pt-BR/news');
  });

  it('lista os dois idiomas mais o x-default no locale padrão', () => {
    expect(alternatesFor('pt-BR', '/about').languages).toEqual({
      'pt-BR': '/pt-BR/about',
      en: '/en/about',
      'x-default': '/pt-BR/about',
    });
  });

  it('a Home é `/pt-BR`, sem barra final', () => {
    // Barra final faria uma segunda URL para a mesma página, e é ela que
    // entraria no sitemap e no JSON-LD.
    expect(alternatesFor('pt-BR', '').canonical).toBe('/pt-BR');
    expect(absoluteUrl('pt-BR')).toBe(`${SITE_URL}/pt-BR`);
  });

  it('interpola o caminho dinâmico uma vez só', () => {
    const alternates = alternatesFor('en', '/news/abc123');
    expect(alternates.canonical).toBe('/en/news/abc123');
    expect(alternates.languages?.['pt-BR']).toBe('/pt-BR/news/abc123');
  });

  it('localePath e absoluteUrl concordam sobre o mesmo caminho', () => {
    expect(absoluteUrl('en', '/article')).toBe(
      `${SITE_URL}${localePath('en', '/article')}`,
    );
  });
});

const WEB_ROOT = process.cwd();

function collectPages(): Array<{ file: string; source: string }> {
  const pages: Array<{ file: string; source: string }> = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry === 'page.tsx') {
        pages.push({
          file: path.relative(WEB_ROOT, full).replace(/\\/g, '/'),
          source: readFileSync(full, 'utf8'),
        });
      }
    }
  }

  walk(path.resolve(WEB_ROOT, 'app'));
  return pages;
}

const PAGES = collectPages();

describe('canonical e hreflang em toda página', () => {
  it('há páginas para varrer', () => {
    // Se a varredura vier vazia, os dois testes abaixo passam sem medir nada.
    expect(PAGES.length).toBeGreaterThan(10);
  });

  it('nenhuma página escreve o caminho localizado à mão', () => {
    // Eram quinze cópias de `{ 'pt-BR': '/pt-BR/x', en: '/en/x' }`, nenhuma com
    // canonical e nenhuma com x-default. Caminho errado ali não quebra build,
    // teste nem tipo: sai no <head> de produção apontando para o nada.
    const handwritten = PAGES.filter(({ source }) =>
      /'pt-BR':\s*[`']\/pt-BR/.test(source),
    ).map(({ file }) => file);

    expect(handwritten).toEqual([]);
  });

  it('toda página com generateMetadata passa por um dos dois helpers', () => {
    // `pageMetadata` nas públicas (canonical + hreflang + os defaults de OG e
    // Twitter que o Next não herda) e `alternatesFor` nas `noindex`, que não
    // têm OG para declarar. Página nova que escreva a metadata à mão nasce sem
    // canonical, e isso não quebra build nem tipo.
    const missing = PAGES.filter(
      ({ source }) =>
        source.includes('generateMetadata') &&
        !source.includes('pageMetadata(') &&
        !source.includes('alternatesFor('),
    ).map(({ file }) => file);

    expect(missing).toEqual([]);
  });
});

describe('pageMetadata', () => {
  it('completa o que o Next não herda do layout', () => {
    // Não é preferência: o layout declara `openGraph` e `twitter`, e a página
    // que declara os seus **substitui o objeto inteiro**. Medido em produção na
    // Fase 6: nenhuma página tinha `og:type`, `og:site_name`, `og:locale` nem
    // `og:image`, e cinco delas compartilhavam com `twitter:card: summary`.
    const meta = pageMetadata({
      locale: 'pt-BR',
      path: '/news',
      title: 'Notícias',
      description: 'Todas as notícias.',
    });

    expect(meta.openGraph).toMatchObject({
      type: 'website',
      siteName: SITE_NAME,
      locale: 'pt_BR',
      url: '/pt-BR/news',
      images: [
        { url: SITE_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME },
      ],
    });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' });
    expect(meta.alternates?.canonical).toBe('/pt-BR/news');
  });

  it('a página sobrescreve o default sem perder o resto', () => {
    const meta = pageMetadata({
      locale: 'en',
      path: '/news/abc',
      title: 'Manchete',
      openGraph: { type: 'article', publishedTime: '2026-08-22T00:00:00.000Z' },
    });

    expect(meta.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-08-22T00:00:00.000Z',
      // continuam vindo do default
      siteName: SITE_NAME,
      url: '/en/news/abc',
    });
  });

  it('a Home pede título absoluto — o template do layout duplicaria a marca', () => {
    const meta = pageMetadata({
      locale: 'pt-BR',
      path: '',
      title: SITE_NAME,
      absoluteTitle: true,
    });

    expect(meta.title).toEqual({ absolute: SITE_NAME });
  });
});
