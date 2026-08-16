import '@testing-library/jest-dom/vitest';

// jsdom não implementa matchMedia — necessário para componentes que checam
// prefers-color-scheme / media queries.
if (!window.matchMedia) {
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
