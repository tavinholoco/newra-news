import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda **estática** sobre o conjunto de migrations.
 *
 * Estática porque `turbo test` roda sem banco — a suíte inteira do backend
 * roda sem `DATABASE_URL` de verdade, e é o que a mantém rápida no CI. Uma
 * guarda que precisasse subir Postgres não rodaria, e uma que lesse um banco
 * local passaria na máquina de quem a escreveu e reprovaria no CI (é a mesma
 * armadilha do `runtime-deps.test.ts`, escrita ao contrário).
 *
 * O que ela tranca é o que já quebrou: a Fase 0 achou uma `0_init` **com o
 * banner do CLI colado dentro do SQL** — ela não replicava — e um
 * `migration_lock.toml` faltando.
 *
 * **O replay de verdade não cabe aqui, e foi feito à mão na revisão da Fase 9**
 * (23/08/2026): banco limpo, `prisma migrate deploy` das quatro, e
 * `prisma migrate diff` contra o `schema.prisma` devolvendo "No difference
 * detected". Era a primeira vez que as quatro rodavam do zero — o banco local
 * está baselinado com `migrate resolve`, que marca como aplicada sem executar
 * o SQL. O resultado está registrado na `docs/progress.md`.
 */

const MIGRATIONS_DIR = join(__dirname, '../../../../packages/database/prisma/migrations');

function migrationDirs(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

describe('9.3 — o conjunto de migrations', () => {
  it('has a migration_lock.toml declaring the provider', () => {
    const lock = readFileSync(join(MIGRATIONS_DIR, 'migration_lock.toml'), 'utf8');

    expect(lock).toContain('provider = "postgresql"');
  });

  it('gives every migration a migration.sql that is not empty', () => {
    const dirs = migrationDirs();
    expect(dirs.length).toBeGreaterThan(0);

    for (const dir of dirs) {
      const sqlPath = join(MIGRATIONS_DIR, dir, 'migration.sql');
      expect(existsSync(sqlPath), `${dir} has no migration.sql`).toBe(true);
      expect(readFileSync(sqlPath, 'utf8').trim().length, `${dir} is empty`).toBeGreaterThan(0);
    }
  });

  it('keeps CLI output out of the SQL — the defect the Fase 0 found', () => {
    // O `0_init` daquela vez trazia o banner do `prisma migrate diff` colado no
    // topo do arquivo. `tsc` não lê SQL, a suíte não lê SQL, e a migration só
    // falhava na hora de aplicar — num banco novo, que é a hora em que ninguém
    // tem tempo.
    const noise = [
      'Prisma schema loaded',
      'Datasource "db"',
      'npx prisma',
      '✔',
      'Environment variables loaded',
    ];

    for (const dir of migrationDirs()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8');
      for (const line of noise) {
        expect(sql, `${dir} carries CLI output: ${line}`).not.toContain(line);
      }
    }
  });

  it('creates the unique index that the pipeline depends on', () => {
    // O `skipDuplicates` do Stage 4 **não** deduplica sozinho: quem garante que
    // duas execuções no mesmo dia não dupliquem é a constraint única de
    // `News.sourceUrl`. Ela existe nas migrations (conferido por replay em
    // 23/08) e **não existe no banco local**, que foi baselinado com
    // `migrate resolve` — daí os títulos repetidos no ambiente de
    // desenvolvimento, e só nele.
    const sql = migrationDirs()
      .map((dir) => readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'))
      .join('\n');

    expect(sql).toContain('"News_sourceUrl_key" ON "News"("sourceUrl")');
  });
});
