# Newra News

Portal de noticias com artigo diario gerado por IA.

## Stack

- **Frontend:** Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui
- **Backend:** Fastify + TypeScript + Prisma
- **Database:** PostgreSQL (Neon)
- **AI:** Google Gemini + Groq (fallback)
- **Monorepo:** Turborepo + pnpm workspaces

## Setup

```bash
# Install dependencies
pnpm install

# Start PostgreSQL + pgAdmin
docker compose up -d

# Generate Prisma Client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start development
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Run ESLint across the monorepo |
| `pnpm test` | Run Vitest (backend) |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:generate` | Generate Prisma Client |
| `pnpm db:studio` | Open Prisma Studio |

## Project Structure

```
newranews/
├── apps/
│   ├── web/          # Frontend — Next.js
│   └── api/          # Backend — Fastify
├── packages/
│   ├── database/     # Prisma ORM
│   ├── types/        # Shared TypeScript types
│   ├── eslint-config/# ESLint configs
│   └── tsconfig/     # TSConfigs
├── docs/             # Documentation
└── docker-compose.yml
```

## Documentation

- [PRD](docs/PRD-NewraNews_V1.1.md)
- [Architecture](docs/architecture.md)
- [API Guide](docs/api.md)
- [Setup Guide](docs/setup.md)
