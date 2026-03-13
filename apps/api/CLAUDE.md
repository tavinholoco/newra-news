# Backend — Fastify API

## Arquitetura
- Fastify 4.x com TypeScript
- Padrão: routes → services → providers
- Routes: validação Zod + chamam services
- Services: lógica de negócio + acesso ao DB via Prisma
- Providers: clients de APIs externas (NewsAPI, RSS, Gemini, Groq)

## Padrões de Código
- Cada rota em seu próprio arquivo com schema Zod adjacente
- Services são classes ou funções puras (sem dependência de Fastify)
- Providers implementam interface comum por categoria
- Erros customizados em src/utils/errors.ts
- Logger via Fastify built-in (pino)
- Plugins registrados em src/plugins/

## Rotas
- GET /api/health — healthcheck
- GET /api/news — listar notícias (paginado, filtro por categoria)
- GET /api/news/:id — notícia por ID
- GET /api/articles — listar artigos
- GET /api/articles/:date — artigo por data (YYYY-MM-DD)
- GET /api/articles/latest — artigo mais recente
- POST /api/jobs/daily-pipeline — trigger do pipeline (Bearer token)

## Pipeline Diário (9 etapas)
Coleta → Normalização → Deduplicação → Persistência →
Seleção → Geração IA → Persistência Artigo → Cleanup → Métricas

## Testes
- Vitest com fastify.inject() para testes de rota
- Mocks para providers externos (NewsAPI, Gemini, Groq)
- Helper em tests/helpers/test-server.ts