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
const SCHEMA_PATH = join(__dirname, '../../../../packages/database/prisma/schema.prisma');

function migrationDirs(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Todo o SQL do conjunto, na ordem em que o `migrate deploy` o aplica. */
function allMigrationSql(): string {
  return migrationDirs()
    .map((dir) => readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'))
    .join('\n');
}

/**
 * Comentário fora antes de qualquer regex sobre o schema.
 *
 * O `schema.prisma` deste projeto é mais comentário que declaração — e os
 * comentários **citam** o que a varredura procura: o do `ErrorEvent` explica
 * por que não existe um `@@index([fingerprint])` ao lado do `@@unique`. Sem
 * esta linha, a guarda cobraria um índice que o schema diz de propósito não
 * ter. É a armadilha que a Fase 11 cobrou quatro vezes, agora em `.prisma`.
 */
function schemaWithoutComments(): string {
  return readFileSync(SCHEMA_PATH, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/\/?.*$/gm, '$1');
}

function schemaModels(): string[] {
  return [...schemaWithoutComments().matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1] as string);
}

function schemaEnums(): string[] {
  return [...schemaWithoutComments().matchAll(/^enum\s+(\w+)\s*\{/gm)].map((m) => m[1] as string);
}

/**
 * Os nomes de índice que o schema **implica**, pela convenção do Prisma:
 * `Modelo_campo_campo_idx` para `@@index`, `..._key` para `@@unique` e para o
 * `@unique` de campo. Derivar em vez de digitar é o que faz a guarda responder
 * *"o schema mudou e a migration não"*, e não *"o que eu lembrei de olhar"*.
 */
function indexNamesImpliedBySchema(): string[] {
  const nomes: string[] = [];

  for (const [, model, body] of schemaWithoutComments().matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    for (const bloco of (body as string).matchAll(/^\s*@@(index|unique)\(\[([^\]]+)\]/gm)) {
      const campos = (bloco[2] as string).split(',').map((campo) => campo.trim());
      nomes.push(`${model}_${campos.join('_')}_${bloco[1] === 'unique' ? 'key' : 'idx'}`);
    }
    for (const campo of (body as string).matchAll(/^\s*(\w+)\s+\S+.*?@unique/gm)) {
      nomes.push(`${model}_${campo[1]}_key`);
    }
  }

  return nomes;
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

/**
 * **A guarda que faltava: o schema mudou e a migration não.**
 *
 * Editar `schema.prisma` e esquecer o `prisma migrate dev` não produz sintoma
 * nenhum aqui dentro — `prisma generate` lê o schema, então o client tipa a
 * tabela nova, o `tsc` aprova, a suíte fica verde e o código que a usa passa
 * nos testes. **O erro só aparece na primeira consulta contra o banco real**,
 * que é produção: o `migrate.yml` roda no push da `main` e aplica o que existe,
 * não o que o schema diz.
 *
 * Esta fase é o caso exato — ela é *só* schema — e por isso a guarda nasce
 * aqui. Ela compara **conjuntos derivados da fonte** (models, enums e os nomes
 * de índice que a convenção do Prisma implica) com o SQL aplicado, e não uma
 * lista digitada: tabela nova entra na varredura sozinha.
 *
 * **O limite, escrito de propósito:** ela pergunta se o objeto foi *criado* em
 * algum momento, não se sobreviveu a um `DROP` posterior — e não substitui o
 * replay contra um banco de rascunho, que continua sendo o único jeito de saber
 * se as migrations *aplicam*. O que ela tranca é o esquecimento, que é a falha
 * frequente; o replay tranca o SQL inválido, que é a rara.
 */
describe('as migrations acompanham o schema que declaram', () => {
  it('acha o que precisa achar — matcher vazio aprovaria tudo', () => {
    expect(schemaModels()).toContain('PipelineLog');
    expect(schemaEnums()).toContain('PipelineStatus');
    expect(indexNamesImpliedBySchema()).toContain('ProductEvent_type_occurredAt_idx');
    // O comentário do `ErrorEvent` cita um `@@index([fingerprint])` que o
    // schema **não** declara; se o stripper de comentário parar de funcionar,
    // este nome aparece e a asserção cai.
    expect(indexNamesImpliedBySchema()).not.toContain('ErrorEvent_fingerprint_idx');
  });

  it('cria uma tabela para cada model do schema', () => {
    const sql = allMigrationSql();
    const ausentes = schemaModels().filter((model) => !sql.includes(`CREATE TABLE "${model}"`));

    expect(ausentes).toEqual([]);
  });

  it('cria um tipo para cada enum do schema', () => {
    const sql = allMigrationSql();
    const ausentes = schemaEnums().filter((nome) => !sql.includes(`CREATE TYPE "${nome}"`));

    expect(ausentes).toEqual([]);
  });

  it('cria todo índice que o schema declara', () => {
    const sql = allMigrationSql();
    const ausentes = indexNamesImpliedBySchema().filter(
      (nome) => !sql.includes(`INDEX "${nome}"`),
    );

    expect(ausentes).toEqual([]);
  });
});
