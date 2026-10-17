import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';

/**
 * **O `robots.txt` corta as duas cotas do Hobby da Vercel** — 16/10/2026.
 *
 * - **Todo robô fica fora do otimizador de imagem.** O que lê o `src` — o
 *   Google diz que nem todo robô entende `srcset` — pedia a variante que
 *   nenhum leitor pede, e a cota é de 5.000 transformações em 30 dias. As
 *   fotos são dos veículos; o Discover e o Notícias usam o `og:image` e o
 *   JSON-LD, que apontam direto para a fonte.
 * - **O ClaudeBot fica fora das matérias** (decisão do dono). No log de CDN
 *   de 16/10 ele fez 578 das 597 regenerações da ISR — `/news/[id]` nos dois
 *   idiomas — e as 167 transformações de imagem.
 *
 * A guarda avalia as regras como o robô avalia (RFC 9309): o robô obedece só
 * ao grupo que traz o nome dele, e cai no `*` se não houver um (§2.2.1); no
 * grupo, a regra com mais octetos vence, e no empate vale `allow` (§2.2.2).
 * Asserção sobre a forma do objeto deixaria passar o defeito que mais pesa
 * aqui: o grupo do ClaudeBot sem o otimizador, que ele não herda do `*`.
 */

type Rule = { allow: string[]; disallow: string[] };

/** O grupo que o robô obedece: o que traz o nome dele, senão o `*`. */
function groupFor(productToken: string): Rule {
  const rules = [robots().rules].flat();
  const names = (rule: (typeof rules)[number]) =>
    [rule.userAgent ?? []].flat().map((ua) => ua.toLowerCase());
  const own = rules.filter((rule) => names(rule).includes(productToken.toLowerCase()));
  const chosen = own.length > 0 ? own : rules.filter((rule) => names(rule).includes('*'));
  if (chosen.length === 0) throw new Error(`sem grupo para ${productToken}`);
  return {
    allow: chosen.flatMap((rule) => [rule.allow ?? []].flat()),
    disallow: chosen.flatMap((rule) => [rule.disallow ?? []].flat()),
  };
}

/** RFC 9309 sem curingas — o arquivo não usa `*` nem `$` no caminho. */
function isAllowed(rule: Rule, pathAndQuery: string): boolean {
  const longest = (patterns: string[]) =>
    Math.max(-1, ...patterns.filter((p) => p !== '' && pathAndQuery.startsWith(p)).map((p) => p.length));
  return longest(rule.allow) >= longest(rule.disallow);
}

const IMAGEM = '/_next/image?url=https%3A%2F%2Fs2-g1.glbimg.com%2Ffoto.jpg&w=1920&q=75';
const MATERIAS = [
  '/pt-BR/news/42d13b26-941f-473d-a87b-941ef61e5a2a',
  '/en/news/42d13b26-941f-473d-a87b-941ef61e5a2a',
];
const ABERTAS = [
  '/',
  '/pt-BR',
  '/en',
  '/pt-BR/news',
  '/en/news?category=TECNOLOGIA',
  '/pt-BR/article',
  '/pt-BR/article/2026-10-16',
  '/pt-BR/about',
  '/_next/static/chunks/app/layout.js',
  '/_next/static/css/app.css',
  '/opengraph-image',
];

describe('o robots.txt', () => {
  it('não deixa o robô pedir o otimizador de imagem', () => {
    expect(isAllowed(groupFor('Googlebot'), IMAGEM)).toBe(false);
  });

  it('deixa o resto do site, inclusive o JavaScript e o CSS da renderização', () => {
    const geral = groupFor('Googlebot');
    for (const caminho of [...ABERTAS, ...MATERIAS]) {
      expect(isAllowed(geral, caminho), caminho).toBe(true);
    }
  });

  it('o ClaudeBot também não pede o otimizador — ele não herda o grupo `*`', () => {
    expect(isAllowed(groupFor('ClaudeBot'), IMAGEM)).toBe(false);
  });

  it('o ClaudeBot não regenera as matérias, nos dois idiomas', () => {
    for (const caminho of MATERIAS) {
      expect(isAllowed(groupFor('ClaudeBot'), caminho), caminho).toBe(false);
    }
  });

  it('o ClaudeBot ainda lê a Home, os briefings e as listagens', () => {
    const claude = groupFor('ClaudeBot');
    for (const caminho of ABERTAS) {
      expect(isAllowed(claude, caminho), caminho).toBe(true);
    }
  });

  it('o avaliador acha um bloqueio quando há um, e escolhe o grupo como o robô', () => {
    // Sem isto, "deixa o resto" poderia ser verdade porque o avaliador
    // devolve `true` para tudo, e "o ClaudeBot não regenera" porque o grupo
    // dele seria o `*` por engano.
    expect(isAllowed({ allow: ['/'], disallow: ['/_next'] }, '/_next/static/x.js')).toBe(false);
    expect(isAllowed({ allow: ['/_next/static'], disallow: ['/_next'] }, '/_next/static/x.js')).toBe(true);
    expect(groupFor('claudebot')).toEqual(groupFor('ClaudeBot'));
    expect(groupFor('ClaudeBot')).not.toEqual(groupFor('Googlebot'));
  });
});
