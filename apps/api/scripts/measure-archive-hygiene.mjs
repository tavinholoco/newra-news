/**
 * Mede a higiene do texto do acervo, contra produção.
 *
 * **Por que isto é um script no repositório, e não um teste.** A suíte roda sem
 * rede de propósito: um teste que bate na API de produção reprovaria no dia em
 * que ela espirrasse, e gate que falha por motivo alheio é gate que se aprende
 * a ignorar. Mas a medição precisa existir em algum lugar — a primeira vez que
 * ela foi feita, em 31/08/2026, viveu num arquivo temporário e sumiu junto com
 * a sessão. Ninguém lembra de uma medição que não é um comando.
 *
 * Mesmo padrão de `apps/web/scripts/capture-visual-baseline.mjs`: manual, contra
 * produção, e com a saída servindo de evidência.
 *
 * ## O que ele confere
 *
 * A Fase 12 (item 38 do `docs/progress.md`) higienizou o texto que vem dos
 * feeds. A correção age em dois lugares — na ingestão, para o que entra, e na
 * **etapa 8.5 do pipeline**, para o que já está gravado. Como a 8.5 roda uma
 * vez por dia, o acervo só converge no dia seguinte ao deploy; este script é o
 * que diz se convergiu.
 *
 * Medido em 25/08/2026, **antes** da correção, sobre 6.669 linhas:
 *
 *     tag HTML no corpo         63,7%
 *     corpo abrindo com <img>   51,9%
 *     dek acima de 320 chars    60,7%   (mediana 594, máximo 33.073)
 *     aviso de paywall           7,3%
 *     rodapé do veículo          5,5%
 *     a palavra "null"         158 linhas
 *
 * Todos esses devem estar em **zero**. "Sem imagem" não é defeito e não reprova:
 * 25,5% do acervo não tem foto em lugar nenhum do feed, e a tela desenha isso
 * como card de texto.
 *
 * ## Uso
 *
 *     pnpm --filter @newranews/api archive:hygiene
 *
 * Variáveis: `API_URL` (default: produção), `MAX_PAGES` (default: tudo).
 * Sai com código 1 se alguma classe de defeito tiver linha.
 */

const API = (process.env.API_URL ?? 'https://newra-news-api.onrender.com/api').replace(/\/$/, '');
const MAX_PAGES = process.env.MAX_PAGES ? Number(process.env.MAX_PAGES) : Infinity;
const PAGE_SIZE = 100;

/** Tag de abertura ou fechamento. O corpo é texto puro depois da Fase 12. */
const HTML_TAG = /<\/?[a-z][\s\S]*?>/i;
/** O rodapé que o WordPress carimba: InfoMoney, Olhar Digital, Drauzio. */
const PUBLISHER_FOOTER =
  /(?:the|o)\s+post\b[\s\S]{0,400}?(?:appeared first on|apareceu primeiro em|first appeared on)/i;
/** O aviso que o CMS do Valor injeta no meio do texto. */
const PAYWALL = /Matéria exclusiva para assinantes/i;
/** O teto do dek na ingestão (`DEK_MAX_LENGTH` em `providers/news/feed-text.ts`). */
const DEK_MAX = 320;

async function page(n) {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const res = await fetch(`${API}/news?limit=${PAGE_SIZE}&page=${n}`, {
      signal: AbortSignal.timeout(60_000),
    });

    // 429: o limitador da API. Espera e tenta de novo — a varredura inteira são
    // ~67 requisições e o teto é generoso, mas o cold start bagunça o ritmo.
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 3_000 * (tentativa + 1)));
      continue;
    }

    // **A API suspensa devolve HTML, não JSON.** Foi assim que a primeira
    // versão disto morreu com "Unexpected token '<'" e não disse por quê.
    const tipo = res.headers.get('content-type') ?? '';
    if (!tipo.includes('json')) {
      const corpo = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
      throw new Error(
        `a API respondeu ${res.status} em ${tipo || 'sem content-type'} — provavelmente suspensa ou fora do ar.\n  ${corpo}`,
      );
    }
    if (!res.ok) throw new Error(`página ${n}: HTTP ${res.status}`);
    return res.json();
  }
  throw new Error(`página ${n}: rate limit depois de 4 tentativas`);
}

const defeitos = {
  'tag HTML no corpo': 0,
  'corpo abrindo com <img>': 0,
  'dek acima de 320 chars': 0,
  'rodapé do veículo': 0,
  'aviso de paywall': 0,
  'a palavra "null"': 0,
};
let total = 0;
let semImagem = 0;
let semCorpo = 0;
const deks = [];
const exemplos = new Map();

function consumir(linhas) {
  for (const n of linhas) {
    total++;
    const dek = (n.description ?? '').trim();
    const corpo = (n.content ?? '').trim();

    deks.push(dek.length);
    if (!n.imageUrl) semImagem++;
    if (!corpo) semCorpo++;

    const marcar = (chave, condicao) => {
      if (!condicao) return;
      defeitos[chave]++;
      if (!exemplos.has(chave)) {
        exemplos.set(chave, `${n.id.slice(0, 8)} [${n.source}] ${n.title.slice(0, 50)}`);
      }
    };

    marcar('tag HTML no corpo', corpo && HTML_TAG.test(corpo));
    marcar('corpo abrindo com <img>', /^\s*<img/i.test(corpo));
    marcar('dek acima de 320 chars', dek.length > DEK_MAX);
    marcar('rodapé do veículo', PUBLISHER_FOOTER.test(corpo) || PUBLISHER_FOOTER.test(dek));
    marcar('aviso de paywall', PAYWALL.test(corpo) || PAYWALL.test(dek));
    marcar('a palavra "null"', dek === 'null' || corpo === 'null');
  }
}

console.log(`Varrendo ${API}/news …`);

// **A falha de varredura sai como frase, não como stack trace.** Quem roda isto
// está perguntando "o acervo está limpo?"; um `Unexpected token '<'` com trinta
// linhas de pilha não responde nem a essa pergunta nem à seguinte.
let primeira;
try {
  primeira = await page(1);
} catch (erro) {
  console.error(`\nNão deu para varrer o acervo.\n\n  ${erro.message}\n`);
  console.error(
    `Se a API estiver suspensa, o teto de horas do plano free do Render acabou —\n` +
      `ele zera no dia 1º. Ver docs/setup.md §9.0.`,
  );
  process.exit(2);
}

consumir(primeira.data);
const paginas = Math.min(primeira.meta.totalPages, MAX_PAGES);
for (let p = 2; p <= paginas; p++) {
  consumir((await page(p)).data);
  if (p % 10 === 0) process.stdout.write(`.${p}`);
}
if (paginas >= 10) console.log('');

const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
deks.sort((a, b) => a - b);
const q = (f) => deks[Math.floor(deks.length * f)] ?? 0;

console.log(`\n=== HIGIENE DO ACERVO — ${total} notícias ===\n`);
let reprovou = false;
for (const [nome, n] of Object.entries(defeitos)) {
  const ok = n === 0;
  if (!ok) reprovou = true;
  console.log(
    `  ${ok ? 'ok  ' : 'FALHA'}  ${nome.padEnd(26)} ${String(n).padStart(5)} (${pct(n).padStart(6)})` +
      (ok ? '' : `\n           ex.: ${exemplos.get(nome)}`),
  );
}

console.log(`\n=== O DEK (teto da ingestão: ${DEK_MAX}) ===`);
console.log(`  p50=${q(0.5)}  p90=${q(0.9)}  p99=${q(0.99)}  máximo=${deks.at(-1)}`);
console.log(`  antes da Fase 12: p50=594  p90=5.613  máximo=33.073`);

console.log(`\n=== INFORMATIVO (não reprova) ===`);
console.log(`  sem imagem:  ${semImagem} (${pct(semImagem)})  — a tela desenha card de texto`);
console.log(`  sem corpo:   ${semCorpo} (${pct(semCorpo)})  — a tela leva à fonte`);

if (reprovou) {
  console.log(
    `\nAlguma classe de defeito ainda tem linha.\n` +
      `A higiene alcança o acervo pela **etapa 8.5 do pipeline**, que roda uma vez\n` +
      `por dia. Se o deploy da correção foi hoje, espere o cron das 08:00 BRT — ou\n` +
      `force com POST /api/jobs/renormalize-news (ver docs/api.md).`,
  );
  process.exit(1);
}

console.log(`\nAcervo limpo.`);
