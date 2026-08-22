import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { JsonLd } from '@/components/seo/json-ld';

function scriptOf(ui: React.ReactElement): HTMLScriptElement {
  const { container } = render(ui);
  const script = container.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  if (!script) throw new Error('nenhum bloco ld+json renderizado');
  return script;
}

describe('JsonLd', () => {
  it('um nó sai plano, com o @context no topo', () => {
    const script = scriptOf(<JsonLd data={{ '@type': 'WebSite' }} />);

    expect(JSON.parse(script.textContent ?? '')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
    });
  });

  it('vários nós viram um @graph num bloco só', () => {
    const script = scriptOf(
      <JsonLd data={[{ '@type': 'Organization' }, { '@type': 'WebSite' }]} />,
    );

    expect(JSON.parse(script.textContent ?? '')).toEqual({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'Organization' }, { '@type': 'WebSite' }],
    });
  });

  it('manchete com </script> não fecha o bloco', () => {
    // Não é hipótese: o conteúdo vem de feed RSS de terceiro. `JSON.stringify`
    // não escapa `<`, e sem escape o resto do documento passaria a ser lido
    // como HTML a partir dali.
    const script = scriptOf(
      <JsonLd data={{ headline: 'Fim </script><img onerror=x> do teste' }} />,
    );

    expect(script.textContent).not.toContain('</script>');
    expect(script.textContent).toContain('\\u003c');
    // E o dado que o buscador lê continua sendo o texto original.
    expect(
      (JSON.parse(script.textContent ?? '') as { headline: string }).headline,
    ).toBe('Fim </script><img onerror=x> do teste');
  });

  it('separadores de linha do JavaScript saem escapados', () => {
    // U+2028/U+2029 são quebra de linha para o parser de JS e não para o de
    // JSON: crus dentro do bloco, quebram o documento.
    const raw = `antes\u2028meio\u2029depois`;
    const script = scriptOf(<JsonLd data={{ headline: raw }} />);

    expect(script.textContent).not.toContain('\u2028');
    expect(script.textContent).not.toContain('\u2029');
    expect(
      (JSON.parse(script.textContent ?? '') as { headline: string }).headline,
    ).toBe(raw);
  });
});
