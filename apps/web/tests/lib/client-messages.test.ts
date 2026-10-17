import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import ptBR from '@/messages/pt-BR.json';
import { PUBLIC_CLIENT_NAMESPACES, pickMessages } from '@/lib/i18n';

/**
 * **Só o que um componente cliente de página pública lê vai ao navegador** —
 * 16/10/2026.
 *
 * O `NextIntlClientProvider` do layout de idioma serializa as mensagens no
 * payload RSC de toda página, e o HTML leva a cópia de novo, escapada. Eram
 * os 31 KB do dicionário inteiro nas duas pontas de cada página da ISR, e a
 * Vercel cobra a escrita em unidades de 8 KB; metade era `admin`,
 * `dashboard` e `productMetrics`, que nenhuma página pública mostra.
 *
 * O recorte tem dois modos de falha, e esta suíte cobra os dois:
 *
 * - **faltou um namespace** — um card novo lê `useTranslations('x')` e a
 *   página pública imprime `x.chave` na tela, com a suíte de componente verde
 *   (ela monta o provider com o dicionário inteiro);
 * - **sobrou um namespace** — o peso volta a toda página sem ninguém ler.
 *
 * A lista é derivada de todo `useTranslations('…')` de arquivo `'use client'`
 * fora das áreas privadas, pelo parser. As áreas privadas (`/admin`,
 * `/account`, `/favorites`) recebem o dicionário inteiro pelo
 * `FullMessagesProvider` — e só em segmento `force-dynamic`, que não grava na
 * ISR.
 */

const WEB_ROOT = process.cwd();

/** As telas atrás de sessão e os componentes que só elas usam. */
const PRIVATE = [
  /^components\/(admin|dashboard|account)\//,
  /^app\/\[locale\]\/(admin|account)\//,
];
const isPrivate = (file: string) => PRIVATE.some((re) => re.test(file));

interface Source {
  file: string;
  ast: ts.SourceFile;
  text: string;
}

function collect(dir: string, out: Source[] = []): Source[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      const text = readFileSync(full, 'utf8');
      out.push({
        file: path.relative(WEB_ROOT, full).replace(/\\/g, '/'),
        ast: ts.createSourceFile(full, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
        text,
      });
    }
  }
  return out;
}

const SOURCES = ['app', 'components', 'lib'].flatMap((dir) => collect(path.resolve(WEB_ROOT, dir)));

function isClient({ ast }: Source): boolean {
  for (const statement of ast.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === 'use client') return true;
  }
  return false;
}

/** Cada `useTranslations(...)`: o namespace literal, ou `null` se não há. */
function translationCalls({ ast }: Source): Array<string | null> {
  const calls: Array<string | null> = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useTranslations'
    ) {
      const [first] = node.arguments;
      calls.push(first && ts.isStringLiteralLike(first) ? first.text : null);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return calls;
}

/** Os módulos que o arquivo importa, como caminho relativo à raiz do web. */
function imports({ file, ast }: Source): string[] {
  return ast.statements
    .filter(ts.isImportDeclaration)
    .filter((node) => !node.importClause?.isTypeOnly)
    .map((node) => (node.moduleSpecifier as ts.StringLiteral).text)
    .flatMap((spec) => {
      if (spec.startsWith('@/')) return [spec.slice(2)];
      if (spec.startsWith('.')) return [path.posix.join(path.posix.dirname(file), spec)];
      return [];
    });
}

const renders = (source: Source, tag: string) => source.text.includes(`<${tag}`);
const FORCE_DYNAMIC = /export const dynamic = ['"]force-dynamic['"]/;

const clientFiles = SOURCES.filter(isClient);
const publicClientFiles = clientFiles.filter(({ file }) => !isPrivate(file));

describe('o dicionário que vai ao navegador', () => {
  it('há o que varrer', () => {
    // Coletor que devolve nada passaria em tudo (a guarda de `console.*` da
    // Fase 1 do plano de observabilidade, cega a 481 linhas).
    expect(clientFiles.length).toBeGreaterThan(50);
    expect(publicClientFiles.map(({ file }) => file)).toContain('components/editorial/story-card.tsx');
    expect(clientFiles.map(({ file }) => file)).toContain('components/admin/admin-nav.tsx');
  });

  it('todo `useTranslations` de componente cliente diz o namespace', () => {
    // Sem o literal a lista não pode ser derivada — e a chave sem namespace
    // (`t('news.x')`) escaparia da conta.
    const semNamespace = clientFiles
      .filter((source) => translationCalls(source).includes(null))
      .map(({ file }) => file);

    expect(semNamespace).toEqual([]);
  });

  it('o recorte é exatamente o que as páginas públicas leem', () => {
    const lidos = new Set(publicClientFiles.flatMap((source) => translationCalls(source)));

    expect([...PUBLIC_CLIENT_NAMESPACES].sort()).toEqual([...lidos].sort());
  });

  it('o layout de idioma manda o recorte, e não o dicionário inteiro', () => {
    const layout = SOURCES.find(({ file }) => file === 'app/[locale]/layout.tsx');

    expect(layout?.text).toMatch(/messages=\{pickMessages\(messages, PUBLIC_CLIENT_NAMESPACES\)\}/);
  });

  it('o recorte deixa de fora o que só as telas atrás de sessão leem', () => {
    const recorte = pickMessages(ptBR, PUBLIC_CLIENT_NAMESPACES);

    for (const privado of ['admin', 'dashboard', 'productMetrics', 'account']) {
      expect(recorte).not.toHaveProperty(privado);
    }
    expect(Object.keys(recorte)).toEqual(Object.keys(ptBR).filter((ns) => ns in recorte));
    // Medido em 16/10/2026: 31.017 bytes inteiro, ~10 KB o recorte.
    expect(JSON.stringify(recorte).length).toBeLessThan(JSON.stringify(ptBR).length / 2);
  });
});

describe('as telas atrás de sessão recebem o dicionário inteiro', () => {
  it('os dois layouts privados renderizam o `FullMessagesProvider`', () => {
    for (const layout of ['app/[locale]/admin/layout.tsx', 'app/[locale]/account/layout.tsx']) {
      const source = SOURCES.find(({ file }) => file === layout);
      expect(source && renders(source, 'FullMessagesProvider'), layout).toBe(true);
    }
  });

  it('componente privado só é importado de tela que traz o dicionário inteiro', () => {
    // A `/favorites` mora fora de `/account` e usa a `AccountNav` — é o caso
    // que esta asserção existe para pegar.
    const fora = SOURCES.filter(({ file }) => !isPrivate(file))
      .filter((source) => imports(source).some((target) => isPrivate(target)))
      .filter((source) => !(source.file.startsWith('app/') && renders(source, 'FullMessagesProvider')))
      .map(({ file }) => file);

    expect(SOURCES.map(({ file }) => file)).toContain('app/[locale]/favorites/page.tsx');
    expect(fora).toEqual([]);
  });

  it('o dicionário inteiro só vai a segmento `force-dynamic`, que não grava na ISR', () => {
    const comProvider = SOURCES.filter(({ file }) => file.startsWith('app/')).filter((source) =>
      renders(source, 'FullMessagesProvider'),
    );

    expect(comProvider.map(({ file }) => file).sort()).toEqual([
      'app/[locale]/account/layout.tsx',
      'app/[locale]/admin/layout.tsx',
      'app/[locale]/favorites/page.tsx',
    ]);
    for (const source of comProvider) {
      expect(source.text, source.file).toMatch(FORCE_DYNAMIC);
    }
  });
});
