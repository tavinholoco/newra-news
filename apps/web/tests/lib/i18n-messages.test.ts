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
