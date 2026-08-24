import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  EVENT_SOURCES,
  PRODUCT_EVENT_TYPES,
  SHARE_CHANNELS,
} from '@newranews/types';

/**
 * **Vocabulário declarado ⇒ vocabulário emitido, ou razão escrita.**
 *
 * A §11.5 manda seguir os eventos do call site até a linha no banco, e nomeia o
 * que procurar: *tipo instrumentado que nunca apareceu é call site morto*. O
 * lado difícil dessa verificação — o banco — depende de tráfego e de acesso de
 * admin; o lado que uma guarda alcança é este: **o que o catálogo promete e a
 * interface não emite**.
 *
 * Ele já mordeu duas vezes neste projeto, nas duas direções:
 *
 * - `ad_view` e `ad_click` ficaram no catálogo depois de a publicidade ser
 *   cancelada, e saíram em 22/08 — evento sem emissor é a tabela sem leitor em
 *   outra forma;
 * - `newsletter-landing` era um `EventSource` que **nunca foi emitido**, porque
 *   o `NewsletterCta` fixava `origin='article-cta'` inclusive dentro da
 *   `/newsletter`. Toda inscrição vinda da página feita para converter entrava
 *   na conta do CTA de fim de matéria — e o `origin` existe justamente para não
 *   somar canais diferentes num número só. Achado da §11.5, corrigido.
 *
 * A cadeia de transporte foi provada à parte, contra produção em 24/08: um lote
 * pelo `POST /api/events` do Next devolveu `201 { data: { accepted: 1 } }`, e o
 * `accepted` é a contagem do `createMany` — ou seja, navegador → BFF → API →
 * Postgres, com linha gravada na ponta.
 */

const WEB_ROOT = join(__dirname, '../..');
const SCANNED_DIRS = [join(WEB_ROOT, 'components'), join(WEB_ROOT, 'app')];

/**
 * Eventos do catálogo que a interface não dispara, e por quê.
 *
 * Um só, e a decisão está escrita ao lado do tipo em `packages/types`: o
 * `subscription_intent` mede intenção de assinar um plano que **não existe** —
 * o Newra Plus está adiado na §21, com gatilho num número. Instrumentá-lo hoje
 * seria medir o clique num botão que não há.
 *
 * **Gatilho para sair desta lista:** a primeira tela do Newra Plus. Se o plano
 * for cancelado em vez de lançado, o evento sai do catálogo, como `ad_view` e
 * `ad_click` saíram.
 */
const WITHOUT_CALL_SITE: Record<string, string> = {
  subscription_intent: 'Newra Plus adiado (§21) — não há tela que emita',
};

/**
 * Valores de vocabulário sem controle na interface, e por quê.
 *
 * Os três canais de compartilhamento que não têm botão. **Vocabulário maior que
 * a interface é contrato de dado, não controle prometido**: o dia em que um
 * botão de WhatsApp entrar, o valor já existe nos dois lados e nenhuma migração
 * é necessária. A diferença para a lista acima é que `share` **é** emitido — o
 * que não se usa é um valor do enum, não o evento.
 */
const UNUSED_VOCABULARY: Record<string, string> = {
  whatsapp: 'sem botão na interface — o valor existe para o dia em que houver',
  x: 'sem botão na interface',
  linkedin: 'sem botão na interface',
};

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? collectFiles(full)
      : /\.tsx?$/.test(full)
        ? [full]
        : [];
  });
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Fora as declarações de tipo, antes de procurar literal.
 *
 * **Sem isto a guarda passa verde sobre o defeito que ela existe para achar.**
 * Verificada reprovando — tirando o `origin='newsletter-landing'` da
 * `/newsletter` —, ela continuou passando: o literal seguia escrito no arquivo,
 * dentro do `origin?: Extract<EventSource, 'article-cta' | 'newsletter-landing'>`
 * do próprio componente. Uma `interface` **descreve** o vocabulário; ela nunca
 * emite evento nenhum, e contá-la como uso é confundir promessa com emissão.
 */
function stripTypeDeclarations(source: string): string {
  let out = source.replace(/^\s*(?:export\s+)?type\s+\w+[\s\S]*?;\s*$/gm, ' ');

  for (;;) {
    const match = /(?:export\s+)?interface\s+\w+[^{]*\{/.exec(out);
    if (!match) return out;

    let depth = 1;
    let index = match.index + match[0].length;
    while (index < out.length && depth > 0) {
      const char = out[index];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      index += 1;
    }
    out = out.slice(0, match.index) + ' ' + out.slice(index);
  }
}

const sources = SCANNED_DIRS.flatMap(collectFiles).map((file) =>
  stripTypeDeclarations(stripComments(readFileSync(file, 'utf8'))),
);

/** Os tipos que aparecem num `track(...)`, mais os resolvidos por variável. */
function trackedTypes(): Set<string> {
  const tracked = new Set<string>();

  for (const source of sources) {
    for (const match of source.matchAll(/\btrack\(\s*'([a-z_0-9]+)'/g)) {
      tracked.add(match[1] as string);
    }
  }

  // `scroll-depth.tsx` chama `track(type, ...)` com o limiar vindo de uma
  // tupla — o literal está no arquivo, só não dentro do `track(`. Procurá-lo
  // como literal é o que evita marcar os três como mortos.
  for (const type of PRODUCT_EVENT_TYPES) {
    if (sources.some((source) => source.includes(`'${type}'`))) tracked.add(type);
  }

  return tracked;
}

function usedLiterals(values: readonly string[]): Set<string> {
  return new Set(
    values.filter((value) => sources.some((source) => source.includes(`'${value}'`))),
  );
}

describe('catálogo de analytics × o que a interface emite', () => {
  it('emits every event type in the catalogue', () => {
    const tracked = trackedTypes();
    const dead = PRODUCT_EVENT_TYPES.filter(
      (type) => !tracked.has(type) && !(type in WITHOUT_CALL_SITE),
    );

    expect(dead).toEqual([]);
  });

  it('uses every event source in the vocabulary', () => {
    // Foi esta asserção que achou o `newsletter-landing` morto.
    const used = usedLiterals(EVENT_SOURCES);
    const unused = EVENT_SOURCES.filter(
      (source) => !used.has(source) && !(source in UNUSED_VOCABULARY),
    );

    expect(unused).toEqual([]);
  });

  it('accounts for every share channel', () => {
    const used = usedLiterals(SHARE_CHANNELS);
    const unaccounted = SHARE_CHANNELS.filter(
      (channel) => !used.has(channel) && !(channel in UNUSED_VOCABULARY),
    );

    expect(unaccounted).toEqual([]);
  });

  it('does not carry an exception for something that is emitted after all', () => {
    // Exceção órfã descreve uma decisão que já não existe, e é como a lista
    // deixa de valer sem ninguém mexer nela.
    const tracked = trackedTypes();
    const used = usedLiterals([...EVENT_SOURCES, ...SHARE_CHANNELS]);

    expect(Object.keys(WITHOUT_CALL_SITE).filter((type) => tracked.has(type))).toEqual(
      [],
    );
    expect(
      Object.keys(UNUSED_VOCABULARY).filter((value) => used.has(value)),
    ).toEqual([]);
  });

  it('reads the components at all — an empty scan would pass everything', () => {
    expect(sources.length).toBeGreaterThan(50);
    expect(trackedTypes().size).toBeGreaterThanOrEqual(
      PRODUCT_EVENT_TYPES.length - Object.keys(WITHOUT_CALL_SITE).length,
    );
  });
});
