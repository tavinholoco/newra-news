# Database — Prisma ORM

## Responsabilidade
Este package é o ponto único de acesso ao banco de dados.
Exporta o Prisma Client configurado e os tipos gerados.
Nenhum outro package deve importar @prisma/client diretamente.

## Estrutura
- prisma/schema.prisma → Schema do banco (fonte única de verdade)
- prisma/migrations/ → Migrations geradas pelo Prisma (nunca editar manualmente)
- prisma/seed.ts → Seed de dados iniciais para desenvolvimento
- src/index.ts → Export do PrismaClient singleton

## Models
- News → Notícias coletadas (retenção: 30 dias)
- Article → Artigos diários gerados por IA (retenção: 90 dias)
- PipelineLog → Logs de execução do pipeline (retenção: 30 dias)
- PipelineEvent → Eventos por etapa de uma execução do pipeline, com nível e contexto (sem cleanup próprio — removidos em cascata junto do PipelineLog)
- User → Contas autenticadas, com papel de acesso (USER/ADMIN); criado/atualizado por upsert no login
- Favorite → Vínculo entre usuário e notícia favoritada (único por par userId+newsId)
- Subscriber → Inscritos na newsletter, com status e token único para descadastro
- NewsletterLog → Resultado do envio diário da newsletter (um registro por data: total/enviados/falhos)
- DailyMetric → Métricas diárias (retenção: indefinida)

> O cleanup (Stage 8 de `apps/api/src/services/pipeline.service.ts`) só apaga News, Article e PipelineLog — os demais models não têm política de retenção.

## Enums
- Category: TECHNOLOGY, POLITICS, ECONOMY, SPORTS, SCIENCE, ENTERTAINMENT, WORLD, HEALTH
- PipelineStatus: RUNNING, SUCCESS, FAILED
- PipelineEventLevel: INFO, WARN, ERROR
- SubscriberStatus: ACTIVE, UNSUBSCRIBED
- UserRole: USER, ADMIN

## Regras
- Toda alteração no schema requer uma migration: `pnpm db:migrate -- --name <nome>`
  - O `--` é obrigatório: o script raiz é `turbo db:migrate` e, sem ele, o turbo consome o argumento `--name`
- Migrations são versionadas no git (a partir do baseline `0_init`) — nunca voltar a ignorá-las
- Em produção as migrations são aplicadas **apenas** pelo workflow `.github/workflows/migrate.yml`, nunca localmente
  - Baseline e passo a passo: docs/db-baseline.md
  - Estratégia completa: §37 de docs/Newra-News-V2-Frontend-Redesign-Plan.md
- Após alterar o schema, sempre rodar `pnpm db:generate`
- Índices definidos no schema para queries frequentes (category, publishedAt, date)
- O campo Article.date é @unique — apenas um artigo por dia
- DailyMetric.date é @unique — usa upsert para evitar duplicatas
- NewsletterLog.date é @unique — apenas um envio registrado por dia
- Seed deve criar dados realistas para todas as categorias

## Padrão de Export
O PrismaClient é exportado como singleton:
```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export { prisma };
export * from '@prisma/client';
```

## Conexão
- Local: PostgreSQL via Docker (DATABASE_URL no .env)
- Produção (Neon Free Tier): dois destinos usam o nome `DATABASE_URL` com **valores diferentes**, de propósito
  - **Render** (aplicação em runtime) → connection string **pooled** (host com sufixo `-pooler`)
  - **Secret do GitHub** (usado pelo workflow `migrate.yml`) → connection string **direta** (host sem `-pooler`)
- O endpoint pooled passa pelo PgBouncer em modo transaction, que não suporta os advisory locks de sessão nem o DDL exigidos pelo Prisma Migrate — por isso migrations e Prisma CLI usam sempre a string direta
