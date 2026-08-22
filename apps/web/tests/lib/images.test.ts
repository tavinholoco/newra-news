import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Auditoria de imagem da Fase 7 (§17), como guarda e não como passada manual.
 *
 * As três regras abaixo já valem no código de hoje. Elas existem porque nenhuma
 * delas quebra build, lint ou tipo quando for violada: `fill` sem `sizes` faz o
 * Next baixar a maior variante em todo aparelho, `<img>` cru pula o
 * redimensionamento e o `alt` ausente só aparece numa auditoria de
 * acessibilidade — três dias depois, em produção.
 */

const WEB_ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'components'].map((dir) =>
  path.resolve(WEB_ROOT, dir),
);

/**
 * Comentário fora, e não é detalhe: este repositório explica as decisões no
 * próprio arquivo, e um `<img>` citado em prosa (`logo.tsx` explica por que o
 * SVG inline não é um) reprovaria a varredura sem haver `<img>` nenhum.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function collectSources(): Array<{ file: string; source: string }> {
  const files: Array<{ file: string; source: string }> = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx$/.test(entry)) {
        files.push({
          file: path.relative(WEB_ROOT, full).replace(/\\/g, '/'),
          source: stripComments(readFileSync(full, 'utf8')),
        });
      }
    }
  }

  for (const dir of SOURCE_DIRS) walk(dir);
  return files;
}

const SOURCES = collectSources();

/** Corpo de cada abertura de tag `<Nome ... >`, com o arquivo de origem. */
function jsxOpenings(
  tagPattern: string,
): Array<{ file: string; tag: string; body: string }> {
  const opening = new RegExp(`<(${tagPattern})\\b([^>]*?)/?>`, 'gs');

  return SOURCES.flatMap(({ file, source }) =>
    [...source.matchAll(opening)].map((match) => ({
      file,
      tag: match[1] ?? '',
      body: match[2] ?? '',
    })),
  );
}

describe('auditoria de imagem', () => {
  it('há fontes para varrer', () => {
    expect(SOURCES.length).toBeGreaterThan(50);
  });

  it('nenhuma imagem de conteúdo entra como <img> cru', () => {
    // `<img>` pula o redimensionamento, o formato moderno e a reserva de
    // espaço do `next/image` — e é o caminho mais curto para CLS.
    const raw = SOURCES.flatMap(({ file, source }) =>
      [...source.matchAll(/<img\b[^>]*>/g)].map(
        (match) => `${file}: ${match[0].slice(0, 60)}`,
      ),
    );

    expect(raw).toEqual([]);
  });

  it('toda imagem com `fill` declara `sizes`', () => {
    // Sem `sizes`, `fill` faz o Next servir a maior variante em todo aparelho:
    // o mobile baixa a imagem de desktop. É por isso que `StoryImage` já exige
    // `sizes` no tipo — esta guarda cobre quem chamar `Image` direto.
    const semSizes = jsxOpenings('Image|SafeImage|StoryImage')
      .filter(({ body }) => /\bfill\b/.test(body) && !/\bsizes[=]/.test(body))
      .map(({ file, tag }) => `${file}: <${tag} fill> sem sizes`);

    expect(semSizes).toEqual([]);
  });

  it('toda imagem declara `alt`, nem que seja vazio', () => {
    // `alt=''` é uma decisão legítima (o avatar do perfil, com o nome ao lado);
    // `alt` ausente faz o leitor de tela ler a URL do arquivo.
    const semAlt = jsxOpenings('Image|SafeImage|StoryImage')
      .filter(({ body }) => !/\balt[=]/.test(body))
      .map(({ file, tag }) => `${file}: <${tag}> sem alt`);

    expect(semAlt).toEqual([]);
  });

  it('`priority` só onde a imagem pode ser o LCP', () => {
    // `priority` em imagem abaixo da dobra disputa banda com o que está na
    // dobra e piora o LCP em vez de melhorar. Os três lugares onde ela pode
    // ser o maior elemento visível são o hero da Home, o hero das telas de
    // leitura e o card líder das listagens.
    const permitido = [
      'components/editorial/hero-story.tsx',
      'components/editorial/article-hero.tsx',
      'components/editorial/story-card.tsx',
      // Não decide nada: só repassa o `priority` que os três acima escolhem.
      'components/editorial/story-image.tsx',
    ];

    const inesperado = jsxOpenings('Image|SafeImage|StoryImage')
      .filter(({ body }) => /\bpriority\b/.test(body))
      .map(({ file }) => file)
      .filter((file) => !permitido.includes(file));

    expect(inesperado).toEqual([]);
  });
});
