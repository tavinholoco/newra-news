# Backend — Fastify API

## Arquitetura
- Fastify 4.x com TypeScript
- Padrão: routes → services → providers
- Routes: validação Zod + chamam services
- Services: lógica de negócio + acesso ao DB via Prisma
- Providers: clients de APIs externas organizados em subdiretórios

## Padrões de Código
- Cada rota em seu próprio arquivo com schema Zod adjacente
- Services são classes ou funções puras (sem dependência de Fastify)
- Providers organizados em `providers/news/` (NewsData.io, RSS) e `providers/ai/` (Gemini, Groq, ai-utils)
- Erros customizados em src/utils/errors.ts
- Logger via Fastify built-in (pino)
- Plugins registrados em src/plugins/

## Rotas
- GET /api/health — healthcheck (keep-alive)
- GET /api/news — listar notícias (paginado, filtro por categoria, busca, data)
- GET /api/news/:id — notícia por ID
- GET /api/news/:id/related — relacionadas (mesma categoria em ±72h, com 2 níveis de fallback)
- GET /api/home — resposta agregada da Home da V2 (hero, briefing, top, trending, categorias, latest)
- GET /api/trending — etapa 1: recência (meia-vida 12h) + favoritos × 2
- GET /api/articles — listar artigos
- GET /api/articles/:date — artigo por data (YYYY-MM-DD)
- GET /api/articles/latest — artigo mais recente
- POST /api/jobs/daily-pipeline — trigger do pipeline (Bearer token, rate limit: 20 req/min)
- POST /api/jobs/renormalize-news — reaplica as regras de ingestão ao acervo já
  gravado (Bearer `JOB_SECRET`). **`dryRun` é o padrão** — gravar exige
  `{"dryRun": false}` explícito. Corpo: `dryRun`, `limit`, `sources`
- GET /api/jobs/:pipelineId — status de execução do pipeline
- GET /api/metrics/weekly — métricas agregadas dos últimos 7 dias
- GET /api/metrics/monthly — métricas do mês completo
- GET /api/metrics/dashboard — **admin (JWT + role ADMIN)**: hoje + última semana + último mês
- GET /api/dev/logs — observabilidade dev-only (JOB_SECRET): últimos runs + erros recentes (filtros status/since/limit)
- GET /api/dev/logs/:pipelineId — detalhe completo do run com eventos por etapa
- GET /dev/dashboard — página HTML dev-only (JOB_SECRET via header ou `?secret=`): runs, erros e status dos providers

## Editorial (V2)
- Serviços em `services/{home,trending,related}.service.ts`, mapper compartilhado
  em `services/editorial.mapper.ts` (`News` → `EditorialStory`)
- **A ponte entre os dois enums `Category`** (Prisma e `packages/types`) mora no
  mapper, uma vez só — são idênticos em membros e nominalmente distintos para o
  TypeScript
- **`Cache-Control` só existe nestas rotas**, via `utils/cache.ts`. É header por
  rota e não hook global de propósito: um hook aplicaria política às rotas
  autenticadas, e `s-maxage` num proxy compartilhado ali seria vazamento entre
  sessões
- `getHome` não repete notícia entre blocos — a precedência resolve a disputa e
  o bloco perdedor desce o próprio ranking até preencher

## Pipeline Diário (9 etapas)
Coleta → Normalização → Deduplicação → Persistência →
Seleção → Geração IA → Persistência Artigo → Cleanup → Métricas

Cleanup: News >30 dias, PipelineLogs >30 dias, Articles >90 dias

## Ingestão: higiene de texto e categoria

Duas regras que não são óbvias no código e custaram uma Home errada em produção:

- **O texto do feed é limpo na entrada, em `providers/news/feed-text.ts`.** O
  que chega em `title`/`description` não é o que os nomes sugerem: título com
  quebra de linha literal, e `description` que abre repetindo o título, depois
  o crédito da foto, e só então o corpo. Limpar na ingestão é o único lugar
  onde se conserta uma vez — o campo alimenta o `dek` do contrato editorial, o
  resumo dos cards e o texto que o classificador lê.
- **Palavra-chave de categoria tem de dizer do que a matéria _trata_, não como
  ela foi apurada.** `redes sociais`, `celular`, `internet`, `programacao`
  (grade de atrações!), `empresa`, `fundo`, `clube` e `ia` (`ia` casa o
  imperfeito de "ir") aparecem em qualquer pauta e classificaram matéria
  policial como Tecnologia. O classificador tem três defesas: teto de 2
  ocorrências por palavra, piso de 3 palavras **distintas** para a descrição
  decidir sozinha, e **título vence corpo em empate** — a ordem de
  `CATEGORY_PRIORITY` só decide entre iguais.
- **Corrigir a ingestão só conserta o que entra.** O acervo vive 30 dias, então
  a Home continuaria mostrando a categoria errada por um mês. Quem repara o que
  já está gravado é `services/news-renormalizer.service.ts`, e ele faz as três
  coisas **na mesma ordem da ingestão** — decodifica, higieniza, e só então
  classifica. Reclassificar sobre a descrição suja daria um resultado diferente
  do que a mesma matéria teria se entrasse hoje.
- **O recorte é `CLASSIFIER_OWNED_SOURCES`**, derivado das fontes sem
  `category` fixa em `rss-sources.ts`. Fonte com categoria fixa teve a
  categoria escolhida pela configuração; recalcular ali destrói dado correto.
- **A normalização precisa ser ponto fixo.** `decodeEntities` decodifica até
  convergir (teto de 3 passadas) porque o acervo tem escape duplo
  (`&amp;eacute;`); enquanto parava na primeira, o job reescrevia as mesmas
  linhas em toda execução.
- **`WORLD` é o balde genérico, e é onde matéria de polícia e trânsito deve
  cair.** Não há categoria para esse gênero no enum, e forçá-lo em outra é
  exatamente o defeito que foi corrigido.

## Providers
```
providers/
├── types.ts          # RawNewsItem, GeneratedArticle
├── news/
│   ├── newsdata.provider.ts
│   └── rss.provider.ts
└── ai/
    ├── gemini.provider.ts
    ├── groq.provider.ts
    └── ai-utils.ts   # formatNewsItems, parseMarkdownResponse
```

## Testes
- Vitest com fastify.inject() para testes de rota
- Mocks para providers externos (NewsData, Gemini, Groq)
- Helper em tests/helpers/test-server.ts
- Cobertura: routes, services, providers, plugins, jobs
