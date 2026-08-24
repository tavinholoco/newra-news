import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { IMAGE_SOURCES, AVATAR_HOSTNAMES, remotePatterns } from '@/lib/image-hosts';

/**
 * A guarda exaustiva do 10.6: **fonte RSS registrada ⇒ host de imagem
 * decidido.**
 *
 * É o formato que a Fase 9 firmou (rota ⇒ documentação, coluna do Prisma ⇒
 * schema de resposta, rota ⇒ linha na matriz de autorização): não impedir o
 * erro que já existe, e sim tornar impossível **o buraco novo**. Sem ela, o
 * próximo feed acrescentado a `rss-sources.ts` traria imagem de um host que o
 * otimizador recusa, e o sintoma seria o placeholder de marca aparecendo em
 * matéria que tem capa — sem erro, sem log, sem nada.
 *
 * **A leitura cruza a fronteira dos dois apps, e é estática de propósito.** O
 * arquivo é lido como texto, não importado: `turbo test` não constrói o
 * `apps/api`, e uma guarda que dependesse do `dist` passaria aqui e reprovaria
 * no CI — a armadilha que o `runtime-deps.test.ts` já registrou do outro lado.
 */

const RSS_SOURCES_FILE = path.resolve(
  process.cwd(),
  '../api/src/config/rss-sources.ts',
);

/** Os `name:` de `rssSources`, lidos do texto do arquivo. */
function registeredSources(): string[] {
  const source = readFileSync(RSS_SOURCES_FILE, 'utf8');
  return [...source.matchAll(/\{\s*name:\s*'([^']+)'/g)].map((m) => m[1] ?? '');
}

describe('hosts de imagem', () => {
  const FONTES = registeredSources();

  it('as fontes do backend foram encontradas', () => {
    // Se o formato de `rss-sources.ts` mudar, a varredura devolve zero e todas
    // as asserções abaixo passariam vazias — o pior modo de falha de uma
    // guarda exaustiva.
    expect(FONTES.length).toBe(13);
    expect(FONTES).toContain('G1');
  });

  it('toda fonte registrada tem host de imagem decidido', () => {
    const semDecisao = FONTES.filter((nome) => !(nome in IMAGE_SOURCES));

    expect(semDecisao).toEqual([]);
  });

  it('nenhuma decisão sobreviveu à remoção da fonte', () => {
    // Feed removido da API e entrada esquecida aqui abriria host para um
    // veículo que o produto não lê mais.
    const orfas = Object.keys(IMAGE_SOURCES).filter((nome) => !FONTES.includes(nome));

    expect(orfas).toEqual([]);
  });

  it('"sem imagem" é decisão escrita, não lista vazia por descuido', () => {
    // Seis das treze fontes não trazem `imageUrl` nenhuma — é medição, e a
    // nota é onde ela fica. Entrada sem nota seria omissão disfarçada.
    const semNota = Object.entries(IMAGE_SOURCES)
      .filter(([, source]) => source.nota.trim().length < 20)
      .map(([nome]) => nome);

    expect(semNota).toEqual([]);
  });

  describe('os `remotePatterns` que saem daqui', () => {
    const patterns = remotePatterns();
    const hostnames = patterns.map((p) => p.hostname);

    it('não aceitam qualquer host', () => {
      // O achado: `hostname: '**'` fazia do domínio do site um otimizador de
      // imagem aberto — qualquer um podia mandá-lo buscar, transformar e
      // servir imagem de terceiro. E o custo é medido: a origem da imagem que
      // abre a `/news` pesa 2,8 MB por MISS de cache.
      expect(hostnames).not.toContain('**');
      expect(patterns.every((p) => p.protocol === 'https')).toBe(true);
    });

    it('cobrem o avatar do OAuth, que não vem de feed nenhum', () => {
      // Sem isto, fechar a lista quebraria a foto do perfil — numa tela atrás
      // de sessão, que nenhuma captura de baseline visita.
      for (const host of AVATAR_HOSTNAMES) {
        expect(hostnames).toContain(host);
      }
    });

    it('cobrem todo host declarado pelas fontes', () => {
      const declarados = Object.values(IMAGE_SOURCES).flatMap((s) => s.hostnames);
      const faltando = declarados.filter((h) => !hostnames.includes(h));

      expect(faltando).toEqual([]);
    });

    it('não repetem host', () => {
      // G1 e Valor compartilham `**.glbimg.com`; Superinteressante e Veja
      // Saúde compartilham `**.abril.com.br`.
      expect(hostnames.length).toBe(new Set(hostnames).size);
    });
  });

  describe('o next.config.js', () => {
    const config = readFileSync(path.resolve(process.cwd(), 'next.config.js'), 'utf8');

    it('deriva os padrões deste módulo', () => {
      expect(config).toContain("require('./lib/image-hosts')");
      expect(config).toContain('remotePatterns: remotePatterns()');
    });

    it('não reintroduz o curinga', () => {
      // Comentário fora: o próprio `next.config.js` explica que **era**
      // `hostname: '**'`, e a prosa reprovaria a varredura sem haver curinga.
      const semComentario = config
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      expect(semComentario).not.toMatch(/hostname:\s*'\*\*'/);
    });
  });

  describe('os `sizes` limitados em pixel', () => {
    /**
     * **O `uses-responsive-images` da `/news`, na raiz.** `66vw` num monitor de
     * 2560 px pede 1.690 px de imagem — mas o contêiner trava em 1.280 px e a
     * caixa do hero nunca passa de ~800. Sem o limite em pixel acima do
     * breakpoint do contêiner, o `srcset` deixa o navegador pedir a variante
     * de 3840 para desenhar 800.
     */
    const COM_LIMITE = [
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
      const semLimite = COM_LIMITE.filter((file) => {
        const source = readFileSync(path.resolve(process.cwd(), file), 'utf8');
        const sizes = [...source.matchAll(/sizes(?:=|\s=\s)'([^']+)'/g)].map(
          (m) => m[1] ?? '',
        );
        return sizes.some((value) => /vw\s*$/.test(value.trim()));
      });

      expect(semLimite).toEqual([]);
    });
  });
});
