import '@testing-library/jest-dom/vitest';

// jsdom não implementa matchMedia — necessário para componentes que checam
// prefers-color-scheme / media queries. Testes com @vitest-environment node
// não têm window; o guard evita quebrá-los.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
