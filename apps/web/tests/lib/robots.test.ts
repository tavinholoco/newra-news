import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';

/**
 * **O `robots.txt` tira o otimizador de imagem do rastreio, e só ele** —
 * 16/10/2026.
 *
 * O plano Hobby da Vercel dá 5.000 transformações de imagem em 30 dias. O
 * robô que lê o `src` — o Google diz que nem todo robô entende `srcset` —
 * pede a variante que nenhum leitor pede: a do hero sai a 1920 px. As fotos
 * são dos veículos; a que o Google Discover e o Notícias usam é a do
 * `og:image` e do JSON-LD, que apontam direto para a fonte.
 *
 * A guarda avalia as regras como o robô avalia (RFC 9309, §2.2.2: a regra
 * com mais octetos vence; empate, `allow`), e não a forma do objeto: um
 * `disallow: '/_next'` "passaria" numa asserção de `toContain` e deixaria o
 * Google sem o JavaScript e o CSS com que ele renderiza a página.
 */

type Rule = { allow: string[]; disallow: string[] };

function ruleFor(userAgent: string): Rule {
  const rules = [robots().rules].flat();
  const match = rules.find((rule) => [rule.userAgent ?? []].flat().includes(userAgent));
  if (!match) throw new Error(`sem regra para ${userAgent}`);
  return {
    allow: [match.allow ?? []].flat(),
    disallow: [match.disallow ?? []].flat(),
  };
}

/** RFC 9309 sem curingas — o arquivo não usa `*` nem `$` no caminho. */
function isAllowed(rule: Rule, pathAndQuery: string): boolean {
  const longest = (patterns: string[]) =>
    Math.max(-1, ...patterns.filter((p) => p !== '' && pathAndQuery.startsWith(p)).map((p) => p.length));
  return longest(rule.allow) >= longest(rule.disallow);
}

describe('o robots.txt', () => {
  const geral = ruleFor('*');

  it('não deixa o robô pedir o otimizador de imagem', () => {
    expect(
      isAllowed(geral, '/_next/image?url=https%3A%2F%2Fs2-g1.glbimg.com%2Ffoto.jpg&w=1920&q=75'),
    ).toBe(false);
  });

  it('deixa o resto do site, inclusive o JavaScript e o CSS da renderização', () => {
    for (const caminho of [
      '/',
      '/pt-BR',
      '/en/news/42d13b26-941f-473d-a87b-941ef61e5a2a',
      '/pt-BR/article/2026-10-16',
      '/_next/static/chunks/app/layout.js',
      '/_next/static/css/app.css',
      '/opengraph-image',
    ]) {
      expect(isAllowed(geral, caminho), caminho).toBe(true);
    }
  });

  it('o avaliador acha um bloqueio quando há um', () => {
    // Sem isto, "deixa o resto" poderia ser verdade porque o avaliador
    // devolve `true` para tudo.
    expect(isAllowed({ allow: ['/'], disallow: ['/_next'] }, '/_next/static/x.js')).toBe(false);
    expect(isAllowed({ allow: ['/_next/static'], disallow: ['/_next'] }, '/_next/static/x.js')).toBe(true);
  });
});
