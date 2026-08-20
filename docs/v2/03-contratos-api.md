# Contratos de API da V2.0

Entregável da Fase 0 (plano V2 §35: "definir API agregada da Home"). É
**especificação**, não implementação — nenhum endpoint aqui existe ainda.

O motivo de fechar isto na Fase 0 e não na Fase 3: a Home da §6 consome os três
endpoints novos ao mesmo tempo, e a página de artigo depende de campos que o
banco não tem. Descobrir isso no meio da Fase 3 pararia a fase.

Base: §18 do plano. Todas as rotas ficam sob o prefixo `/api/*` registrado em
`apps/api/src/app.ts`. Envelope `{ data }` / `{ data, meta }` de
`packages/types/src/api.ts` — sem exceções.

---

## 1. O que já existe e não muda

`GET /api/news`, `GET /api/news/:id`, `GET /api/articles`,
`GET /api/articles/latest`, `GET /api/articles/:date`,
`GET /api/metrics/*`, `POST/GET /api/newsletter/*`, `/api/favorites/*`,
`/api/jobs/*`, `/api/health/*`, `/api/dev/*`.

Documentados em `docs/api.md`, conferidos contra o código em 20/08/2026.

---

## 2. Tipos editoriais

A §24 pede tipos explícitos para o modelo editorial, em vez de campos genéricos
de card. Vão para `packages/types/src/editorial.ts`.

```ts
/** Notícia na perspectiva da composição editorial, não da coleta. */
export interface EditorialStory {
  id: string;
  title: string;
  dek?: string;              // description da News, renomeada para o vocabulário editorial
  imageUrl?: string;
  category: Category;        // enum de packages/types/src/news.ts
  source: string;
  publishedAt: string;
  updatedAt?: string;
  readingTimeMinutes?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
}

export interface BriefingSource {
  newsId: string;
  title: string;
  source: string;
  sourceUrl: string;
}

export interface DailyBriefing {
  id: string;
  date: string;              // YYYY-MM-DD
  title: string;
  summary: string;
  sourceCount: number;
  readingTimeMinutes: number;
  generatedAt: string;       // não existe no modelo Article — ver §5
  aiDisclosure: boolean;
  sources: BriefingSource[]; // não existe no modelo Article — ver §5
}
```

`EditorialStory` é derivável de `News` hoje, **menos** três campos:

| Campo | De onde vem |
|---|---|
| `readingTimeMinutes` | calculado de `content`/`description` no serviço — não persistir |
| `isFeatured` | posição na resposta de `/api/home`, não coluna no banco |
| `isTrending` | score da §3 abaixo, calculado na consulta |

Nenhum dos três exige migration. `DailyBriefing`, sim (§5).

---

## 3. `GET /api/home` — resposta agregada

**Por que existe:** a Home da V2 tem hero, briefing, top stories, trending,
seções por categoria e newsletter. Composta bloco a bloco, são 6+ chamadas em
sequência a partir de um Server Component. A home de hoje faz 2.

```http
GET /api/home?locale=pt-BR
```

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `locale` | `pt-BR \| en` | `pt-BR` | reservado; hoje o acervo é único |
| `categories` | number | 4 | quantas seções por categoria retornar |

```ts
interface HomeResponse {
  hero: EditorialStory | null;
  briefing: DailyBriefing | null;
  topStories: EditorialStory[];        // 4–6, sem repetir o hero
  trending: EditorialStory[];          // 5, ordenadas por score (§4)
  latest: EditorialStory[];            // 12, ordem cronológica
  categories: Array<{
    category: Category;
    stories: EditorialStory[];         // 3–4 por categoria
  }>;
}
```

Regras que o serviço precisa garantir:

- **sem repetição entre blocos** — uma notícia aparece uma vez só na resposta;
  `hero` tem precedência, depois `topStories`, `trending`, `categories`, `latest`;
- `hero` é a notícia mais recente com `imageUrl` não nulo — a §6.2 quer capa, e
  cerca de 30% do acervo não tem imagem (limitação conhecida dos feeds RSS);
- `briefing` é o `/articles/latest` de hoje, ou `null` se o pipeline do dia ainda
  não rodou — a Home precisa renderizar sem ele;
- categorias vazias são omitidas, não retornadas com lista vazia.

**Cache:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`.
A ISR de 3600s da home continua; o `s-maxage` menor existe para o
`revalidatePath` on-demand do cron (`/api/cron/daily-news`) surtir efeito.

**Sem campo `newsletter`.** A §18.1 lista `newsletter` no exemplo conceitual, mas
o bloco da Home é estático (copy + form) e não depende de dado do servidor.
Incluí-lo seria peso morto na resposta.

---

## 4. `GET /api/trending`

```http
GET /api/trending?limit=5&window=24h
```

| Param | Tipo | Default | Limites |
|---|---|---|---|
| `limit` | number | 5 | 1–20 |
| `window` | `24h \| 7d` | `24h` | |

Resposta: `{ data: EditorialStory[] }`, com `isTrending: true`.

**Score.** A §18.2 propõe `recency + clicks + saves + shares`. Só um desses
sinais existe hoje: `saves` (a tabela `Favorite`). Cliques e compartilhamentos
dependem da camada de analytics (`04-analytics-e-slots.md`), que ainda não
existe.

A implementação honesta é em duas etapas:

```
Etapa 1 (Fase 3) — sinais disponíveis:
  score = recency_decay(publishedAt) * 1.0 + saves * 2.0

Etapa 2 (depois da Fase 8, com analytics no ar):
  score = recency_decay * 1.0 + saves * 2.0 + clicks * 0.5 + shares * 3.0
```

`recency_decay` = meia-vida de 12h dentro da janela. Sem ML, como a §18.2 diz.

Documentar a etapa 1 como etapa 1 importa: um "trending" que na prática é
"mais favoritadas + recentes" precisa estar claro para quem lê o código depois,
senão vira mito.

---

## 5. `GET /api/news/:id/related`

```http
GET /api/news/:id/related?limit=4
```

Resposta: `{ data: EditorialStory[] }`. `404` se a notícia base não existir.

**Critério de relacionamento**, em ordem de precedência:

1. mesma `category`, publicadas em ±72h, excluindo a própria;
2. completar com a mesma `category` fora da janela;
3. completar com as mais recentes de qualquer categoria.

Sem embeddings nem busca semântica nesta fase. O acervo é de notícia diária e a
categoria já é um sinal forte — a §9 pede relacionadas úteis, não relevância
de estado da arte.

---

## 6. Auditoria do briefing — a única migration obrigatória

A §18.4 exige que o artigo diário tenha data de referência, horário de geração,
versão do prompt/modelo, lista de fontes e status. O modelo `Article` tem hoje:

```prisma
model Article {
  id        String   @id @default(uuid())
  title     String
  content   String
  summary   String
  date      DateTime @unique
  newsCount Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Nenhum campo de auditoria, e **nenhuma relação com as notícias que originaram o
briefing** — `newsCount` é um número solto. Sem isso, o `DailyBriefing` da §24
não tem de onde ser preenchido e a seção de transparência de IA da §8 não tem o
que mostrar.

Migration `add_daily_briefing_metadata` (§37-E), seguindo a nomenclatura da
§37-D:

```prisma
model Article {
  // ... campos atuais
  generatedAt   DateTime?       // quando a IA gerou (≠ createdAt da linha)
  promptVersion String?
  modelVersion  String?         // ex.: "gemini-2.5-flash"
  status        ArticleStatus   @default(PUBLISHED)
  sources       BriefingSource[]
}

model BriefingSource {
  id        String  @id @default(uuid())
  articleId String
  newsId    String
  position  Int
  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([articleId, newsId])
  @@index([articleId])
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
  FAILED
}
```

Notas de implementação:

- os campos novos são **nullable** por causa dos artigos já publicados —
  expand and contract da §37-F, sem backfill obrigatório;
- `BriefingSource` guarda `newsId` sem chave estrangeira, seguindo o padrão já
  usado em `Favorite` (as notícias são removidas pelo cleanup do pipeline; uma FK
  transformaria isso em cascata de exclusão do histórico);
- `position` preserva a ordem em que a IA citou as fontes;
- `packages/types/src/article.ts` acompanha a mesma migration;
- o `pipeline.service` passa a gravar `generatedAt`, `modelVersion` (que ele já
  conhece — é o provider escolhido no estágio 6) e as `sources` (o estágio 5 já
  seleciona as 15 notícias).

---

## 7. Ordem de implementação

| Ordem | Item | Bloqueia |
|---|---|---|
| 1 | migration `add_daily_briefing_metadata` + tipos | Fase 5 |
| 2 | `GET /api/home` | Fase 3 |
| 3 | `GET /api/trending` (etapa 1) | Fase 3 |
| 4 | `GET /api/news/:id/related` | Fases 4 e 5 |
| 5 | `GET /api/trending` (etapa 2) | — depois da analytics |

Os itens 2–4 são pré-requisito de fases do frontend e devem estar prontos
**antes** delas, não em paralelo. Cada um leva teste Vitest com
`fastify.inject()` e validação Zod na entrada, como manda a convenção do repo.
