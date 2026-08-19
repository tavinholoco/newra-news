# Baseline do banco de produção (Neon)

> Operação única. Depois dela, todo o schema de produção passa a ser aplicado por migrations versionadas, via `.github/workflows/migrate.yml`.

## Por que é preciso

O banco de produção foi construído com `prisma db push` (16/08/2026, criando `User`/`Favorite`/`Subscriber`/`NewsletterLog`/`PipelineEvent`) e `prisma db push --accept-data-loss` (17/08/2026, constraint única em `News.sourceUrl`). O `db push` aplica o schema **sem registrar nada** na tabela `_prisma_migrations`.

Resultado: o Neon tem as tabelas certas e nenhum histórico. Se o primeiro `prisma migrate deploy` rodar assim, o Prisma vê uma migration pendente (`0_init`, que faz `CREATE TABLE` em tudo) contra um banco que já tem essas tabelas, e aborta com:

```
P3005 The database schema is not empty.
```

O baseline resolve isso dizendo ao Prisma: "a `0_init` já está aplicada, comece a contar a partir dela".

## Pré-requisitos

- A connection string **direta** do Neon (ver abaixo)
- Acesso de admin ao repositório no GitHub (para cadastrar o secret)

### ⚠️ Direta, não pooled

O Neon expõe dois endpoints para o mesmo banco:

| Endpoint | Host | Para quê |
|---|---|---|
| pooled | `ep-xxxx**-pooler**.região.aws.neon.tech` | a aplicação em runtime (Render) |
| direta | `ep-xxxx.região.aws.neon.tech` | **migrations e Prisma CLI** |

O endpoint pooled passa pelo PgBouncer em modo transaction, que não suporta os advisory locks de sessão e o DDL que o Prisma Migrate usa. Para o baseline e para o workflow `migrate.yml`, use sempre a **direta** — basta remover `-pooler` do host, ou desligar o toggle **Connection pooling** no dashboard do Neon para ele gerar a string direta.

Consequência prática: o secret `DATABASE_URL` **no GitHub** recebe a string direta; a env `DATABASE_URL` **no Render** continua com a pooled. Mesmo nome, valores diferentes, de propósito.

Fonte: https://www.prisma.io/docs/orm/v6/overview/databases/neon

A migration `packages/database/prisma/migrations/0_init/migration.sql` já está versionada — foi gerada do schema atual e **não precisa ser recriada**.

## Passo 1 — Carregar a URL só na sessão do terminal

> ⚠️ **A connection string não é um comando.** Colá-la sozinha no terminal produz
> `'postgresql:' não é reconhecido como um comando interno ou externo`. Ela é um
> *valor* que você atribui a uma variável de ambiente.
>
> ⚠️ **As aspas são obrigatórias.** A string do Neon contém `&`
> (`...&channel_binding=require`), que no `cmd.exe` é separador de comandos e no
> PowerShell é o operador de chamada. Sem aspas, o shell parte a string em duas e
> tenta executar `channel_binding=require` como um segundo comando.

Rode a partir da raiz do projeto. **Não** coloque essa URL no `.env` — manter credenciais de produção na máquina é justamente o que a §37-C do plano V2 desaconselha. A variável morre quando você fechar o terminal.

**PowerShell** (prompt começa com `PS`):

```powershell
$env:DATABASE_URL = "postgresql://USUARIO:SENHA@HOST.neon.tech/neondb?sslmode=require&channel_binding=require"
```

**Prompt de Comando** (prompt começa direto com `C:\`) — as aspas envolvem `VAR=valor` inteiro:

```cmd
set "DATABASE_URL=postgresql://USUARIO:SENHA@HOST.neon.tech/neondb?sslmode=require&channel_binding=require"
```

Confira com `echo $env:DATABASE_URL` (PowerShell) ou `echo %DATABASE_URL%` (cmd).

Ao copiar do dashboard do Neon: se vier no formato `psql 'postgresql://...'`, use só a parte de `postgresql://` em diante, sem o `psql` e sem as aspas simples. O parâmetro `channel_binding=require` pode ficar — o Prisma o aceita sem reclamar.

## Passo 2 — Confirmar que o schema local bate com o de produção

Este passo é o que impede o baseline de mentir. Ele compara o banco real com o `schema.prisma` e imprime o SQL que seria necessário para igualá-los:

```powershell
pnpm --filter @newranews/database exec prisma migrate diff --from-url "$env:DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

**Saída esperada:** `-- This is an empty migration.` (ou nenhum comando SQL).

Se aparecer qualquer `CREATE`, `ALTER` ou `DROP`, **pare**: o banco de produção divergiu do schema versionado. Me mostre a saída antes de continuar — marcar o baseline com drift pendente esconde a diferença em vez de resolvê-la.

## Passo 3 — Marcar a `0_init` como já aplicada

```powershell
pnpm --filter @newranews/database exec prisma migrate resolve --applied 0_init
```

Isso só insere a linha correspondente em `_prisma_migrations`. **Nenhum DDL é executado, nenhum dado é tocado.**

Saída esperada: `Migration 0_init marked as applied.`

## Passo 4 — Conferir

```powershell
pnpm db:migrate:status
```

Saída esperada: `Database schema is up to date!`

## Passo 5 — Cadastrar o secret no GitHub

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

- **Name:** `DATABASE_URL`
- **Secret:** a connection string **direta** (sem `-pooler` — ver Pré-requisitos)

Enquanto esse secret não existir, o workflow `migrate.yml` roda e sai sem fazer nada — é por isso que a ordem é baseline primeiro, secret depois.

> Se o Neon permitir, crie um role dedicado para o CI em vez de reusar o owner. O workflow só precisa de DDL no schema da aplicação.

## Passo 6 — Fechar a sessão do terminal

```powershell
Remove-Item Env:\DATABASE_URL
```

## Passo 7 — Validar o workflow

`Actions` → **Migrate (produção)** → `Run workflow`. Sem migrations novas, o job roda e reporta que está tudo aplicado.

## Daqui em diante

```bash
pnpm db:migrate -- --name add_briefing_metadata
```

Revise o SQL gerado, commite a pasta da migration junto da mudança em `schema.prisma`, e o merge na `main` dispara o `migrate deploy` sozinho. Estratégia completa — nomenclatura, expand-and-contract, rollback — na §37 do [plano V2](Newra-News-V2-Frontend-Redesign-Plan.md).

## Se algo der errado

| Sintoma | Causa | O que fazer |
|---|---|---|
| `'postgresql:' não é reconhecido como um comando` | a connection string foi colada sozinha no terminal | ela é um valor, não um comando — atribua a `DATABASE_URL` como no Passo 1 |
| `'channel_binding' não é reconhecido como um comando` | o `&` da string fora de aspas virou separador de comandos | envolver a string em aspas duplas (Passo 1) |
| `P3005 The database schema is not empty` | o Passo 3 não rodou, ou rodou contra outro banco | conferir a `DATABASE_URL` e repetir o Passo 3 |
| Passo 2 imprime `ALTER`/`CREATE` | o banco divergiu do `schema.prisma` | não seguir para o Passo 3 — o drift precisa ser reconciliado antes |
| `P1001 Can't reach database server` | Neon suspenso ou string sem `?sslmode=require` | abrir o dashboard do Neon para acordar o compute e conferir a string |
| Migration trava, dá timeout ou erro de advisory lock | está usando o endpoint **pooled** | remover `-pooler` do host (ver Pré-requisitos) |
| `migrate status` acusa migration pendente depois do Passo 3 | o nome não bate com a pasta | a pasta é `0_init` — o argumento do `--applied` tem que ser idêntico |
