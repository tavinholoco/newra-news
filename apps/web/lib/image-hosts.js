// @ts-check
'use strict';

/**
 * De onde a imagem de uma matéria pode vir (Fase 10.6 / 10.S).
 *
 * O `next.config.js` declarava `remotePatterns: [{ protocol: 'https',
 * hostname: '**' }]` — **qualquer host HTTPS**. Isso é o que fazia o acervo
 * funcionar, e é também um otimizador de imagem aberto: qualquer um podia
 * pedir ao domínio do site que buscasse, transformasse e servisse imagem de
 * terceiro, no custo e no nome do projeto. E o custo não é hipotético: a
 * imagem que abre a `/news` pesa **2,8 MB na origem** para virar 79 kB
 * servidos, e o otimizador paga esse download inteiro a cada MISS de cache.
 *
 * **A saída que a §10.6 do plano propunha não funciona como escrita.** Ela diz
 * "derivar a lista de hosts das fontes configuradas" — mas o feed é
 * `g1.globo.com` e a imagem vem de `s2-g1.glbimg.com`; o feed é
 * `feeds.bbci.co.uk` e a imagem vem de `ichef.bbci.co.uk`. **O host do feed
 * quase nunca é o host da imagem**, então derivar de `rss-sources.ts` daria uma
 * lista que bloqueia tudo.
 *
 * O que existe aqui é a lista **medida**, fonte a fonte, contra o acervo em
 * produção em 24/08/2026 (100 itens por fonte, via `GET /api/news?source=`):
 *
 * | Fonte | Host de imagem | Itens sem imagem |
 * |---|---|---|
 * | G1 | `s2-g1.glbimg.com` | 3 de 100 |
 * | Valor Econômico | `s2-valor.glbimg.com` | 37 de 100 |
 * | BBC Brasil | `ichef.bbci.co.uk` | 0 de 100 |
 * | Trivela | `trivela.com.br` | 0 de 100 |
 * | Superinteressante | `super.abril.com.br` | 0 de 77 |
 * | Veja Saúde | `saude.abril.com.br` | 0 de 90 |
 * | InfoMoney | `www.infomoney.com.br` | 94 de 100 |
 * | Folha de S.Paulo | — | **100 de 100** |
 * | TechCrunch | — | **100 de 100** |
 * | ESPN Brasil | — | **100 de 100** |
 * | Olhar Digital | — | **95 de 95** |
 * | Drauzio Varella | — | **44 de 44** |
 * | Reuters | — | **o feed devolve zero itens** |
 *
 * Isso também refina o "cerca de 30% do acervo não tem imagem" dos contratos:
 * não é aleatório, é **por fonte** — seis dos treze feeds não trazem imagem
 * nenhuma.
 *
 * **O risco que sobra, e como ele aparece:** se um veículo trocar de CDN, o
 * host novo cai fora da lista, `/_next/image` responde 400 e o `SafeImage`
 * desenha o placeholder de marca. A tela não quebra — mas também não grita. O
 * que torna isso observável é a **recaptura da baseline visual** (§30), que
 * roda contra produção e é determinística: uma fonte trocando de CDN aparece
 * como placeholder no diff. É o mecanismo que já existe, e é onde isso se vê.
 */

/**
 * @typedef {object} ImageSource
 * @property {string[]} hostnames Padrões de `remotePatterns`. Vazio = a fonte
 *   não traz imagem, e isso é medição, não omissão.
 * @property {string} nota Por que a entrada é assim.
 */

/**
 * Fonte RSS ⇒ host de imagem. **A chave é o `name` de
 * `apps/api/src/config/rss-sources.ts`**, e `tests/security/image-hosts.test.ts`
 * exige uma entrada para cada fonte registrada lá: feed novo na API reprova a
 * suíte do web até alguém decidir de onde a imagem dele pode vir.
 *
 * @type {Record<string, ImageSource>}
 */
const IMAGE_SOURCES = {
  G1: {
    hostnames: ['**.glbimg.com'],
    nota: 's2-g1.glbimg.com — o CDN da Globo usa um subdomínio por veículo',
  },
  'Valor Econômico': {
    hostnames: ['**.glbimg.com'],
    nota: 's2-valor.glbimg.com — mesmo CDN do G1',
  },
  'BBC Brasil': {
    hostnames: ['ichef.bbci.co.uk'],
    nota: 'host único e estável',
  },
  Trivela: {
    hostnames: ['trivela.com.br'],
    nota: 'WordPress servindo do próprio domínio',
  },
  Superinteressante: {
    hostnames: ['**.abril.com.br'],
    nota: 'super.abril.com.br — a Abril usa subdomínio por título',
  },
  'Veja Saúde': {
    hostnames: ['**.abril.com.br'],
    nota: 'saude.abril.com.br — mesmo padrão da Superinteressante',
  },
  InfoMoney: {
    hostnames: ['www.infomoney.com.br'],
    nota: 'traz imagem em 6 de 100 itens, do próprio domínio',
  },
  'Folha de S.Paulo': {
    hostnames: [],
    nota: 'o feed não traz imagem — 100 de 100 medidos sem `imageUrl`',
  },
  TechCrunch: {
    hostnames: [],
    nota: 'o feed não traz imagem — 100 de 100',
  },
  'ESPN Brasil': {
    hostnames: [],
    nota: 'o feed não traz imagem — 100 de 100',
  },
  'Olhar Digital': {
    hostnames: [],
    nota: 'o feed não traz imagem — 95 de 95',
  },
  'Drauzio Varella': {
    hostnames: [],
    nota: 'o feed não traz imagem — 44 de 44',
  },
  Reuters: {
    hostnames: [],
    nota: 'o feed devolve zero itens desde antes desta medição — ver a dívida no item 35 do progress.md',
  },
};

/**
 * Hosts que não vêm de feed nenhum: o avatar do provedor de OAuth.
 *
 * **É o que teria quebrado silenciosamente ao fechar os `remotePatterns`.** O
 * `profile-card` renderiza `session.user.image` com `next/image`, e sem estes
 * dois a foto do perfil viraria a inicial em círculo — numa tela atrás de
 * sessão, que nenhuma captura de baseline visita.
 */
const AVATAR_HOSTNAMES = [
  '**.googleusercontent.com',
  'avatars.githubusercontent.com',
];

/**
 * A lista para `images.remotePatterns`, sem repetição e em ordem estável.
 *
 * @returns {{ protocol: 'https', hostname: string }[]}
 */
function remotePatterns() {
  const hostnames = new Set([
    ...Object.values(IMAGE_SOURCES).flatMap((source) => source.hostnames),
    ...AVATAR_HOSTNAMES,
  ]);

  return [...hostnames]
    .sort()
    .map((hostname) => ({ protocol: /** @type {'https'} */ ('https'), hostname }));
}

module.exports = { IMAGE_SOURCES, AVATAR_HOSTNAMES, remotePatterns };
