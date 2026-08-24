import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * As guardas do 10.S sobre **o que a página leva para o navegador**: HTML
 * injetado no DOM, janela aberta para terceiro, variável que vai para o bundle
 * e dependência que entra na árvore de produção.
 *
 * Todas as quatro estão limpas hoje. É por isso que viram guarda e não
 * correção: resultado limpo que ninguém trava volta a sujar na próxima tela —
 * e nenhuma das quatro quebra build, lint ou tipo quando quebrar.
 */

const WEB_ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'components', 'lib', 'i18n'].map((dir) =>
  path.resolve(WEB_ROOT, dir),
);

/**
 * Comentário fora — este repositório explica a decisão no próprio arquivo, e a
 * prosa que **cita** `dangerouslySetInnerHTML` ou `target='_blank'` reprovaria
 * a varredura sem haver uso nenhum.
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
      } else if (/\.tsx?$/.test(entry)) {
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

const PACKAGE = JSON.parse(
  readFileSync(path.resolve(WEB_ROOT, 'package.json'), 'utf8'),
) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };

describe('superfície do navegador', () => {
  it('há fontes para varrer', () => {
    expect(SOURCES.length).toBeGreaterThan(80);
  });

  describe('HTML injetado no DOM', () => {
    /**
     * Os dois usos auditados, e **por que cada um é seguro**. A guarda existe
     * para o **terceiro**: `dangerouslySetInnerHTML` num componente que receba
     * texto de feed RSS seria XSS assinado pelo site, e a revisão não estaria
     * lá para ver.
     */
    const PERMITIDO: Record<string, string> = {
      'components/seo/json-ld.tsx':
        'payload montado por lib/json-ld.ts e serializado com escape de <, >, & e U+2028/9',
      'components/theme/theme-init.tsx':
        'constante estática do módulo, sem interpolação de nada',
    };

    it('só os dois arquivos auditados injetam HTML', () => {
      const usos = SOURCES.filter(({ source }) =>
        source.includes('dangerouslySetInnerHTML'),
      ).map(({ file }) => file);

      expect(usos.sort()).toEqual(Object.keys(PERMITIDO).sort());
    });

    it('o `article-body` continua sem renderizar Markdown', () => {
      // A decisão foi tomada por peso de bundle — `react-markdown` custaria
      // ~40 kB na rota mais lida —, e **ela também é a mitigação de XSS** do
      // texto gerado por IA: não existe caminho de HTML externo para o DOM.
      // Trocar por uma biblioteca de Markdown perderia a propriedade junto, e
      // é isso que esta linha congela.
      const markdown = SOURCES.filter(({ source }) =>
        /from ['"](react-markdown|marked|markdown-it|remark-html)['"]/.test(source),
      ).map(({ file }) => file);

      expect(markdown).toEqual([]);
    });
  });

  describe('janela aberta para terceiro', () => {
    it('todo `target="_blank"` leva `rel` com noopener', () => {
      // Sem `noopener`, a página de destino recebe `window.opener` e pode
      // reescrever a aba de origem. Eram 4 de 4 corretos quando a fase abriu —
      // e resultado limpo vira guarda, não comemoração.
      const semRel = SOURCES.flatMap(({ file, source }) =>
        [...source.matchAll(/<(\w+)[^>]*?target=['"]_blank['"][^>]*?>/gs)]
          .filter((match) => !/rel=['"][^'"]*noopener/.test(match[0]))
          .map(() => file),
      );

      expect(semRel).toEqual([]);
    });
  });

  describe('o que vai para o bundle', () => {
    /**
     * **`NEXT_PUBLIC_*` é público por definição** — o valor é substituído no
     * código no build e vai para o JavaScript que qualquer um baixa. As duas
     * que existem são endereços, e endereço não é segredo.
     */
    const PUBLICAS = ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SITE_URL'];

    it('nenhuma env pública nova entrou sem decisão', () => {
      const usadas = new Set(
        SOURCES.flatMap(({ source }) =>
          [...source.matchAll(/process\.env\.(NEXT_PUBLIC_\w+)/g)].map((m) => m[1] ?? ''),
        ),
      );

      expect([...usadas].sort()).toEqual([...PUBLICAS].sort());
    });

    it('nenhum segredo é lido num arquivo de cliente', () => {
      // `process.env.X` num `'use client'` não é erro de build: o Next
      // substitui o que casa com `NEXT_PUBLIC_` e devolve `undefined` no
      // resto. O defeito é o inverso do esperado — o segredo não vaza, a
      // funcionalidade some, em silêncio e só no navegador.
      // `NODE_ENV` é a exceção, e é do próprio Next: ele a substitui em
      // qualquer bundle, sem o prefixo, e é assim que o `app/providers.tsx`
      // deixa o devtools do TanStack Query fora do build de produção
      // (conferido: a string não aparece em nenhum chunk de `.next/static`).
      const vazamentos = SOURCES.filter(
        ({ source }) =>
          /^['"]use client['"]/m.test(source) &&
          /process\.env\.(?!NEXT_PUBLIC_|NODE_ENV\b)\w+/.test(source),
      ).map(({ file }) => file);

      expect(vazamentos).toEqual([]);
    });
  });

  describe('a árvore de dependências de produção', () => {
    /**
     * Dependência de produção ⇒ quem a consome. **Este mapa achou um defeito
     * real:** o `shadcn` — que é uma CLI de scaffolding, nunca importada por
     * uma linha do produto — estava em `dependencies`, e arrastava
     * `@modelcontextprotocol/sdk`, `express`, `hono`, `ts-morph` e
     * `@dotenvx/dotenvx` para a árvore de produção. **47 das 83 advisories de
     * produção do web só existiam por causa dele**, 10 delas *high*.
     *
     * A guarda é exaustiva de propósito, no formato que a Fase 9 firmou (rota
     * ⇒ documentação, coluna ⇒ schema): dependência nova exige uma linha aqui,
     * e escrever a linha obriga a responder "quem importa isso em runtime?".
     */
    const CONSUMIDORES: Record<string, string> = {
      '@base-ui/react': 'components/ui/{badge,button,input}.tsx',
      '@newranews/types': 'contratos compartilhados, 39 arquivos',
      '@tanstack/react-query': 'lib/queries.ts + app/providers.tsx',
      'class-variance-authority': 'components/ui/{badge,button}.tsx',
      clsx: 'lib/utils.ts (o `cn`)',
      jose: 'lib/jwt.ts — assina o JWT do upsert para a API',
      'lucide-react': 'ícones, 38 arquivos',
      next: 'o framework',
      'next-auth': 'lib/auth.ts + app/api/auth/[...nextauth]',
      'next-intl': 'i18n/, middleware.ts e toda tela',
      react: 'o runtime',
      'react-dom': 'o runtime',
      'tailwind-merge': 'lib/utils.ts (o `cn`)',
      'tw-animate-css': '@import em styles/globals.css — entra no CSS do build',
    };

    it('toda dependência de produção tem consumidor declarado', () => {
      const semDono = Object.keys(PACKAGE.dependencies).filter(
        (dep) => !(dep in CONSUMIDORES),
      );

      expect(semDono).toEqual([]);
    });

    it('nenhum consumidor declarado sobreviveu à remoção da dependência', () => {
      const orfaos = Object.keys(CONSUMIDORES).filter(
        (dep) => !(dep in PACKAGE.dependencies),
      );

      expect(orfaos).toEqual([]);
    });

    it('a CLI do shadcn fica fora da árvore de produção', () => {
      // Explícito porque foi o achado: o nome é o mesmo do design system e a
      // tentação de "reinstalar" com `pnpm add shadcn` é real.
      expect(PACKAGE.dependencies).not.toHaveProperty('shadcn');
      expect(PACKAGE.devDependencies).toHaveProperty('shadcn');
    });
  });

  describe('as premissas do aceite de risco das advisories do `next`', () => {
    /**
     * As **8 advisories *high* do `next@14`** só têm correção em `15.x`, e o
     * salto arrasta `next-intl` 3 → 4 (que exige Next 15) e a mudança de
     * `params` para assíncrono nas 15 páginas. A dívida está registrada com o
     * gatilho — **o que a torna aceitável hoje é que nenhuma das oito alcança
     * esta aplicação**, e cada "nenhuma" é uma afirmação sobre a configuração:
     *
     * | Advisory | Por que não alcança |
     * |---|---|
     * | 3× DoS por Server Components / deserialização de RSC | não há Server Action |
     * | DoS no App Router via Server Actions | não há Server Action |
     * | SSRF em Server Actions em *custom server* | não há Server Action nem custom server |
     * | SSRF por upgrade de WebSocket | o app não serve WebSocket |
     * | Bypass de middleware no **Pages Router** com i18n | o app é App Router |
     * | SSRF em `rewrites` com host controlado pelo atacante | não há `rewrites` |
     *
     * **Este teste é o que impede o aceite de virar mentira.** No dia em que
     * alguém escrever a primeira Server Action ou o primeiro `rewrite`, a
     * premissa deixa de valer — e é aqui que isso aparece, no PR, e não numa
     * varredura seis meses depois.
     */
    it('não existe Server Action no projeto', () => {
      const serverActions = SOURCES.filter(({ source }) =>
        /^['"]use server['"]/m.test(source),
      ).map(({ file }) => file);

      expect(serverActions).toEqual([]);
    });

    it('o next.config.js não declara `rewrites` nem servidor customizado', () => {
      const config = readFileSync(path.resolve(WEB_ROOT, 'next.config.js'), 'utf8');

      expect(stripComments(config)).not.toMatch(/\brewrites\s*\(/);
      expect(PACKAGE.dependencies).not.toHaveProperty('express');
      // `next start` é o servidor do próprio Next; um `server.js` na raiz é o
      // que caracterizaria o *custom server* das duas advisories de SSRF.
      expect(readdirSync(WEB_ROOT)).not.toContain('server.js');
    });
  });
});

describe('o cookie da sessão', () => {
  /**
   * O que o next-auth entrega sozinho já está certo — `httpOnly`,
   * `sameSite: 'lax'`, e `secure` + prefixo `__Secure-` quando a
   * `NEXTAUTH_URL` é HTTPS. **A guarda é sobre não estragar isso**: declarar
   * `cookies` à mão fixaria o nome e tiraria o prefixo em produção, o que
   * derrubaria toda sessão viva no deploy seguinte.
   *
   * O que faltava era o prazo — era o default silencioso, e agora é decisão
   * escrita em `lib/auth.ts`.
   */
  it('a duração é explícita, e o nome do cookie continua com o next-auth', async () => {
    const { authOptions } = await import('@/lib/auth');

    expect(authOptions.session?.strategy).toBe('jwt');
    expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60);
    expect(authOptions.session?.updateAge).toBe(24 * 60 * 60);
    expect(authOptions.cookies).toBeUndefined();
  });
});
