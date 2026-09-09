import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * **O otimizador de imagem aceita qualquer host, e isso é aceite de risco
 * escrito — não descuido.** A guarda existe para travar o que o aceite
 * pressupõe.
 *
 * A §10.6 dava duas saídas: derivar a lista de hosts das fontes configuradas,
 * ou aceitar e registrar. A revisão tentou a primeira, escreveu a lista, e
 * mediu que ela não funciona: o pipeline ingere a **NewsData.io** além dos 13
 * feeds, e ela agrega centenas de veículos. Sobre 3.000 itens do acervo —
 * **87 fontes distintas, 12 delas em `rss-sources.ts`; 95 hosts de imagem
 * distintos** — a lista fechada cobria 77,6%, e os outros **22,4% virariam o
 * placeholder de marca em silêncio**.
 *
 * Com o host aberto, o que limita o custo do abuso é **quantas transformações
 * distintas uma URL qualquer pode provocar**. Esse teto é o que este arquivo
 * protege, e é por isso que ele mora em `tests/security/`: afrouxar
 * `deviceSizes` ou tirar um limite de `sizes` não quebra tela nenhuma, e é
 * exatamente por isso que voltaria sem ninguém notar.
 */

const WEB_ROOT = process.cwd();
const CONFIG = readFileSync(path.resolve(WEB_ROOT, 'next.config.js'), 'utf8');

/** Comentário fora: o próprio config **explica** o curinga em prosa. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const CONFIG_SEM_COMENTARIO = stripComments(CONFIG);

function listaNumerica(campo: string): number[] {
  const match = CONFIG_SEM_COMENTARIO.match(new RegExp(`${campo}:\\s*\\[([^\\]]*)\\]`));
  if (!match?.[1]) return [];
  return match[1]
    .split(',')
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n));
}

describe('o teto de transformações do otimizador', () => {
  it('as larguras de dispositivo param onde o layout para', () => {
    // Nenhuma caixa do produto passa de ~800 px de CSS, e todo `sizes` termina
    // em largura fixa acima do breakpoint do contêiner. `2048` e `3840` são
    // variantes que nenhuma tela mostra e que qualquer URL pode pedir.
    const deviceSizes = listaNumerica('deviceSizes');

    expect(deviceSizes.length).toBeGreaterThan(0);
    expect(Math.max(...deviceSizes)).toBeLessThanOrEqual(1920);

    /**
     * **O teto caiu de 6 para 4 em 09/09/2026, e o número foi cobrado por uma
     * cota estourada, não escolhido.**
     *
     * A lista era o multiplicador: **29 imagens de origem na home gerando 279
     * alvos distintos** (~9,6 larguras cada), contra as **5.000
     * transformações/mês** do plano Hobby — medidas em **5.119**, com o site no
     * ar sem foto nenhuma enquanto durou.
     *
     * Devolver um degrau aqui é gratuito na tela e caro na cota, que é
     * exatamente a forma de mudança que volta sem ninguém notar — o motivo de
     * este arquivo existir. Se um degrau precisar voltar, o lugar de justificar
     * é o comentário do `next.config.js`, junto com a conferência degrau a
     * degrau que está lá.
     */
    expect(deviceSizes.length).toBeLessThanOrEqual(4);
  });

  it('há um formato só', () => {
    // Cada formato **dobra** as variantes por imagem. Medido: a origem da
    // imagem que abre a `/news` pesa 2,8 MB, e todo MISS paga esse download
    // antes de transformar — AVIF trocaria ~60 kB de rede por mais um fetch de
    // 2,8 MB na origem.
    const formats = CONFIG_SEM_COMENTARIO.match(/formats:\s*\[([^\]]*)\]/)?.[1] ?? '';

    expect(formats.split(',').filter((f) => f.trim()).length).toBe(1);
    expect(formats).toContain('image/webp');
  });

  it('o cache do otimizador não cai no default de 60 segundos', () => {
    // Fonte que não mande `Cache-Control` cairia nele, e o otimizador voltaria
    // à origem a cada minuto — buscando os 2,8 MB de novo.
    const ttl = CONFIG_SEM_COMENTARIO.match(/minimumCacheTTL:\s*([^,\n]+)/)?.[1] ?? '';

    // eslint-disable-next-line no-eval -- expressão aritmética do próprio config
    expect(eval(ttl)).toBeGreaterThanOrEqual(60 * 60 * 24);
  });

  it('o cache do otimizador sobrevive à matéria que ele serve', () => {
    /**
     * **O TTL tem de passar da retenção de `News`, não empatar com ela.**
     *
     * O cleanup do pipeline apaga notícia com mais de **30 dias**. Com o TTL em
     * 30 exatos — como esteve até 09/09/2026 — a variante podia expirar no
     * último dia de vida da matéria e ser transformada de novo para servir uma
     * página que sai do ar em seguida: transformação paga por nada, na cota que
     * já tinha estourado.
     *
     * O número da retenção vem do `CLAUDE.md` da API ("News >30 dias") e é o
     * mesmo que o `cleanup` aplica; se ele mudar, esta asserção é o lugar que
     * cobra o TTL junto.
     */
    const RETENCAO_NEWS_DIAS = 30;
    const ttl = CONFIG_SEM_COMENTARIO.match(/minimumCacheTTL:\s*([^,\n]+)/)?.[1] ?? '';

    // eslint-disable-next-line no-eval -- expressão aritmética do próprio config
    expect(eval(ttl)).toBeGreaterThan(60 * 60 * 24 * RETENCAO_NEWS_DIAS);
  });

  it('o aceite de risco continua escrito ao lado do curinga', () => {
    // Achado de segurança não vira dívida sem aceite escrito (§28). Se alguém
    // apagar a justificativa e deixar o `'**'`, isto reprova.
    expect(CONFIG_SEM_COMENTARIO).toContain("hostname: '**'");
    expect(CONFIG).toMatch(/Gatilho para revisitar/);
    expect(CONFIG).toMatch(/NewsData\.io/);
  });
});

describe('os `sizes` limitados em pixel', () => {
  /**
   * **A raiz do `uses-responsive-images` da `/news`.** `66vw` num monitor de
   * 2560 px pede 1.690 px de imagem — mas o contêiner trava em 1.280 px e a
   * caixa do hero nunca passa de ~800. Sem o limite em pixel acima do
   * breakpoint, o `srcset` deixa o navegador pedir a maior variante para
   * desenhar 800 — e, com o host aberto, é uma transformação a mais por URL.
   */
  const COM_SIZES = [
    'components/editorial/hero-story.tsx',
    'components/editorial/story-card.tsx',
    'components/editorial/related-stories.tsx',
    'components/editorial/category-section.tsx',
    // Já nasceu com o limite: `768px` é a largura de `max-w-narrow`.
    'components/editorial/article-hero.tsx',
    // `96px` fixo — a miniatura não muda de tamanho.
    'components/editorial/story-card-horizontal.tsx',
  ];

  it('todo `sizes` termina em largura fixa, nunca em unidade de viewport', () => {
    const semLimite = COM_SIZES.filter((file) => {
      const source = readFileSync(path.resolve(WEB_ROOT, file), 'utf8');

      // Toda string que se pareça com um valor de `sizes`. Casar por
      // `sizes='...'` deixaria de fora a `category-section`, onde o valor é
      // uma expressão ternária de duas linhas — e "não encontrei" viraria
      // "está tudo certo", que é o pior modo de falha de uma varredura.
      const sizes = [...source.matchAll(/'((?:\([^']*\)\s*)?[^']*(?:vw|px)[^']*)'/g)]
        .map((m) => m[1] ?? '')
        .filter((value) => /\d(vw|px)/.test(value));

      // Arquivo sem valor nenhum também é falha: significa que a varredura
      // deixou de enxergar o que deveria vigiar.
      if (sizes.length === 0) return true;
      return sizes.some((value) => /vw\s*$/.test(value.trim()));
    });

    expect(semLimite).toEqual([]);
  });

  it('o hero usa a fração que a grade realmente entrega', () => {
    // `62vw`, não `66vw`: o hero ocupa 2 de 3 colunas **menos** o gutter e um
    // gap. Medido nas duas pontas da faixa fluida — 634 px de 1024 (61,97%) e
    // 800 px de 1280 (62,48%).
    const hero = readFileSync(
      path.resolve(WEB_ROOT, 'components/editorial/hero-story.tsx'),
      'utf8',
    );

    expect(hero).toContain('(max-width: 1280px) 62vw, 800px');
  });
});
