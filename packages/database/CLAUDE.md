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
- Article → Artigos diários gerados por IA (retenção: 90 dias), com auditoria da geração (`generatedAt`, `promptVersion`, `modelVersion`, `status`)
- BriefingSource → Notícias que originaram o briefing do dia, ordenadas por `position`; título/fonte/URL são **desnormalizados** para o registro sobreviver ao cleanup de News, e `newsId` é ponteiro fraco (nulável, sem FK)
- PipelineLog → Logs de execução do pipeline (retenção: 30 dias)
- PipelineEvent → Eventos por etapa de uma execução do pipeline, com nível e contexto (sem cleanup próprio — removidos em cascata junto do PipelineLog)
- User → Contas autenticadas, com papel de acesso (USER/ADMIN); criado/atualizado por upsert no login
- Favorite → Item salvo pelo leitor. Alcança **duas** coisas — notícia e briefing —, por isso a chave é `userId+itemType+itemId` e `itemId` é ponteiro fraco, sem FK
- UserPreference → Preferências do leitor (categorias e tema). Tabela própria, e não colunas em `User`, porque `upsertUser` roda a cada sign-in
- Subscriber → Inscritos na newsletter, com status e token único para descadastro
- NewsletterLog → Resultado do envio diário da newsletter (um registro por data: total/enviados/falhos)
- DailyMetric → Métricas diárias (retenção: indefinida)
- ProductEvent → Evento de produto, anônimo por construção (retenção: 90 dias, por `occurredAt`)
- ErrorEvent → Falha registrada de forma durável, **uma linha por `(fingerprint, hora)`** e não por ocorrência (retenção de 14 dias — a etapa 8 aprende a apagar no PR de código da Fase 4)

> O cleanup (Stage 8 de `apps/api/src/services/pipeline.service.ts`) apaga News (30d), PipelineLog (30d), Article (90d) e ProductEvent (90d). PipelineEvent sai em cascata com o run; os demais models não têm política de retenção.

## Enums
- ArticleStatus: DRAFT, PUBLISHED, FAILED
- Category: TECHNOLOGY, POLITICS, ECONOMY, SPORTS, SCIENCE, ENTERTAINMENT, WORLD, HEALTH
- PipelineStatus: RUNNING, SUCCESS, FAILED
- PipelineEventLevel: INFO, WARN, ERROR
- SubscriberStatus: ACTIVE, UNSUBSCRIBED
- UserRole: USER, ADMIN
- FavoriteItemType: NEWS, ARTICLE
- ThemePreference: LIGHT, DARK, SYSTEM
- ErrorOrigin: API, PIPELINE, WEB, INVARIANT
- ErrorSeverity: WARN, ERROR, FATAL

> `ErrorEvent.code` e `ErrorEvent.category` são **texto**, não enum do banco: o conjunto fechado mora em `apps/api/src/utils/errors.ts`, com guarda derivada do parser. Repeti-lo aqui cobraria uma migration por código novo.

> A lista acima e a de Models são guardadas por `apps/api/tests/docs/schema-docs-drift.test.ts`, que as compara com o `schema.prisma`. Ela nasceu achando quatro ausências de meses — `UserPreference`, `ProductEvent`, `FavoriteItemType` e `ThemePreference`.

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
