import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  plainSummary,
  plainTitle,
  stripInlineMarkdown,
} from '@/lib/markdown-text';

/**
 * **Os dois campos de texto puro do briefing, e quem os le.**
 *
 * `Article.title` e `Article.summary` saem do Markdown que a IA escreve e vao
 * direto para `<h1>`, `<meta name="description">`, `og:title`, o JSON-LD, o
 * sitemap do Google Noticias e os cards — nenhum deles renderiza Markdown.
 *
 * Medido em 01/09/2026, nos 88 briefings retidos em producao: **34,1% dos
 * titulos e 21,6% dos subtitulos** carregavam marcador de enfase, e **19,3% dos
 * titulos** abriam com o rotulo `TITULO:` impresso como valor.
 */
describe('markdown-text', () => {
  describe('stripInlineMarkdown', () => {
    it('tira os marcadores e preserva o texto', () => {
      expect(stripInlineMarkdown('o **Ibovespa** hoje')).toBe('o Ibovespa hoje');
      expect(stripInlineMarkdown('*Em meio a um cenario*')).toBe(
        'Em meio a um cenario',
      );
      expect(stripInlineMarkdown('**INTRODUCAO:**')).toBe('INTRODUCAO:');
    });

    it('nao mexe em asterisco que nao e enfase', () => {
      // O `\S` das duas pontas e o que segura estes tres.
      expect(stripInlineMarkdown('3 * 4 = 12')).toBe('3 * 4 = 12');
      expect(stripInlineMarkdown('nota de rodape *')).toBe('nota de rodape *');
      expect(stripInlineMarkdown('sem marcador nenhum')).toBe(
        'sem marcador nenhum',
      );
    });
  });

  describe('plainTitle', () => {
    it('tira a enfase — o caso de 2026-08-18 em producao', () => {
      expect(
        plainTitle('**Ibovespa em xeque: tensao global e o boom do cobre**'),
      ).toBe('Ibovespa em xeque: tensao global e o boom do cobre');
    });

    it('tira o rotulo do campo impresso como valor', () => {
      expect(plainTitle('**TITULO:** Uma jornada complexa')).toBe(
        'Uma jornada complexa',
      );
      expect(plainTitle('**Titulo:** Explosao em todo o pais')).toBe(
        'Explosao em todo o pais',
      );
      // O caso de 2026-07-27: os dois pontos ficam **fora** da enfase.
      expect(plainTitle('**TITULO**: Lula e Xi Jinping discutem acordo')).toBe(
        'Lula e Xi Jinping discutem acordo',
      );
    });

    it('tira as aspas do valor do rotulo, e so nesse caso', () => {
      expect(plainTitle('**TITULO:** "Bracos de Incendio"')).toBe(
        'Bracos de Incendio',
      );
      // Sem rotulo, as aspas ficam: uma manchete pode ser uma citacao inteira,
      // e desfazer isso seria adivinhar.
      expect(plainTitle('"Nao vou recuar"')).toBe('"Nao vou recuar"');
    });

    it('deixa em paz o titulo que ja esta limpo', () => {
      const limpo = 'Ibovespa recua com tensao global e agenda do Congresso';
      expect(plainTitle(limpo)).toBe(limpo);
    });
  });

  describe('plainSummary', () => {
    it('tira a enfase do subtitulo — o defeito visivel em 01/09/2026', () => {
      expect(
        plainSummary('Hoje a Bolsa, representada pelo **Ibovespa**, recuou.'),
      ).toBe('Hoje a Bolsa, representada pelo Ibovespa, recuou.');
    });

    it('nao tenta consertar subtitulo degenerado', () => {
      // O texto certo nao esta no campo. Quem impede de nascer e o
      // `deriveSummary` da API; os retidos envelhecem com a retencao de 90 dias.
      expect(plainSummary('**INTRODUCAO:**')).toBe('INTRODUCAO:');
      expect(plainSummary('---')).toBe('---');
    });
  });

  /**
   * **A guarda que existe para a proxima tela.**
   *
   * Este defeito nasceu porque um campo novo foi exibido sem que ninguem
   * perguntasse de onde ele vinha. A varredura enumera **todo** modulo de
   * producao que le `.title` ou `.summary` de um briefing e exige que a leitura
   * passe pelo helper — sem isso, a tela seguinte nasce com asterisco.
   */
  describe('nenhum modulo de producao le os dois campos crus', () => {
    const WEB = join(__dirname, '..', '..');
    const RAIZES = ['app', 'components', 'lib'];
    /** `article.title`, `briefing.summary` — a leitura do campo de um briefing. */
    const LEITURA = /\b(?:article|briefing)\.(title|summary)\b/g;

    function fontes(dir: string): string[] {
      const saida: string[] = [];
      for (const entrada of readdirSync(dir)) {
        const caminho = join(dir, entrada);
        if (statSync(caminho).isDirectory()) saida.push(...fontes(caminho));
        else if (/\.tsx?$/.test(entrada)) saida.push(caminho);
      }
      return saida;
    }

    it('toda leitura de .title ou .summary esta envolvida pelo helper', () => {
      const cruas: string[] = [];

      for (const raiz of RAIZES) {
        for (const arquivo of fontes(join(WEB, raiz))) {
          const fonte = readFileSync(arquivo, 'utf8');
          if (arquivo.endsWith(join('lib', 'markdown-text.ts'))) continue;

          for (const achado of fonte.matchAll(LEITURA)) {
            const inicio = achado.index ?? 0;
            // O helper tem de estar **imediatamente** antes da leitura: basta
            // olhar o que abre o parenteses que a envolve.
            const antes = fonte.slice(Math.max(0, inicio - 14), inicio);
            const esperado =
              achado[1] === 'title' ? 'plainTitle(' : 'plainSummary(';
            if (!antes.endsWith(esperado)) {
              const linha = fonte.slice(0, inicio).split('\n').length;
              cruas.push(
                `${arquivo.slice(WEB.length + 1)}:${linha} — ${achado[0]}`,
              );
            }
          }
        }
      }

      expect(cruas).toEqual([]);
    });
  });
});
