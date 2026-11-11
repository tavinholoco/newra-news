import { describe, it, expect } from 'vitest';
import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
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
 * - **O GPTBot e o Applebot também** (decisão do dono, 11/11/2026). Com o
 *   ClaudeBot fora, os dois mantinham a API do Render acordada 22–24 h/dia
 *   desde 02/11: no log de CDN de 12 h de 10/11, o Applebot fez 638
 *   regenerações de `/news/[id]` e o GPTBot 754 requisições numa rajada.
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
/**
 * Os robôs que ficam fora das matérias. O nome é o *product token* que cada
 * um declara na documentação dele — o robô procura o próprio nome no arquivo,
 * sem diferenciar maiúsculas (RFC 9309, §2.2.1).
 */
const FORA_DAS_MATERIAS = ['ClaudeBot', 'GPTBot', 'Applebot'];
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

  it.each(FORA_DAS_MATERIAS)('o %s também não pede o otimizador — ele não herda o grupo `*`', (robo) => {
    expect(isAllowed(groupFor(robo), IMAGEM)).toBe(false);
  });

  it.each(FORA_DAS_MATERIAS)('o %s não regenera as matérias, nos dois idiomas', (robo) => {
    for (const caminho of MATERIAS) {
      expect(isAllowed(groupFor(robo), caminho), caminho).toBe(false);
    }
  });

  it.each(FORA_DAS_MATERIAS)('o %s ainda lê a Home, os briefings e as listagens', (robo) => {
    const grupo = groupFor(robo);
    for (const caminho of ABERTAS) {
      expect(isAllowed(grupo, caminho), caminho).toBe(true);
    }
  });

  it('o grupo `*` não muda: os outros robôs leem as matérias e só perdem o otimizador', () => {
    // O Googlebot e o Bingbot são quem leva leitor às matérias; o
    // `Applebot-Extended` é outro *product token* (só diz se a Apple pode
    // treinar com o que o Applebot coletou) e não casa com o grupo.
    for (const robo of ['Googlebot', 'Bingbot', 'Applebot-Extended', 'OAI-SearchBot']) {
      expect(groupFor(robo), robo).toEqual({ allow: ['/'], disallow: ['/_next/image'] });
    }
  });

  it('o texto que o Next escreve põe os três nomes no mesmo grupo das matérias', () => {
    // Um grupo com vários `User-agent` seguidos é um grupo só (RFC 9309,
    // §2.1): as regras que vêm depois valem para todos. O avaliador acima lê
    // o objeto; esta asserção lê o arquivo que o robô baixa.
    const grupos = resolveRobots(robots())
      .split('\n\n')
      .map((bloco) => bloco.trim())
      .filter((bloco) => bloco.startsWith('User-Agent:'));
    const dasMaterias = grupos.find((bloco) => bloco.includes('Disallow: /pt-BR/news/'));
    expect(dasMaterias).toBeDefined();
    const linhas = dasMaterias!.split('\n');
    expect(linhas.slice(0, FORA_DAS_MATERIAS.length)).toEqual(
      FORA_DAS_MATERIAS.map((robo) => `User-Agent: ${robo}`),
    );
    expect(linhas).toContain('Disallow: /en/news/');
    expect(linhas).toContain('Disallow: /_next/image');
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
