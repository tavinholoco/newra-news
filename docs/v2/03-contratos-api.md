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

> Atenção: **nenhuma rota da API define `Cache-Control` hoje** — não há
> precedente no `apps/api` para copiar. Este endpoint estreia o padrão, então a
> Fase 3 precisa decidir onde ele mora (um hook `onSend` no plugin, ou header
> por rota) em vez de assumir que já existe um lugar para isso.

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

> **✅ Implementada em 20/08/2026**, antes da Fase 1 e não entre as Fases 2 e 3
> como a ordem original previa. O motivo é que **o dado só é capturado daqui
> para frente**: nada registrava quais notícias entravam no briefing, o Stage 8
> apaga `News` com mais de 30 dias e `Article` vive 90 — cada dia de atraso era
> um briefing permanentemente sem lista de fontes. Ver §7.
>
> Duas coisas mudaram do que está especificado abaixo, e o motivo está anotado
> logo após o bloco de schema.

A §18.4 exige que o artigo diário tenha data de referência, horário de geração,
versão do prompt/modelo, lista de fontes e status. O modelo `Article` tinha:

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
  id        String   @id @default(uuid())
  articleId String
  newsId    String?              // ponteiro fraco, ver nota 1
  position  Int
  title     String               // desnormalizado, ver nota 1
  source    String
  sourceUrl String
  createdAt DateTime @default(now())

  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([articleId, sourceUrl])
  @@index([articleId, position])
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
  FAILED
}
```

### O que mudou da especificação, e por quê

**1. `BriefingSource` guarda `title`, `source` e `sourceUrl`, não só o `newsId`.**
A versão original supunha um join com `News` na hora de exibir. Mas o Stage 8 do
pipeline apaga `News` com mais de **30 dias** e `Article` vive **90** — o join
deixaria dois terços dos briefings retidos com a lista de fontes vazia, que é
exatamente o que a §18.4 quer preservar. Copiar três colunas custa ~200 bytes
por fonte e faz o registro de auditoria sobreviver ao cleanup.

**2. A chave natural passou a ser `sourceUrl`, e `newsId` virou nulável.**
O `createMany` do Stage 4 não devolve ids, então o `newsId` é resolvido por
`sourceUrl` (que é `@unique` em `News`) depois de persistir. Quando a busca não
resolve, a fonte é gravada mesmo assim com `newsId` nulo: perder o registro de
auditoria é pior que perder o ponteiro, e os campos que a interface exibe estão
todos na própria linha. Com `newsId` nulável, ele não serve mais como chave de
unicidade — o Postgres aceita múltiplos nulos num índice único.

### Como ficou no pipeline

- os campos novos são **nullable** por causa dos artigos já publicados —
  expand and contract da §37-F, sem backfill (que seria impossível de qualquer
  forma: nada registrava as notícias de origem);
- `position` preserva a ordem em que as notícias foram enviadas à IA;
- `promptVersion` é **época + impressão digital do conteúdo do prompt**
  (`v1-ebb73b75`), não um número escrito à mão — uma versão manual que alguém
  esquece de subir passa a mentir sobre qual prompt gerou o artigo;
- `modelVersion` é o **modelo**, não o provider: o `ai.service` devolve
  `GEMINI_MODEL` ou `GROQ_MODEL` conforme quem gerou. O nome do provider não
  bastaria — o modelo por trás dele muda (o Groq trocou `llama-3.1-8b-instant`
  por `openai/gpt-oss-20b` em 08/2026);
- o Stage 7 **substitui** as fontes numa transação em vez de acrescentar: o
  artigo é upsert por data, e um segundo run no mesmo dia escolhe outro conjunto
  de notícias;
- `packages/types/src/article.ts` acompanha, com `BriefingSource` e
  `ArticleWithSources`.

---

## 7. Ordem de implementação

| Ordem | Item | Quando | Bloqueia |
|---|---|---|---|
| 1 | migration `add_daily_briefing_metadata` + tipos | ✅ **feito, antes da Fase 1** | Fase 5 |
| 2 | `GET /api/home` | ✅ **feito** — `feat/v2-editorial-api`, 20/08/2026 | Fase 3 |
| 3 | `GET /api/trending` (etapa 1) | ✅ **feito** | Fase 3 |
| 4 | `GET /api/news/:id/related` | ✅ **feito** | Fases 4 e 5 |
| 5 | `GET /api/trending` (etapa 2) | depois da Fase 8 | — |

> **A Fase 3 deixou de estar bloqueada.** Os três endpoints estão implementados,
> com 52 testes, e documentados em `docs/api.md`. O que a implementação decidiu
> além do que esta especificação previa está em §8.

**Por que o item 1 saiu na frente.** A ordem não é só de dependência técnica: o
dado de auditoria **só é capturado daqui para frente**. Nada registrava quais
notícias entravam no briefing — o Stage 5 logava apenas a contagem — e tanto
`News` (30 dias) quanto `PipelineLog` (30 dias) são purgados pelo cleanup. Todo
briefing gerado antes desta migration fica permanentemente sem lista de fontes,
sem backfill possível. Como a Fase 5 exibe transparência de IA sobre um
histórico de 90 dias, adiar custava dado, não só tempo.

**Os itens 2–4 são pré-requisito das fases de frontend**, não trabalho paralelo
a elas: precisam estar mergeados antes de a Fase 3 abrir. Como vivem em
`apps/api` e as Fases 1–2 em `apps/web`, as branches não conflitam. Cada um leva
teste Vitest com `fastify.inject()` e validação Zod na entrada, como manda a
convenção do repo.

---

## 8. O que a implementação decidiu além desta especificação

Três pontos que o contrato deixava em aberto e que só apareceram ao escrever o
código. Ficam aqui porque são decisões, não detalhes.

### 8.1 A precedência não pode esvaziar um bloco

A §3 manda "sem repetição entre blocos", com precedência `hero` → `topStories`
→ `trending` → `categories` → `latest`. Lida ao pé da letra, ela **esvazia o
trending**: `topStories` leva as mais recentes, o trending ranqueia por
recência, e os primeiros colocados dele já saíram.

O teste pegou isso antes de ir para produção. A leitura correta é que a
precedência resolve **quem fica com a notícia disputada** — o bloco perdedor
continua descendo o próprio ranking até preencher suas vagas. Na prática:
`/api/home` pede 4× mais candidatos ao trending do que as vagas que tem.

### 8.2 Onde o `Cache-Control` mora

O contrato registrava que **não havia precedente** no `apps/api` e deixava a
decisão para esta etapa. Ficou **header por rota**, através de
`utils/cache.ts`, e não um hook `onSend` global.

O motivo é segurança, não estilo: um hook aplicaria política a rotas que não
devem tê-la. `/api/favorites` e `/api/metrics/dashboard` devolvem dado por
usuário — `s-maxage` num proxy compartilhado ali é vazamento entre sessões, não
otimização. Com helper, a string mora num lugar só e o call site diz se a rota
é cacheável sem ninguém abrir um plugin.

### 8.3 `EditorialStory` ganhou `sourceUrl`

A §2 não o listava. Mas `SourceBadge` (entregue na Fase 1) linka o veículo para
a matéria original, e sem `sourceUrl` na resposta a Home teria de buscar a
notícia inteira só para montar uma atribuição de fonte.

### Detalhes menores, pelo mesmo critério

- **`readingTimeMinutes` é `null`, não `0`, quando não há texto.** Zero minutos
  é uma afirmação; ausência de conteúdo é outra coisa, e cerca de um terço do
  acervo vem de RSS só com o resumo.
- **`isFeatured`/`isTrending` só aparecem quando verdadeiros.** Mandá-los como
  `false` em toda matéria triplicaria o ruído sem dizer nada que a ausência já
  não diga.
- **As seções por categoria saem na ordem do enum.** Ordenar por volume faria
  os blocos da Home trocarem de lugar sozinhos de um dia para o outro.
- **`aiDisclosure` é constante `true`, não coluna.** Todo briefing é gerado por
  IA e a §8 do plano exige declará-lo; uma coluna sugeriria que existe briefing
  sem IA — e daria a alguém a chance de gravar `false`.
