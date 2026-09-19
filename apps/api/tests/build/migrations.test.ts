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

/**
 * **A guarda de coluna, que a Fase 5 cobrou: o schema perdeu uma coluna e a
 * migration não.**
 *
 * A guarda acima pergunta por model, enum e índice — e por *criação*. Uma
 * coluna que sai do `schema.prisma` sem `DROP COLUMN` não é alcançada por
 * nenhuma das quatro asserções, e o sintoma é ainda mais mudo que o da tabela
 * esquecida: o client deixa de conhecer a coluna, toda escrita continua
 * funcionando (a coluna morta é nullable ou tem default), e o banco de produção
 * fica com uma coluna que nenhum código lê, para sempre, sem que `migrate
 * status` reclame de nada. O `aiTokensUsed` do `DailyMetric` é o caso exato.
 *
 * Por isso esta é um **replay estático**: ela aplica, na ordem do `migrate
 * deploy`, os `CREATE TABLE`, `ADD COLUMN`, `DROP COLUMN` e `RENAME COLUMN`
 * de todas as migrations sobre um conjunto por tabela, e compara o resultado
 * com as colunas escalares que o schema declara — nas **duas** direções.
 * Coluna no schema sem SQL que a crie reprova; coluna criada pelo SQL que o
 * schema já não declara reprova também. O `RENAME` da Fase 6 (`newsId` →
 * `itemId`) é o que obriga o replay a ser em ordem em vez de um `includes`.
 *
 * O limite continua o mesmo: ela lê os statements que este conjunto usa, não
 * SQL arbitrário. Um `ALTER TABLE ... RENAME TO` ou um `ALTER COLUMN ... TYPE`
 * passariam sem reprovar — e é o replay contra banco de rascunho que os pega.
 * E é regex sobre SQL gerado, não parser (armadilha 27 do plano): o corte por
 * `;` e o strip de `--` assumem que nenhum literal de string os contém, o que
 * é verdade para tudo que o Prisma emite e para o backfill escrito à mão.
 */

/**
 * As colunas escalares de cada model — tudo que não é campo de relação.
 *
 * Campo de relação é o cujo tipo é outro model (`pipelineLog PipelineLog`,
 * `events PipelineEvent[]`) ou que carrega `@relation`; nenhum dos dois vira
 * coluna. Lista de enum (`categories Category[]`) **é** coluna, e é o motivo de
 * a distinção ser pelo conjunto de models e não pelo `[]`.
 */
function schemaColumnsByModel(): Map<string, Set<string>> {
  const models = new Set(schemaModels());
  const colunas = new Map<string, Set<string>>();

  for (const [, model, body] of schemaWithoutComments().matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const proprias = new Set<string>();
    for (const linha of (body as string).split('\n')) {
      const campo = /^\s*(\w+)\s+(\w+)(\[\])?\??(\s|$)/.exec(linha);
      if (!campo || linha.includes('@relation')) continue;
      if (models.has(campo[2] as string)) continue;
      proprias.add(campo[1] as string);
    }
    colunas.set(model as string, proprias);
  }

  return colunas;
}

/**
 * O replay: cada statement do SQL, na ordem em que o `migrate deploy` o
 * aplica, sobre um conjunto de colunas por tabela.
 */
function sqlColumnsByTable(): Map<string, Set<string>> {
  const tabelas = new Map<string, Set<string>>();
  const de = (tabela: string): Set<string> => {
    if (!tabelas.has(tabela)) tabelas.set(tabela, new Set());
    return tabelas.get(tabela) as Set<string>;
  };

  const statements = allMigrationSql()
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const create = /^CREATE TABLE "(\w+)"\s*\(([\s\S]*)\)$/.exec(statement);
    if (create) {
      for (const coluna of (create[2] as string).matchAll(/^\s*"(\w+)"\s/gm)) {
        de(create[1] as string).add(coluna[1] as string);
      }
      continue;
    }

    const dropTable = /^DROP TABLE "(\w+)"/.exec(statement);
    if (dropTable) {
      tabelas.delete(dropTable[1] as string);
      continue;
    }

    const alter = /^ALTER TABLE "(\w+)"\s([\s\S]*)$/.exec(statement);
    if (!alter) continue;
    const tabela = de(alter[1] as string);
    const corpo = alter[2] as string;

    for (const add of corpo.matchAll(/ADD COLUMN\s+"(\w+)"/g)) tabela.add(add[1] as string);
    for (const drop of corpo.matchAll(/DROP COLUMN\s+"(\w+)"/g)) tabela.delete(drop[1] as string);
    for (const rename of corpo.matchAll(/RENAME COLUMN\s+"(\w+)"\s+TO\s+"(\w+)"/g)) {
      tabela.delete(rename[1] as string);
      tabela.add(rename[2] as string);
    }
  }

  return tabelas;
}

describe('as colunas do schema são as colunas que as migrations deixam', () => {
  it('acha o que precisa achar — conjunto vazio aprovaria tudo', () => {
    const schema = schemaColumnsByModel();
    const sql = sqlColumnsByTable();

    expect([...(schema.get('DailyMetric') ?? [])]).toContain('newsApiCount');
    // Relação não é coluna: `PipelineEvent.pipelineLog` é `@relation`, e
    // `PipelineLog.events` é lista de model.
    expect([...(schema.get('PipelineEvent') ?? [])]).not.toContain('pipelineLog');
    expect([...(schema.get('PipelineLog') ?? [])]).not.toContain('events');
    // Lista de enum é coluna.
    expect([...(schema.get('UserPreference') ?? [])]).toContain('categories');
    // O replay honra a ordem: o `newsId` do Favorite foi renomeado, não criado
    // duas vezes.
    expect([...(sql.get('Favorite') ?? [])]).toContain('itemId');
    expect([...(sql.get('Favorite') ?? [])]).not.toContain('newsId');
    // E lê o `ADD COLUMN` em continuação de linha do formato do Prisma.
    expect([...(sql.get('Article') ?? [])]).toContain('promptVersion');
  });

  it('cada model tem no SQL exatamente as colunas que declara', () => {
    const sql = sqlColumnsByTable();
    const divergencias: string[] = [];

    for (const [model, declaradas] of schemaColumnsByModel()) {
      const aplicadas = sql.get(model) ?? new Set<string>();
      for (const coluna of declaradas) {
        if (!aplicadas.has(coluna)) divergencias.push(`${model}.${coluna}: no schema, sem SQL que a crie`);
      }
      for (const coluna of aplicadas) {
        if (!declaradas.has(coluna)) divergencias.push(`${model}.${coluna}: criada pelo SQL, ausente do schema`);
      }
    }

    expect(divergencias).toEqual([]);
  });
});
