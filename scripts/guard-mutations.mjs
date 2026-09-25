#!/usr/bin/env node
// As guardas reprovam quando devem — um comando repetível.
//
//   node scripts/guard-mutations.mjs              # todas as mutações + a cobertura
//   node scripts/guard-mutations.mjs --only A1.05,A1.2   # por prefixo de id
//   node scripts/guard-mutations.mjs --coverage   # só a cobertura (sem vitest; segundos)
//   node scripts/guard-mutations.mjs --list       # a tabela, sem rodar nada
//   node scripts/guard-mutations.mjs --restore    # devolve o que um processo morto deixou mutado
//
// Fase 12 do plano de observabilidade (§22, M1 de
// `docs/observability-acceptance.md`). As onze fases criaram ou estenderam
// dezenas de guardas, e cada uma foi vista reprovando **uma vez**, à mão, na
// sua fase. Este script quebra cada uma de novo, sobre a árvore do momento, e
// confere que ela reprova **pelo teste certo**.
//
// ## Por que texto, e não o Stryker
//
// O Stryker insere todos os mutantes no código de uma vez, atrás de um
// interruptor em tempo de execução (*mutant schemata*). Metade das guardas
// daqui **lê o arquivo-fonte** — veria o código instrumentado — e outra parte
// lê YAML, Markdown e Mermaid, que ele não muta. A mutação aqui é texto.
//
// ## As quatro lições que este script carrega, cada uma de uma rodada perdida
//
// 1. **Mutação que não aconteceu parece guarda que passou.** No 5b, o CRLF do
//    `server.ts` fez uma troca escrita com `\n` não casar nada, e o script de
//    então disse "verde". Aqui o trecho tem de ocorrer **exatamente uma vez**
//    (com o arquivo normalizado para LF), senão a mutação é falha do script.
// 2. **O ANSI do vitest quebrou o regex de `failed`** no mesmo 5b. O resultado
//    sai de `--reporter=json --outputFile`, nunca do stdout — no vitest 2 o
//    JSON do stdout vem misturado com o `console.*` dos testes.
// 3. **Reprovar não basta: tem de ser o teste certo.** Um erro de import, ou
//    outro teste da mesma suíte, também reprova — e não prova a guarda. Cada
//    mutação declara o nome (ou um trecho do nome) do teste que tem de cair.
// 4. **`git checkout <arquivo>` para desfazer uma quebra reverte o trabalho
//    inteiro** se o arquivo não está commitado (lição do 5a). O original é
//    copiado para fora da árvore **antes** de mutar, a restauração escreve os
//    bytes originais, e o arquivo tem de estar limpo no git para ser mutado.
//    Um `finally` não roda se o processo for morto no Windows — daí o
//    `--restore`, que lê o manifesto do que ficou pendente.
//
// ## A cobertura é derivada, não digitada
//
// A lista original do M1 tinha 24 guardas e deixava onze de fora, entre elas
// a da fiação do logger. Aqui o script **lista toda suíte que lê fonte**
// (`createSourceFile`, `readFileSync`, `readdirSync`, ou um helper de `tests/`
// que os usa) e reprova se alguma não estiver na tabela nem em `EXCLUDED`,
// com o motivo. É isso que faz uma guarda nova entrar aqui sozinha.
//
// Fora do alcance, e dito: guarda que **não** lê fonte (as que leem o
// `Prisma.dmmf`, o `printRoutes()` ou o comportamento) entra na tabela quando
// alguém a põe lá — a derivação não a encontra.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK_DIR = path.resolve(
  process.env.GUARD_MUTATIONS_DIR ?? path.join(os.tmpdir(), 'newranews-guard-mutations'),
);
const BACKUP_DIR = path.join(WORK_DIR, 'backup');
const RESULTS_DIR = path.join(WORK_DIR, 'results');
const MANIFEST = path.join(WORK_DIR, 'pending.json');

const PACKAGES = { api: 'apps/api', web: 'apps/web' };

/** Um `\n` por linha, sempre: o arquivo é normalizado antes de casar. */
const lines = (...parts) => parts.join('\n');

/**
 * A tabela. Cada linha é **uma** quebra, com a guarda que tem de reprovar.
 *
 * - `edits`: trocas `{ find, replace }` aplicadas em ordem; cada `find` tem de
 *   ocorrer exatamente uma vez no arquivo (normalizado para LF).
 * - `dropLine`: tira a única linha que contém o trecho.
 * - `append`: acrescenta ao fim do arquivo.
 * - `create`: cria um arquivo que não existe (e o apaga na restauração).
 * - `expect`: trecho do nome completo (`fullName`) do teste que tem de cair.
 * - `control: true`: mutação inócua — tem de sair **"NÃO reprovou"**. É como o
 *   script se vê falhando.
 */
const MUTATIONS = [
  // ── Fase 10 — a esteira ──────────────────────────────────────────────────
  {
    id: 'A1.01a',
    what: 'um `uses:` sem SHA',
    pkg: 'api',
    test: 'tests/build/workflow-hardening.test.ts',
    file: '.github/workflows/gitleaks.yml',
    edits: [
      {
        find: 'gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e # v3.0.0',
        replace: 'gitleaks/gitleaks-action@v3',
      },
    ],
    expect: 'todo `uses:` de terceiro aponta para um SHA de 40 hex',
  },
  {
    id: 'A1.01b',
    what: '`permissions: write-all` na coluna zero',
    pkg: 'api',
    test: 'tests/build/workflow-hardening.test.ts',
    file: '.github/workflows/ci.yml',
    edits: [{ find: lines('', 'permissions:', '  contents: read', ''), replace: lines('', 'permissions: write-all', '') }],
    expect: 'escrita no `GITHUB_TOKEN` só onde há motivo escrito',
  },
  {
    id: 'A1.02',
    what: '`@types/node` sem aspas numa entrada de `ignore`',
    pkg: 'api',
    test: 'tests/build/dependabot-config.test.ts',
    file: '.github/dependabot.yml',
    edits: [{ find: "      - dependency-name: '@types/node'", replace: '      - dependency-name: @types/node' }],
    expect: 'parseia como YAML, com a forma que o Dependabot espera',
  },
  // ── Fase 1 — o logger ────────────────────────────────────────────────────
  {
    id: 'A1.03',
    what: 'um `console.warn` no fim do arquivo que cegou a varredura por regex',
    pkg: 'api',
    test: 'tests/security/secrets-in-logs.test.ts',
    file: 'apps/api/src/routes/dev/dashboard.ts',
    append: "\nconsole.warn('guard-mutation');\n",
    expect: 'finds no call outside the written exceptions',
  },
  {
    id: 'A1.25',
    what: 'o serializer certo sem ninguém ligado a ele (`logger: true`)',
    pkg: 'api',
    test: 'tests/security/server-hardening.test.ts',
    file: 'apps/api/src/app.ts',
    edits: [{ find: 'logger: baseLogger,', replace: 'logger: true,' }],
    expect: 'logs through the redacting serializer, not the pino default',
  },
  {
    id: 'A1.26a',
    what: 'o `.env` carregado com `quiet: false`',
    pkg: 'api',
    test: 'tests/config/load-env-file.test.ts',
    file: 'apps/api/src/config/load-env-file.ts',
    edits: [{ find: 'config({ quiet: true });', replace: 'config({ quiet: false });' }],
    expect: 'o carregamento do .env não escreve nada',
  },
  {
    id: 'A1.26b',
    what: 'o `env.ts` de volta ao `dotenv/config`',
    pkg: 'api',
    test: 'tests/config/load-env-file.test.ts',
    file: 'apps/api/src/config/env.ts',
    edits: [{ find: "import './load-env-file';", replace: "import 'dotenv/config';" }],
    expect: 'só o carregador importa o dotenv',
  },
  {
    id: 'A1.27',
    what: 'um campo a mais no contexto do evento da etapa 7.5',
    pkg: 'api',
    test: 'tests/security/pii-in-logs.test.ts',
    file: 'apps/api/src/services/pipeline.service.ts',
    edits: [
      {
        find: lines('        failed: newsletter.failed,', '      });'),
        replace: lines('        failed: newsletter.failed,', '        recipients: newsletter.total,', '      });'),
      },
    ],
    expect: 'logs counts for the newsletter stage, never a recipient',
  },
  {
    id: 'A1.31',
    what: "um literal `'unmatched'` solto em `plugins/observability.ts`",
    pkg: 'api',
    test: 'tests/utils/request-route.test.ts',
    file: 'apps/api/src/plugins/observability.ts',
    edits: [
      {
        find: 'const route = routePatternOf(request);',
        replace: "const route = routePatternOf(request) ?? 'unmatched';",
      },
    ],
    expect: 'nenhum outro arquivo de src/ escreve o literal do balde',
  },
  // ── Fase 3 — a taxonomia ─────────────────────────────────────────────────
  {
    id: 'A1.04a',
    what: 'um `code` novo no tuple sem quem o lance',
    pkg: 'api',
    test: 'tests/utils/error-taxonomy.test.ts',
    file: 'apps/api/src/utils/errors.ts',
    edits: [
      {
        find: lines("  'INTERNAL',", '] as const;'),
        replace: lines("  'INTERNAL',", "  'GUARD_MUTATION_CODE',", '] as const;'),
      },
    ],
    expect: 'carries no code that nothing throws',
  },
  {
    id: 'A1.04b',
    what: 'um `code` montado com template',
    pkg: 'api',
    test: 'tests/utils/error-taxonomy.test.ts',
    file: 'apps/api/src/utils/job-secret.ts',
    edits: [{ find: "code: 'JOB_SECRET_INVALID',", replace: "code: `JOB_SECRET_${'INVALID'}`," }],
    expect: 'finds no interpolated or computed code',
  },
  // ── Fase 4 — o ErrorEvent ────────────────────────────────────────────────
  {
    id: 'A1.05a',
    what: '`recordError` virando `async`',
    pkg: 'api',
    test: 'tests/services/error-event.test.ts',
    file: 'apps/api/src/services/error-event.service.ts',
    edits: [
      {
        find: 'export function recordError(input: RecordErrorInput, now: Date = new Date()): void {',
        replace:
          'export async function recordError(input: RecordErrorInput, now: Date = new Date()): Promise<void> {',
      },
    ],
    expect: 'é síncrona',
  },
  {
    id: 'A1.05b',
    what: 'um `code:` interpolado num call site',
    pkg: 'api',
    test: 'tests/services/error-event.test.ts',
    file: 'apps/api/src/services/client-error.service.ts',
    edits: [{ find: 'code: CLIENT_ERROR_CODE,', replace: 'code: `${CLIENT_ERROR_CODE}`,' }],
    expect: 'é literal ou constante nomeada',
  },
  {
    id: 'A1.08',
    what: '`ERROR_EVENT_RETENTION_DAYS = 15`',
    pkg: 'api',
    test: 'tests/docs/retention-drift.test.ts',
    file: 'apps/api/src/services/error-event.service.ts',
    edits: [
      { find: 'export const ERROR_EVENT_RETENTION_DAYS = 14;', replace: 'export const ERROR_EVENT_RETENTION_DAYS = 15;' },
    ],
    expect: 'a retenção escrita em prosa bate com as constantes da etapa 8',
  },
  {
    id: 'A1.09a',
    what: 'um `model` novo no schema sem SQL',
    pkg: 'api',
    test: 'tests/build/migrations.test.ts',
    file: 'packages/database/prisma/schema.prisma',
    edits: [
      {
        find: lines('  seconds Int      @default(0)', '', '  updatedAt DateTime @updatedAt', '}'),
        replace: lines(
          '  seconds Int      @default(0)',
          '',
          '  updatedAt DateTime @updatedAt',
          '}',
          '',
          'model GuardMutation {',
          '  id String @id',
          '}',
        ),
      },
    ],
    expect: 'cria uma tabela para cada model do schema',
  },
  {
    id: 'A1.09b',
    what: 'uma coluna tirada do schema sem `DROP COLUMN`',
    pkg: 'api',
    test: 'tests/build/migrations.test.ts',
    file: 'packages/database/prisma/schema.prisma',
    edits: [
      {
        find: lines(
          '  /// Acumulado do dia. Cabe em `Int` com folga: o máximo é 86.400.',
          '  seconds Int      @default(0)',
          '',
        ),
        replace: '',
      },
    ],
    expect: 'cada model tem no SQL exatamente as colunas que declara',
  },
  {
    id: 'A1.10',
    what: 'um `model` ausente do `packages/database/CLAUDE.md`',
    pkg: 'api',
    test: 'tests/docs/schema-docs-drift.test.ts',
    file: 'packages/database/CLAUDE.md',
    dropLine: '- DailyUptime → Segundos em que a API esteve de pé',
    expect: 'lista todo model do schema na seção Models',
  },
  // ── Fase 2 — o pipeline visível ──────────────────────────────────────────
  {
    id: 'A1.11',
    what: 'a chamada `requireAdmin(request);` fora do `preHandler` do prefixo',
    pkg: 'api',
    test: 'tests/security/authorization-matrix.test.ts',
    file: 'apps/api/src/routes/admin/index.ts',
    edits: [{ find: 'requireAdmin(request);', replace: '' }],
    expect: 'GET /api/admin/errors rejects a non-admin session',
  },
  {
    id: 'A1.39',
    what: 'um spec de smoke novo sem fluxo declarado (a guarda da Fase 2 sobre os fluxos)',
    pkg: 'web',
    test: 'tests/lib/e2e-flows.test.ts',
    file: 'apps/web/e2e/guard-mutation.spec.ts',
    create: "// Arquivo criado pelo scripts/guard-mutations.mjs; é apagado ao fim.\nexport {};\n",
    expect: 'declares exactly one flow per spec file',
  },
  // ── Fase 5 — as telas ────────────────────────────────────────────────────
  {
    id: 'A1.12',
    what: "`'/admin/errors'` → `'/admin/error'` num `proxyToApi`",
    pkg: 'api',
    test: 'tests/security/bff-route-seam.test.ts',
    file: 'apps/web/app/api/admin/errors/route.ts',
    edits: [{ find: "'/admin/errors'", replace: "'/admin/error'" }],
    expect: 'every path the BFF forwards is a route the API registers',
  },
  {
    id: 'A1.13',
    what: "tirar o `requireRole: 'ADMIN'` da rota das fontes",
    pkg: 'web',
    test: 'tests/lib/admin-surface.test.ts',
    file: 'apps/web/app/api/admin/sources/route.ts',
    edits: [{ find: ", { requireRole: 'ADMIN' }", replace: '' }],
    expect: 'proxies every handler with requireRole ADMIN',
  },
  {
    id: 'A1.14',
    what: 'tirar `admin-security` do `ALL_ROUTES` do `capture-admin.mjs`',
    pkg: 'web',
    test: 'tests/lib/hand-written-lists.test.ts',
    file: 'apps/web/scripts/capture-admin.mjs',
    dropLine: "{ slug: 'admin-security', url: '/pt-BR/admin/security' },",
    expect: 'has a capture route for every admin page',
  },
  {
    id: 'A1.28',
    what: 'uma ação nova em `AUDIT_ACTIONS` sem quem a grave',
    pkg: 'api',
    test: 'tests/services/audit.service.test.ts',
    file: 'apps/api/src/services/audit.service.ts',
    edits: [
      {
        find: lines("  'news.deleted',", '] as const;'),
        replace: lines("  'news.deleted',", "  'news.restored',", '] as const;'),
      },
    ],
    expect: 'todo membro do tuple tem quem o grave',
  },
  {
    id: 'A1.30',
    what: 'tirar o `app.register(uptimeHeartbeatPlugin)` do `server.ts`',
    pkg: 'api',
    test: 'tests/services/uptime.service.test.ts',
    file: 'apps/api/src/server.ts',
    edits: [{ find: 'await app.register(uptimeHeartbeatPlugin);', replace: '' }],
    expect: '`server.ts` registra o `uptimeHeartbeatPlugin`',
  },
  {
    id: 'A1.36',
    what: 'o web escrevendo outro nome de cabeçalho de ator (a costura do `x-actor-id`, 5b)',
    pkg: 'api',
    test: 'tests/routes/jobs.test.ts',
    file: 'apps/web/app/api/admin/run-pipeline/route.ts',
    edits: [{ find: "'x-actor-id': session.user.id,", replace: "'x-actor': session.user.id," }],
    expect: 'writes the same header name the API reads',
  },
  // ── Fase 7a — o BFF ──────────────────────────────────────────────────────
  {
    id: 'A1.15',
    what: 'tirar o `logServerError` de um `catch` de `route.ts`',
    pkg: 'web',
    test: 'tests/lib/bff-error-log.test.ts',
    file: 'apps/web/app/api/events/route.ts',
    edits: [{ find: "logServerError('bff.events', error);", replace: '' }],
    expect: 'logs from every catch outside the written exceptions',
  },
  {
    id: 'A1.34',
    what: 'uma chamada a `signAuthJwt` num redator, que não é signatário',
    pkg: 'web',
    test: 'tests/lib/trust-boundary.test.ts',
    file: 'apps/web/lib/log-server-error.ts',
    edits: [
      {
        find: 'export const MAX_MESSAGE_CHARS = 500;',
        replace: lines(
          'export const MAX_MESSAGE_CHARS = 500;',
          "export const guardMutation = () => signAuthJwt({ sub: 'guard', email: 'guard@example.com' });",
        ),
      },
    ],
    expect: 'lets only the signers sign',
  },
  {
    id: 'A1.35',
    what: 'tirar o prazo do `fetch` do BFF de eventos',
    pkg: 'web',
    test: 'tests/lib/bff-seam.test.ts',
    file: 'apps/web/app/api/events/route.ts',
    edits: [{ find: lines('      signal: AbortSignal.timeout(API_TIMEOUT_MS),', ''), replace: '' }],
    expect: 'declares a timeout on every network fetch',
  },
  // ── Fase 8 — o desfecho ──────────────────────────────────────────────────
  {
    id: 'A1.06',
    what: 'apagar o `degradedBy.push(5.5)` do aviso do portão de entrada',
    pkg: 'api',
    test: 'tests/services/run-outcome-wiring.test.ts',
    file: 'apps/api/src/services/pipeline.service.ts',
    edits: [{ find: 'degradedBy.push(5.5);', replace: '' }],
    expect: 'stage 5.5',
  },
  {
    id: 'A1.07',
    what: 'tirar a linha `6.5 ·` do diagrama de sequência',
    pkg: 'api',
    test: 'tests/docs/diagram-drift.test.ts',
    file: 'docs/diagrams/pipeline-sequence.mermaid',
    dropLine: 'API->>API: 6.5 ·',
    expect: 'pipeline-sequence.mermaid desenha toda etapa que o pipeline anuncia',
  },
  // ── Fase 11 — a saúde por fonte ──────────────────────────────────────────
  {
    id: 'A1.29',
    what: 'a escrita de `recordSourceHealth` virando um laço de `upsert` fora da transação',
    pkg: 'api',
    test: 'tests/services/source-health.test.ts',
    file: 'apps/api/src/services/source-health.service.ts',
    edits: [
      {
        find: lines(
          '  await prisma.$transaction([',
          '    prisma.sourceHealth.deleteMany({ where: { day } }),',
          '    prisma.sourceHealth.createMany({ data: rows }),',
          '  ]);',
        ),
        replace: lines(
          '  for (const row of rows) {',
          '    await prisma.sourceHealth.upsert({',
          '      where: { source_day: { source: row.source, day } },',
          '      create: row,',
          '      update: row,',
          '    });',
          '  }',
        ),
      },
    ],
    expect: 'is one Prisma transaction in the source, not a loop',
  },
  // ── Fase 6 — as invariantes ──────────────────────────────────────────────
  {
    id: 'A1.16',
    what: 'um `findMany` sem `select` numa invariante',
    pkg: 'api',
    test: 'tests/services/invariants.service.test.ts',
    file: 'apps/api/src/services/invariants.service.ts',
    edits: [
      {
        find: lines('          where: { date: { gte: since } },', '          select: { date: true },', ''),
        replace: lines('          where: { date: { gte: since } },', ''),
      },
    ],
    expect: 'is an aggregate, a count, or a one-column select — never a row',
  },
  {
    id: 'A1.33',
    what: 'tirar a seção `### GET /api/admin/invariants` da `docs/api.md`',
    pkg: 'api',
    test: 'tests/routes/api-docs-drift.test.ts',
    file: 'docs/api.md',
    dropLine: '### GET /api/admin/invariants',
    expect: 'documents every registered route',
  },
  // ── Fase 7c — a ingestão do erro do cliente ──────────────────────────────
  {
    id: 'A1.17',
    what: 'tirar um padrão de `WEB_ROUTE_PATTERNS`',
    pkg: 'api',
    test: 'tests/utils/web-route.test.ts',
    file: 'apps/api/src/utils/web-route.ts',
    dropLine: "  '/[locale]/admin/security',",
    expect: 'has exactly one pattern per page.tsx',
  },
  {
    id: 'A1.18',
    // Um nome que ninguém declarou. A primeira versão trocava pelo
    // `errorResponseSchema`, e a guarda passou — com razão: ele TEM contrato
    // (`utils/schemas.ts`). O limite que isso mostrou é da guarda, e fica
    // escrito: ela identifica o schema pelo **nome**, e há três
    // `errorResponseSchema` em `src/` (um só asserido; hoje os três são 4xx,
    // fora do alcance dela).
    what: 'uma resposta `202` sem contrato declarado',
    pkg: 'api',
    test: 'tests/routes/shared-type-contract.test.ts',
    file: 'apps/api/src/routes/errors/index.ts',
    edits: [{ find: '202: clientErrorAcceptedSchema,', replace: '202: guardMutationAcceptedSchema,' }],
    expect: 'declares a shared-type contract for every success response',
  },
  {
    id: 'A1.32',
    what: '`max: 10` → `max: 1000` no balde do relato do cliente',
    pkg: 'api',
    test: 'tests/security/client-error-ingest.test.ts',
    file: 'apps/api/src/routes/errors/index.ts',
    edits: [{ find: 'max: 10,', replace: 'max: 1000,' }],
    expect: 'keeps the declared ceiling at the number the comment reasons about',
  },
  {
    id: 'A1.38',
    what: 'o BFF anônimo do relato importando quem resolve identidade',
    pkg: 'web',
    test: 'tests/routes/client-error-api.test.ts',
    file: 'apps/web/app/api/errors/client/route.ts',
    edits: [
      {
        find: "import { NextResponse } from 'next/server';",
        replace: lines("import { NextResponse } from 'next/server';", "import { getServerSession } from 'next-auth';"),
      },
    ],
    expect: 'does not import anything that resolves an identity',
  },
  // ── Fase 7b — os boundaries ──────────────────────────────────────────────
  {
    id: 'A1.24',
    what: 'um `error.tsx` que não desenha pela casca `error-state`',
    pkg: 'web',
    test: 'tests/lib/state-matrix.test.ts',
    file: 'apps/web/app/[locale]/news/error.tsx',
    edits: [{ find: '<ErrorState', replace: '<section' }],
    expect: 'todo boundary de erro desenha pela casca única',
  },
  {
    id: 'A1.37',
    what: 'a casca do boundary com `h2` em vez de `h1`',
    pkg: 'web',
    test: 'tests/components/a11y-guards.test.tsx',
    file: 'apps/web/components/errors/error-state.tsx',
    edits: [
      { find: '<h1', replace: '<h2' },
      { find: '</h1>', replace: '</h2>' },
    ],
    expect: 'o boundary de erro é o `h1` da tela',
  },
  // ── Fase 9 — os portões ──────────────────────────────────────────────────
  {
    id: 'A1.19',
    what: 'um check novo em `OUTPUT_GUARD_CHECKS` sem rótulo no web',
    pkg: 'web',
    test: 'tests/lib/gate-checks.test.ts',
    file: 'apps/api/src/providers/ai/output-guard.ts',
    edits: [
      {
        find: lines("  'instruction-text',", '] as const;'),
        replace: lines("  'instruction-text',", "  'guard-mutation',", '] as const;'),
      },
    ],
    expect: 'labels every check the API can write',
  },
  {
    id: 'A1.20',
    what: '`copied-url` voltando a aviso',
    pkg: 'api',
    test: 'tests/providers/output-guard.test.ts',
    file: 'apps/api/src/providers/ai/output-guard.ts',
    edits: [
      {
        find: lines('    security.push({', "      check: material.includes(url) ? 'copied-url' : 'unanchored-url',"),
        replace: lines(
          '    (material.includes(url) ? warnings : security).push({',
          "      check: material.includes(url) ? 'copied-url' : 'unanchored-url',",
        ),
      },
    ],
    expect: 'never warns about a URL — every URL in the output is a block',
  },
  {
    id: 'A1.21',
    what: 'o guarda aceitando URL cujo host está no material',
    pkg: 'api',
    test: 'tests/security/prompt-injection.test.ts',
    file: 'apps/api/src/providers/ai/output-guard.ts',
    edits: [
      {
        find: lines('    const host = hostOf(url);', ''),
        replace: lines('    const host = hostOf(url);', '    if (material.includes(host)) continue;', ''),
      },
    ],
    expect: 'the output guard blocks it as security — copied-url, because the link came from the material',
  },
  // ── Fora da linha das fases, no plano (#231, #233) ───────────────────────
  {
    id: 'A1.22',
    what: 'tirar o `STATIC_NOW` do `i18n/request.ts`',
    pkg: 'web',
    test: 'tests/lib/isr-determinism.test.ts',
    file: 'apps/web/i18n/request.ts',
    edits: [{ find: 'now: STATIC_NOW,', replace: 'now: new Date(),' }],
    expect: 'a configuração da requisição devolve o pino',
  },
  {
    id: 'A1.23',
    what: '`.catch(() => [])` no `news-sitemap.xml`',
    pkg: 'web',
    test: 'tests/lib/api-failure.test.ts',
    file: 'apps/web/app/news-sitemap.xml/route.ts',
    edits: [
      {
        find: "nullUnlessPublishing(logged('news', collectNews(since))),",
        replace: "logged('news', collectNews(since)).catch(() => []),",
      },
    ],
    expect: 'nada que a ISR guarda responde a uma falha com valor vazio',
  },
  // ── Fase 12 — a própria cobertura ────────────────────────────────────────
  {
    id: 'A1.40',
    what: 'uma suíte nova que lê fonte, sem mutação nem motivo',
    pkg: 'api',
    test: 'tests/build/guard-mutations.test.ts',
    file: 'apps/api/tests/build/guard-mutation-unregistered.test.ts',
    create: lines(
      "import { readFileSync } from 'node:fs';",
      "import { it, expect } from 'vitest';",
      '',
      "// Criado pelo scripts/guard-mutations.mjs (A1.40); é apagado ao fim.",
      "it('reads a source file', () => expect(readFileSync(__filename, 'utf8')).toBeTruthy());",
      '',
    ),
    expect: 'registers every source-reading suite as a mutation or a written exclusion',
  },
  {
    id: 'A1.41',
    what: 'o passo que recusa exceção de advisory órfã some do CI (A6.02)',
    pkg: 'api',
    test: 'tests/build/workflow-hardening.test.ts',
    file: '.github/workflows/ci.yml',
    dropLine: 'run: node scripts/audit-orphans.mjs',
    expect: 'o job de audit recusa exceção órfã',
  },
  {
    id: 'A1.42',
    what: 'o 5xx do `AppError` volta a pôr a própria frase no fio (A3.17)',
    pkg: 'api',
    test: 'tests/plugins/error-handler.test.ts',
    file: 'apps/api/src/app.ts',
    edits: [{ find: 'if (error.statusCode >= 500) {', replace: 'if (error.statusCode >= 600) {' }],
    expect: 'answers an AppError of 500 with the documented 500 contract',
  },
  {
    id: 'A1.43',
    what: 'o enterro volta a olhar só o run de hoje (M7a — o cadáver de 03/09)',
    pkg: 'api',
    test: 'tests/services/pipeline.test.ts',
    file: 'apps/api/src/services/pipeline.service.ts',
    edits: [{ find: 'for (const run of dead) await buryDeadRun(run);', replace: 'void dead;' }],
    expect: 'buries a dead run from a previous day before the day is checked',
  },
  {
    id: 'A1.44',
    what: 'o Prisma de volta ao `errorFormat` padrão, com o quadro de código na mensagem (M5)',
    pkg: 'api',
    test: 'tests/security/secrets-in-logs.test.ts',
    file: 'packages/database/src/index.ts',
    edits: [{ find: "new PrismaClient({ errorFormat: 'minimal' })", replace: 'new PrismaClient()' }],
    expect: 'builds the shared PrismaClient with errorFormat minimal',
  },
  {
    id: 'A1.45',
    what: 'uma linha semeada de `ErrorEvent` que o produto deixaria em `debug` (M5)',
    pkg: 'api',
    test: 'tests/services/seed-error-events.test.ts',
    file: 'packages/database/prisma/seed.ts',
    edits: [
      {
        find: lines("      category: 'authorization',", '      count: 4,'),
        replace: lines("      category: 'validation',", '      count: 4,'),
      },
    ],
    expect: 'never one that stays in debug',
  },
  {
    id: 'A1.46',
    what: 'uma tabela do admin sem nome acessível (A5.13)',
    pkg: 'web',
    test: 'tests/components/a11y-guards.test.tsx',
    file: 'apps/web/components/dashboard/golden-signals.tsx',
    edits: [{ find: " aria-label={t('signals.routesTitle')}", replace: '' }],
    expect: 'toda tabela tem nome acessível',
  },
  {
    id: 'A1.47',
    what: 'uma cor da tela de crash que não é o token resolvido (A5.12)',
    pkg: 'web',
    test: 'tests/lib/state-matrix.test.ts',
    file: 'apps/web/app/global-error.tsx',
    edits: [{ find: "    bg: '#0f1113',", replace: "    bg: '#000000'," }],
    expect: 'a tela de crash pinta com os tokens',
  },
  // ── Controles: o script se vendo falhar ──────────────────────────────────
  {
    id: 'C.01',
    what: 'controle — um comentário inócuo no arquivo que a taxonomia varre',
    pkg: 'api',
    test: 'tests/utils/error-taxonomy.test.ts',
    file: 'apps/api/src/utils/errors.ts',
    append: '\n// Comentário inócuo do guard-mutations: nenhuma guarda deve reprovar.\n',
    control: true,
  },
  {
    id: 'C.02',
    what: 'controle — um comentário inócuo no redator do BFF',
    pkg: 'web',
    test: 'tests/lib/trust-boundary.test.ts',
    file: 'apps/web/lib/log-server-error.ts',
    append: '\n// Comentário inócuo do guard-mutations: nenhuma guarda deve reprovar.\n',
    control: true,
  },
];

/**
 * Suítes que leem fonte e **não** são guardas do plano de observabilidade —
 * cada uma com o motivo. Uma suíte leitora fora da tabela e fora daqui
 * reprova a cobertura: é assim que uma guarda nova entra sozinha.
 */
const EXCLUDED = {
  'api:tests/build/env-parity.test.ts': 'V2, Fase 11 (24/08) — variável do schema ⇒ linha no blueprint; anterior ao plano',
  'api:tests/build/runtime-deps.test.ts': 'V2 (22/08, PR #122) — pacote do workspace importado em runtime; anterior ao plano',
  'api:tests/docs/feed-count-drift.test.ts': 'V2, item 41 (31/08) — a contagem de feeds em prosa; anterior ao plano',
  'api:tests/security/events-ingest-ceiling.test.ts': 'V2, Fase 11 (24/08) — o teto de /api/events; anterior ao plano',
  'web:tests/lib/analytics-catalog.test.ts': 'V2, Fase 8 (24/08) — evento do catálogo ⇒ call site; anterior ao plano',
  'web:tests/lib/design-tokens.test.ts': 'V2 (20/08) — tokens do @theme; anterior ao plano, sem asserção nova dele',
  'web:tests/lib/i18n-messages.test.ts': 'V2 (16/08) — paridade dos JSONs de idioma; anterior ao plano',
  'web:tests/lib/images.test.ts': 'V2 (22/08) — hosts de imagem; anterior ao plano',
  'web:tests/lib/markdown-text.test.ts': 'V2, pós-Fase 12 (01/09) — limpeza de Markdown em metadata; anterior ao plano',
  'web:tests/lib/rendering-mode.test.ts': 'V2, Fase 11 (24/08) — revalidate ⇒ rota guardada; anterior ao plano',
  'web:tests/lib/seo.test.ts': 'V2 (22/08) — metadata; anterior ao plano',
  'web:tests/routes/events-anonymity.test.ts': 'V2, Fase 11 (24/08) — anonimato do BFF de eventos; anterior ao plano',
  'web:tests/security/browser-surface.test.ts': 'V2, Fase 10 (24/08) — o plano (5c) só trocou prosa ("15 páginas")',
  'web:tests/security/response-headers.test.ts': 'V2, Fase 10 (24/08) — o plano (5c) só trocou prosa ("15 páginas")',
  'web:tests/security/image-optimizer.test.ts': 'itens 53/54 (09/09) — a cota de imagem da Vercel; fora da linha das fases do plano',
};

// ── Execução ───────────────────────────────────────────────────────────────

function git(args) {
  const res = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
  return res.stdout;
}

function backupPath(rel) {
  return path.join(BACKUP_DIR, rel.replace(/[\\/:]/g, '__'));
}

function readManifest() {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : [];
}

function writeManifest(entries) {
  if (entries.length === 0) {
    rmSync(MANIFEST, { force: true });
    return;
  }
  writeFileSync(MANIFEST, JSON.stringify(entries, null, 2));
}

/** Devolve o arquivo ao estado de antes da mutação, pelos bytes copiados. */
function restore(entry) {
  const abs = path.join(ROOT, entry.rel);
  if (entry.created) {
    if (existsSync(abs)) unlinkSync(abs);
  } else {
    copyFileSync(backupPath(entry.rel), abs);
  }
  writeManifest(readManifest().filter((other) => other.rel !== entry.rel));
}

function restoreAll() {
  const pending = readManifest();
  if (pending.length === 0) {
    console.log('Nada pendente — nenhum arquivo ficou mutado.');
    return;
  }
  for (const entry of pending) {
    restore(entry);
    console.log(`restaurado: ${entry.rel}${entry.created ? ' (apagado — tinha sido criado)' : ''}`);
  }
}

function countOccurrences(text, needle) {
  if (needle.length === 0) return 0;
  let count = 0;
  let at = text.indexOf(needle);
  while (at !== -1) {
    count++;
    at = text.indexOf(needle, at + needle.length);
  }
  return count;
}

/** Aplica a mutação ao texto normalizado; lança se ela não acontecer. */
function mutate(text, mutation) {
  if (mutation.append !== undefined) return text + mutation.append;
  if (mutation.dropLine !== undefined) {
    const all = text.split('\n');
    const hits = all.filter((line) => line.includes(mutation.dropLine));
    if (hits.length !== 1) {
      throw new Error(`dropLine casou ${hits.length} linhas (tem de ser 1): ${mutation.dropLine}`);
    }
    return all.filter((line) => !line.includes(mutation.dropLine)).join('\n');
  }
  let out = text;
  for (const { find, replace } of mutation.edits) {
    const n = countOccurrences(out, find);
    if (n !== 1) throw new Error(`o trecho ocorre ${n} vezes (tem de ser 1): ${JSON.stringify(find).slice(0, 120)}`);
    out = out.replace(find, () => replace);
  }
  if (out === text) throw new Error('a mutação não mudou o arquivo');
  return out;
}

function vitestBin(pkgDir) {
  const req = createRequire(path.join(pkgDir, 'package.json'));
  return path.join(path.dirname(req.resolve('vitest/package.json')), 'vitest.mjs');
}

/** Roda um arquivo de teste e devolve o que o reporter JSON diz. */
function runTest(mutation) {
  const pkgDir = path.join(ROOT, PACKAGES[mutation.pkg]);
  const out = path.join(RESULTS_DIR, `${mutation.id}.json`);
  rmSync(out, { force: true });
  const res = spawnSync(
    process.execPath,
    [vitestBin(pkgDir), 'run', mutation.test, '--reporter=json', `--outputFile=${out}`],
    {
      cwd: pkgDir,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
      timeout: 300_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (!existsSync(out)) {
    return { ran: false, error: `sem resultado do vitest (status ${res.status}): ${(res.stderr || res.stdout).slice(-400)}` };
  }
  const report = JSON.parse(readFileSync(out, 'utf8'));
  const failed = [];
  const suiteErrors = [];
  for (const file of report.testResults ?? []) {
    if (file.status === 'failed' && (file.assertionResults ?? []).every((a) => a.status !== 'failed')) {
      suiteErrors.push((file.message ?? '').split('\n')[0]);
    }
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status === 'failed') failed.push(assertion.fullName ?? assertion.title);
    }
  }
  return { ran: true, numTotal: report.numTotalTests, numFailed: report.numFailedTests, failed, suiteErrors };
}

function runOne(mutation) {
  const rel = mutation.file;
  const abs = path.join(ROOT, rel);
  const created = mutation.create !== undefined;

  if (created) {
    if (existsSync(abs)) throw new Error(`${rel} já existe — a mutação cria o arquivo`);
  } else {
    if (!existsSync(abs)) throw new Error(`${rel} não existe`);
    const status = git(['status', '--porcelain', '--', rel]).trim();
    if (status) throw new Error(`${rel} não está limpo no git (${status}) — commit ou descarte antes de mutar`);
  }

  // O original sai da árvore ANTES de qualquer escrita, e o manifesto diz o que
  // está pendente — é o que o `--restore` lê se este processo morrer.
  if (!created) copyFileSync(abs, backupPath(rel));
  writeManifest([...readManifest(), { rel, created }]);

  try {
    if (created) {
      writeFileSync(abs, mutation.create);
    } else {
      const original = readFileSync(abs, 'utf8');
      const eol = original.includes('\r\n') ? '\r\n' : '\n';
      const mutated = mutate(original.replace(/\r\n/g, '\n'), mutation);
      writeFileSync(abs, eol === '\r\n' ? mutated.replace(/\n/g, '\r\n') : mutated);
    }
    return runTest(mutation);
  } finally {
    restore({ rel, created });
  }
}

function verdict(mutation, result) {
  if (!result.ran) return { ok: false, label: 'ERRO', detail: result.error };
  const failedSomething = result.numFailed > 0 || result.suiteErrors.length > 0;
  if (mutation.control) {
    return failedSomething
      ? { ok: false, label: 'reprovou (controle!)', detail: [...result.failed, ...result.suiteErrors].join(' | ') }
      : { ok: true, label: 'NÃO reprovou', detail: `${result.numTotal} testes verdes` };
  }
  if (!failedSomething) return { ok: false, label: 'NÃO reprovou', detail: `${result.numTotal} testes verdes` };
  const hit = result.failed.find((name) => mutation.expect && name.includes(mutation.expect));
  if (hit) {
    const others = result.failed.length - 1;
    return { ok: true, label: 'reprovou', detail: hit + (others > 0 ? ` (+${others})` : '') };
  }
  return {
    ok: false,
    label: mutation.expect ? 'reprovou por outro teste' : 'reprovou (sem esperado)',
    detail: [...result.failed, ...result.suiteErrors.map((e) => `erro de suíte: ${e}`)].join(' | '),
  };
}

// ── Cobertura derivada ─────────────────────────────────────────────────────

const READS_SOURCE = /\b(createSourceFile|readFileSync|readdirSync)\b/;

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return [full];
  });
}

/** Toda suíte que lê fonte — direto, ou por um helper de `tests/` que lê. */
export function sourceReadingSuites() {
  const found = [];
  for (const [pkg, dir] of Object.entries(PACKAGES)) {
    const testsDir = path.join(ROOT, dir, 'tests');
    const files = walk(testsDir).filter((f) => /\.(ts|tsx)$/.test(f));
    const helpers = files
      .filter((f) => !/\.test\.tsx?$/.test(f) && READS_SOURCE.test(readFileSync(f, 'utf8')))
      .map((f) => path.basename(f).replace(/\.tsx?$/, ''));
    for (const file of files.filter((f) => /\.test\.tsx?$/.test(f))) {
      const text = readFileSync(file, 'utf8');
      const viaHelper = helpers.some((h) => new RegExp(`from '[./]+/helpers/${h}'`).test(text));
      if (READS_SOURCE.test(text) || viaHelper) {
        found.push(`${pkg}:${path.relative(path.join(ROOT, dir), file).split(path.sep).join('/')}`);
      }
    }
  }
  return found.sort();
}

export function coverageProblems() {
  const problems = [];
  const inTable = new Set(MUTATIONS.filter((m) => !m.control).map((m) => `${m.pkg}:${m.test}`));
  const readers = sourceReadingSuites();
  for (const suite of readers) {
    if (!inTable.has(suite) && !EXCLUDED[suite]) {
      problems.push(`${suite} lê fonte e não está na tabela nem em EXCLUDED`);
    }
  }
  for (const suite of Object.keys(EXCLUDED)) {
    if (!readers.includes(suite)) problems.push(`${suite} está em EXCLUDED e não é (mais) uma suíte leitora`);
    if (inTable.has(suite)) problems.push(`${suite} está na tabela e em EXCLUDED ao mesmo tempo`);
  }
  for (const m of MUTATIONS) {
    const test = path.join(ROOT, PACKAGES[m.pkg], m.test);
    if (!existsSync(test)) problems.push(`${m.id}: ${m.pkg}:${m.test} não existe`);
    if (!m.control && !m.expect) problems.push(`${m.id}: sem teste esperado`);
  }
  const ids = MUTATIONS.map((m) => m.id);
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) problems.push(`${id} repetido`);
  return { problems, readers };
}

export { MUTATIONS, EXCLUDED };

// ── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  mkdirSync(BACKUP_DIR, { recursive: true });
  mkdirSync(RESULTS_DIR, { recursive: true });

  if (args.includes('--restore')) {
    restoreAll();
    return 0;
  }
  if (args.includes('--list')) {
    for (const m of MUTATIONS) console.log(`${m.id.padEnd(7)} ${m.pkg.padEnd(4)} ${m.test.padEnd(46)} ${m.what}`);
    return 0;
  }

  const { problems, readers } = coverageProblems();
  const suites = new Set(MUTATIONS.filter((m) => !m.control).map((m) => `${m.pkg}:${m.test}`));
  console.log(
    `Cobertura: ${readers.length} suítes leem fonte · ${suites.size} suítes na tabela · ${Object.keys(EXCLUDED).length} excluídas com motivo`,
  );
  for (const p of problems) console.log(`  ✗ ${p}`);
  if (args.includes('--coverage')) return problems.length === 0 ? 0 : 1;

  const pending = readManifest();
  if (pending.length > 0) {
    console.error(`\nHá arquivos mutados de uma execução anterior (${pending.map((e) => e.rel).join(', ')}).`);
    console.error('Rode `node scripts/guard-mutations.mjs --restore` antes.');
    return 2;
  }

  const onlyArg = args.find((a) => a.startsWith('--only'));
  const only = onlyArg ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1]) : null;
  const selected = only
    ? MUTATIONS.filter((m) => only.split(',').some((prefix) => m.id.startsWith(prefix.trim())))
    : MUTATIONS;

  console.log(`\n${selected.length} mutações; cópias e resultados em ${WORK_DIR}\n`);
  const rows = [];
  for (const mutation of selected) {
    const started = Date.now();
    let v;
    try {
      v = verdict(mutation, runOne(mutation));
    } catch (error) {
      v = { ok: false, label: 'ERRO', detail: error instanceof Error ? error.message : String(error) };
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    rows.push({ mutation, v });
    console.log(`${v.ok ? '✓' : '✗'} ${mutation.id.padEnd(7)} ${v.label.padEnd(26)} ${seconds.padStart(5)} s  ${v.detail}`);
  }

  const bad = rows.filter((r) => !r.v.ok);
  console.log(
    `\n${rows.length - bad.length}/${rows.length} como esperado` +
      (problems.length ? ` · cobertura com ${problems.length} problema(s)` : ' · cobertura completa'),
  );
  return bad.length === 0 && problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
