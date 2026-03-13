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
- DailyMetric → Métricas diárias (retenção: indefinida)

## Enums
- Category: TECHNOLOGY, POLITICS, ECONOMY, SPORTS, SCIENCE, ENTERTAINMENT, WORLD, HEALTH
- PipelineStatus: RUNNING, SUCCESS, FAILED

## Regras
- Toda alteração no schema requer uma migration: `pnpm db:migrate`
- Após alterar o schema, sempre rodar `pnpm db:generate`
- Índices definidos no schema para queries frequentes (category, publishedAt, date)
- O campo Article.date é @unique — apenas um artigo por dia
- DailyMetric.date é @unique — usa upsert para evitar duplicatas
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
- Produção: Neon Free Tier (connection string via env var no Render)