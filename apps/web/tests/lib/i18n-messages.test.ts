import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Category } from '@newranews/types';
import ptBR from '@/messages/pt-BR.json';
import en from '@/messages/en.json';

type JsonRecord = Record<string, unknown>;

function collectKeys(obj: JsonRecord, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      return collectKeys(value as JsonRecord, fullKey);
    }
    return [fullKey];
  });
}

/** Percorre recursivamente um diretório chamando `visit` para cada arquivo .ts/.tsx. */
function walkDir(dir: string, visit: (file: string) => void) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkDir(full, visit);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      visit(full);
    }
  }
}

describe('i18n messages', () => {
  it('pt-BR and en have identical key sets', () => {
    const ptKeys = collectKeys(ptBR).sort();
    const enKeys = collectKeys(en).sort();

    expect(enKeys).toEqual(ptKeys);
  });

  it('covers all 8 category keys in both locales', () => {
    for (const key of Object.values(Category)) {
      expect(ptBR.categories[key]).toBeTypeOf('string');
      expect(en.categories[key]).toBeTypeOf('string');
    }
  });

  it('no message key is left behind unused', () => {
    // Sem esta guarda, chave órfã se acumula em silêncio: a reescrita de uma
    // tela leva o `t('...')` embora e a string fica, traduzida nos dois
    // idiomas, para sempre. A revisão da Fase 5 encontrou sete de uma vez —
    // quatro delas nascidas na Fase 4.
    //
    // Namespaces resolvidos **dinamicamente** ficam de fora: `t(news.category)`
    // não tem o nome da chave escrito em lugar nenhum do código.
    const DYNAMIC_NAMESPACES = new Set([
      'categories',
      'categoryDescriptions',
      'newsPeriod',
      'newsSort',
      // `metadata` é namespace de namespaces: as páginas pedem
      // `getTranslations({ namespace: 'metadata.news' })` e depois `t('title')`,
      // então o caminho completo nunca aparece escrito. A cobertura dele é o
      // outro teste desta suíte, que confere que todo namespace usado existe.
      'metadata',
    ]);

    const sources: string[] = [];
    for (const dir of [
      path.resolve(process.cwd(), 'app'),
      path.resolve(process.cwd(), 'components'),
      path.resolve(process.cwd(), 'lib'),
    ]) {
      walkDir(dir, (file) => sources.push(readFileSync(file, 'utf8')));
    }
    const blob = sources.join('\n');

    const orphans = collectKeys(ptBR as JsonRecord).filter((fullKey) => {
      const [namespace, ...rest] = fullKey.split('.');
      if (!namespace || rest.length === 0) return false;
      if (DYNAMIC_NAMESPACES.has(namespace)) return false;

      // O caminho **sem o namespace** é o que o código escreve: o namespace vem
      // do `useTranslations('footer')` e a chave, do `t('items.stack')`. Buscar
      // só a folha perderia toda chave aninhada.
      const lookup = rest.join('.');
      return !new RegExp(`['"\`]${lookup.replace(/\./g, '\\.')}['"\`]`).test(blob);
    });

    expect(orphans).toEqual([]);
  });

  it('every namespace used in the code exists in both messages files', () => {
    const usedNamespaces = new Set<string>();
    // Cobre as duas formas: getTranslations('ns') e getTranslations({namespace: 'ns'})
    const namespaceRe =
      /(?:useTranslations|getTranslations)\(['"]([^'"]+)['"]|namespace:\s*['"]([^'"]+)['"]/g;
    const sourceDirs = [
      path.resolve(process.cwd(), 'app'),
      path.resolve(process.cwd(), 'components'),
    ];

    for (const dir of sourceDirs) {
      walkDir(dir, (file) => {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(namespaceRe)) {
          usedNamespaces.add(match[1] ?? match[2]!);
        }
      });
    }

    expect(usedNamespaces.size).toBeGreaterThan(0);
    for (const namespace of usedNamespaces) {
      expect(ptBR, `pt-BR missing namespace: ${namespace}`).toHaveProperty(
        namespace,
      );
      expect(en, `en missing namespace: ${namespace}`).toHaveProperty(
        namespace,
      );
    }
  });
});
