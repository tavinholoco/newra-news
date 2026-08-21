# Newra News 2.0
## Plano mestre de redesign do produto, frontend e experiência editorial

**Projeto:** Newra News  
**Versão do plano:** 2.1  
**Data original:** 18/08/2026  
**Última atualização:** 19/08/2026  
**Referência visual principal:** The Daily Star — Digital News Platform Redesign (Behance)  
**Stack atual do web:** Next.js 14 App Router, Tailwind CSS, shadcn/ui, next-intl  
**Objetivo:** transformar o Newra News de um portal funcional em um produto editorial com identidade forte, hierarquia de conteúdo, leitura premium e fundação preparada para monetização.

---

## Nota de revisão — 19/08/2026

Atualização incremental sobre o plano original (V2.0). Toda a análise, prioridades e fases já definidas foram mantidas como estavam. Três seções novas foram adicionadas, seguindo o mesmo padrão de "Pontos A, B, C..." já usado no restante do documento (ex.: seção 3.1):

- **Seção 36 — README profissional**: como reestruturar o `README.md` do repositório seguindo boas práticas de projetos open source.
- **Seção 37 — Estratégia de migrations**: como planejar as migrations Prisma necessárias para suportar as mudanças de backend já previstas na seção 18.
- **Seção 38 — Padronização de estrutura MVP**: como organizar `apps/api` (e, por extensão, `apps/web`) em uma estrutura em camadas previsível.

Nada foi removido ou reescrito nas seções 1–35. Apenas a seção "Referências usadas" foi deslocada de 36 para 39 para acomodar o novo conteúdo.

## Nota de auditoria do repositório — 19/08/2026

O plano foi auditado contra o estado real da `main` e **corrigido no corpo das seções afetadas** — comandos que não funcionavam, rotas que não existem, endpoints com prefixo errado e pressupostos de infraestrutura que não se sustentavam. Onde uma seção foi corrigida, ela traz um bloco "Estado em 19/08/2026". Nenhuma análise, prioridade ou fase foi alterada.

Duas seções foram acrescentadas:

- **Seção 40 — Auditoria de prontidão**: o registro completo da auditoria — 3 bloqueadores (todos resolvidos ou com a parte executável entregue), 14 divergências corrigidas, a especificação do asset de logo e as 3 pendências que dependem de algo fora do repositório.
- **Seção 41 — Como conduzir a execução com Claude Opus 5**: convenções de trabalho para as sessões de desenvolvimento da V2.0.

---

## 1. Visão da V2.0

A V2.0 não deve ser tratada como um simples “novo CSS”. O objetivo é fazer uma mudança de produto: o Newra News precisa parecer e funcionar como uma publicação digital, e não como um feed de cards.

A direção visual do redesign do Behance usado como referência é particularmente útil por priorizar três coisas que combinam diretamente com o Newra:

- descoberta rápida de notícias;
- hierarquia editorial forte;
- leitura confortável em desktop e mobile.

O próprio case do Behance descreve o projeto como uma reformulação voltada a melhorar a descoberta, a leitura, a navegação, a usabilidade mobile e a escalabilidade da plataforma. O trabalho também foi apresentado pela equipe como uma revisão do ecossistema completo de notícias, incluindo comportamento de leitores e necessidades editoriais. Fontes: https://www.behance.net/gallery/251506525/The-Daily-Star-Digital-News-Platform-Redesign e https://www.linkedin.com/company/notionhive.

### Conceito visual proposto

**“Editorial moderno com sinal laranja.”**

A estética deve combinar:

- composição inspirada em jornal/editorial;
- tipografia com personalidade nos títulos;
- linhas e divisórias discretas;
- fotos grandes e recortes assimétricos;
- alto contraste e muito espaço negativo;
- laranja usado como sinal de interação, categoria, destaque e marca;
- branco/off-white como palco principal;
- dark mode com aparência de redação digital, não “dashboard gamer”.

A regra central é simples:

> O laranja deve identificar o Newra. Ele não deve dominar o Newra.

---

# 2. Auditoria do estado atual

## 2.1 O que o produto já possui de forte

O projeto atual já tem uma fundação técnica melhor do que a interface sugere.

O README descreve um pipeline que coleta notícias via NewsData.io + 13 feeds RSS, normaliza e deduplica os itens, seleciona notícias, gera o artigo diário com Gemini e usa Groq como fallback. Também existem oito categorias, histórico de artigos, busca/filtros, internacionalização pt-BR/en, SEO, dark mode, métricas e CI/CD. Fonte: https://github.com/tavinholoco/newra-news/blob/main/README.md.

No frontend, o projeto já utiliza:

- Next.js App Router;
- Tailwind CSS;
- shadcn/ui;
- next-intl;
- `next/image`;
- renderização estática/ISR;
- estrutura de componentes por domínio;
- páginas separadas para notícias, artigo, favoritos, métricas, newsletter e autenticação.

Isso significa que a V2.0 pode ser feita majoritariamente por refatoração de experiência, composição visual e evolução de componentes, sem necessidade de abandonar a arquitetura atual.

## 2.2 Problema principal da interface atual

A página inicial atual possui uma composição essencialmente linear:

1. artigo do dia em um grande bloco colorido;
2. título “Latest News”;
3. grade de notícias em três colunas;
4. cards com imagem, badge, título, descrição e metadata.

Isso aparece diretamente na implementação atual de `apps/web/app/[locale]/page.tsx`, que renderiza um `ArticleCard` seguido de um `NewsGrid`. Fonte: https://github.com/tavinholoco/newra-news/blob/main/apps/web/app/%5Blocale%5D/page.tsx.

O `ArticleCard` também utiliza atualmente um painel grande em `brand-100`, com título, resumo, data, contagem de fontes e link. Fonte: https://github.com/tavinholoco/newra-news/blob/main/apps/web/components/article/article-card.tsx.

Já o `NewsCard` é um componente de card tradicional, com imagem 16:9, badge laranja, título, descrição, fonte, data e favorito. Fonte: https://github.com/tavinholoco/newra-news/blob/main/apps/web/components/news/news-card.tsx.

### Diagnóstico

O problema não é falta de informação. É **falta de hierarquia editorial**.

Hoje, em termos conceituais, muitas notícias possuem aproximadamente o mesmo peso visual. Um portal de notícias precisa responder instantaneamente:

- O que é mais importante agora?
- O que aconteceu hoje?
- Quais assuntos estão em alta?
- Quais notícias são do meu interesse?
- Qual é a síntese do dia?
- Onde posso aprofundar?

A V2.0 deve fazer essas respostas aparecerem na própria composição da página.

---

# 3. Direção inspirada no The Daily Star, sem copiar

O objetivo não é reproduzir o layout do Behance. O objetivo é extrair seus princípios e construir uma linguagem própria para o Newra.

## 3.1 Elementos que devem ser absorvidos

### A. Masthead editorial

Criar uma área superior com maior presença de marca:

- logo Newra News maior — asset entregue e vetorizado em `apps/web/public/logo/` (§40.3). O **lockup horizontal** ainda não existe: a composição marca + wordmark tipográfico é decisão da Fase 2;
- data atual;
- estado editorial do dia;
- idioma;
- busca;
- autenticação/perfil;
- menu de categorias.

### B. Navegação de categorias mais editorial

Em vez de esconder toda a navegação atrás de ícones ou depender de um menu genérico, usar uma barra horizontal de assuntos:

`Todas | Tecnologia | Mundo | Economia | Política | Ciência | Esportes | Cultura | Saúde`

No mobile, essa barra vira scroll horizontal.

### C. Grid editorial assimétrico

A home deve abandonar a grade uniforme como elemento dominante.

A estrutura principal deve ter:

- 1 notícia principal grande;
- 2 ou 3 notícias secundárias;
- 1 coluna de “mais lidas” ou “em alta”;
- blocos menores de atualização rápida.

### D. Ritmo visual de jornal digital

Usar:

- linhas finas;
- títulos grandes;
- thumbnails em tamanhos diferentes;
- espaços generosos;
- áreas de conteúdo com largura controlada;
- pequenas etiquetas editoriais;
- poucos cantos arredondados.

### E. Mobile como produto principal

O relatório Digital News Report 2026 mostra que redes sociais e plataformas de vídeo já ultrapassaram sites e apps de notícias como porta de entrada global para notícias, enquanto o consumo de vídeo online continua crescendo. Isso aumenta o valor de uma interface própria extremamente clara, rápida e compartilhável. Fonte: https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary.

---

# 4. Nova identidade visual

## 4.1 Paleta recomendada

A paleta atual do projeto usa `#EC6426`, `#F8A91F`, `#632713` e `#FDE3CF`. Ela funciona como identidade, mas a quantidade de laranja/amarelo forte pode empurrar a interface para uma estética excessivamente saturada. Fonte: https://github.com/tavinholoco/newra-news/blob/main/apps/web/styles/globals.css.

Para a V2.0, a melhor estratégia é preservar o DNA cromático e aumentar a sofisticação por meio de neutralidade.

### Tokens propostos

| Token | Valor | Uso |
|---|---|---|
| `brand-950` | `#6F2815` | estados muito escuros, bordas de destaque |
| `brand-800` | `#8E3518` | hover/active em elementos sólidos |
| `brand-700` | `#A83E1C` | botões laranja com texto branco |
| `brand-600` | `#C94F22` | cor principal de marca e links fortes |
| `brand-500` | `#D96A34` | acentos e elementos secundários |
| `brand-100` | `#F8E8DE` | fundos de destaque muito suaves |
| `brand-50` | `#FCF5F0` | superfícies/editorial callouts |
| `ink-950` | `#111315` | texto principal |
| `ink-700` | `#34383D` | texto secundário |
| `ink-500` | `#697178` | metadata |
| `paper` | `#FAF9F7` | fundo editorial |
| `white` | `#FFFFFF` | cards/superfícies |
| `line` | `#E4E1DD` | divisórias |
| `yellow` | `#F3B562` | uso pontual, nunca como cor estrutural |

### Regra de uso

- 65–75%: neutros claros;
- 15–20%: branco/superfície;
- 5–10%: laranja;
- amarelo apenas como apoio;
- vermelho forte somente para estados semânticos reais.

### Custo real da migração

Hoje `globals.css` define **4** níveis de marca — `--brand-900`, `--brand-600`, `--brand-400`, `--brand-100` — e os redefine no `.dark` com valores diferentes (`--brand-600` vira `#F27E45`, `--brand-100` vira `#3A2417`). A proposta acima tem **7** níveis e nomes que não são um superset dos atuais.

Consequência prática para a Fase 1: não é um find-and-replace. Antes de trocar os valores é preciso mapear todos os usos de `brand-400` e `brand-900` no `apps/web` e decidir o destino de cada um — `brand-400` (amarelo `#F8A91F`) não tem equivalente direto na paleta nova, onde amarelo deixa de ser cor estrutural.

O laranja `#C94F22` tem contraste aproximado de 4,54:1 sobre branco, adequado para texto normal dentro do alvo WCAG AA. Para botões sólidos com texto branco, usar um laranja mais escuro como `#A83E1C`, que ultrapassa 6:1 sobre branco. A WCAG 2.2 recomenda pelo menos 4,5:1 para texto normal e 3:1 para texto grande. Fonte: https://www.w3.org/TR/WCAG22/.

## 4.2 Dark mode

O dark mode atual usa fundo `#1A1A1A`, card `#262626` e texto laranja-claro. Para a V2.0, separar melhor fundo, superfície e sinal de marca:

```text
Background   #0F1113
Surface 1    #171A1D
Surface 2    #20252A
Text main    #F3F1EE
Text muted   #A8AFB5
Orange       #F07A45
Orange dark  #C94F22
Line         rgba(255,255,255,.10)
```

O dark mode deve continuar sendo uma opção real de leitura, não uma simples inversão de cores.

---

# 5. Tipografia

A implementação atual usa Inter para texto e Bricolage Grotesque para display. Essa combinação é boa para produto, mas a V2.0 deve dar mais peso editorial aos títulos. Fonte atual: `apps/web/app/[locale]/layout.tsx`.

## Direção recomendada

### Headlines

Usar uma serif editorial contemporânea.

Opções compatíveis com Google Fonts:

- Newsreader;
- Source Serif 4;
- DM Serif Display, para usos pontuais.

### Interface

Manter Inter ou migrar para Manrope/IBM Plex Sans caso a direção visual peça uma interface menos genérica.

### Regra

- título principal: serif;
- subtítulo: sans/serif conforme contexto;
- metadata: sans;
- navegação: sans;
- botões: sans;
- números e indicadores: sans semibold.

Isso criará o contraste “redação + produto digital”.

---

# 6. Nova arquitetura da Home

A Home deve ser o centro do redesign.

## 6.1 Estrutura proposta

```text
┌──────────────────────────────────────────────────────┐
│ TOP BAR: data • idioma • newsletter • login          │
├──────────────────────────────────────────────────────┤
│                  NE W R A   N E W S                  │
│ Search   Latest  Categories  Saved  Profile          │
├──────────────────────────────────────────────────────┤
│ CATEGORY NAV / horizontal scroll                     │
├──────────────────────────────────────────────────────┤
│ BREAKING / LIVE / ATUALIZAÇÃO                         │
├───────────────────────────────┬──────────────────────┤
│               HERO            │      TOP STORIES     │
│     foto + headline grande    │  3 histórias menores │
│     resumo + CTA              │                      │
├───────────────────────────────┴──────────────────────┤
│                 NEWRA DAILY BRIEF                    │
│ artigo do dia + fontes + tópicos + tempo de leitura  │
├───────────────────────┬──────────────────────────────┤
│ MAIS NOTÍCIAS          │ EM ALTA / MAIS LIDAS         │
│ grid editorial         │ ranking vertical             │
├───────────────────────┴──────────────────────────────┤
│ TECNOLOGIA                                               │
│ lead + cards                                            │
├──────────────────────────────────────────────────────┤
│ MUNDO / ECONOMIA / CIÊNCIA / ESPORTES / CULTURA       │
├──────────────────────────────────────────────────────┤
│ NEWSLETTER / siga o Newra                             │
├──────────────────────────────────────────────────────┤
│ FOOTER editorial                                      │
└──────────────────────────────────────────────────────┘
```

## 6.2 Hero

A notícia principal não deve ser apenas o `ArticleCard` atual.

Criar um componente `HeroStory` que aceite:

- imagem principal;
- tag de categoria;
- headline grande;
- dek/resumo;
- timestamp;
- source;
- CTA;
- eventualmente indicador “Atualizado”.

A imagem deve ter prioridade visual.

## 6.3 “Newra Daily Brief”

O artigo gerado por IA é o principal diferencial do produto e precisa aparecer como **produto editorial próprio**, não como um card colorido.

Sugestão:

- fundo off-white ou superfície sutilmente laranja;
- pequeno selo “NEWRA DAILY BRIEF”;
- headline editorial;
- resumo com 2–3 linhas;
- “Fontes consultadas: X”;
- “Leitura: ~X min”;
- CTA “Ler o briefing completo”;
- botão “Ouvir” futuramente;
- botão “Salvar”.

### Diferencial narrativo

O usuário não deve pensar:

> “Esse site gera texto com IA.”

Deve pensar:

> “O Newra organiza o caos do dia em uma leitura rápida.”

A IA é a infraestrutura do produto. A promessa deve ser o resultado.

---

# 7. Página de notícias / categoria

A página `/news` deve deixar de parecer uma lista genérica de cards.

## Layout desktop

```text
Título da categoria
Descrição curta
──────────────
Filtros / busca / ordenação
──────────────
Hero da categoria
──────────────
Lista editorial
[image] headline / source / date
[image] headline / source / date
[image] headline / source / date
──────────────
Pagination / infinite load
```

## Filtros

- categoria;
- período;
- fonte;
- ordenação;
- somente salvos, quando aplicável.

## Busca

A busca deve ter:

- query persistida na URL;
- autocomplete futuro;
- histórico local de buscas;
- estado vazio útil;
- destaque do termo pesquisado.

---

# 8. Página de artigo

A página do artigo será uma das telas mais importantes da V2.0.

## Novo layout

```text
categoria
headline grande
subheadline
published / updated
source count
share / save
────────────────────
hero image
────────────────────
lead / resumo
corpo do artigo
────────────────────
fontes consultadas
artigos relacionados
newsletter CTA
```

## Corpo de texto

A coluna do texto deve ser limitada a aproximadamente 65–75 caracteres por linha em desktop.

Adicionar:

- subtítulos;
- citações destacadas quando existirem;
- imagens contextualizadas;
- links para fontes;
- indicador de leitura;
- compartilhamento;
- salvar;
- breadcrumb.

## Transparência de IA

Como o artigo é produzido por IA a partir de múltiplas fontes, cada artigo deve apresentar uma área “Como este briefing foi produzido”.

Exemplo de conteúdo:

- quantidade de fontes analisadas;
- fontes principais;
- horário da coleta;
- horário da geração;
- indicação explícita de que o texto foi produzido com auxílio de IA;
- observação de que o leitor deve consultar a fonte original para contexto completo.

Isso é importante para confiança, principalmente em um produto jornalístico com IA.

---

# 9. Artigos relacionados

No final de cada artigo:

```text
Leia também
────────────────────────
[image] notícia relacionada
[image] notícia relacionada
[image] notícia relacionada
```

O algoritmo futuro pode usar:

- categoria;
- entidades mencionadas;
- similaridade semântica;
- recência;
- popularidade.

Na V2.0, pode ser apenas categoria + recência para reduzir complexidade.

---

# 10. Header e navegação

O header atual tem wordmark textual ("Newra News" em `font-display`), seletor de idioma, tema, autenticação e navbar dentro de uma barra sticky de 64px (`h-16`). Fonte: `apps/web/components/layout/header.tsx`. O logo gráfico foi removido no commit `7621db3` — ver §3.1-A.

Para a V2.0, separar informação de sistema da navegação editorial.

## Desktop

### Linha 1

Data | edição atual | newsletter | linguagem | entrar

### Linha 2

Logo central ou alinhado à esquerda + busca + ações

### Linha 3

Categorias

Isso cria uma sensação de publicação real.

## Mobile

Header compacto com:

- menu;
- logo;
- busca;
- perfil/salvar.

Categorias em faixa horizontal com scroll.

Não esconder a categoria atual dentro de múltiplos menus.

---

# 11. Sistema de cards

O sistema atual possui `Card` + `Badge` + `CardHeader` + `CardFooter`. Isso é útil tecnicamente, mas a V2.0 deve criar uma camada editorial acima desses primitives.

### Componentes propostos

```text
StoryCard
StoryCardCompact
StoryCardHorizontal
HeroStory
BriefingCard
TrendingList
CategoryRail
ArticleMeta
SourceBadge
ReadingTime
SaveButton
ShareButton
NewsletterCard
AdSlot
```

O shadcn/ui continua existindo como camada de primitives.

Não tentar resolver o redesign inteiro alterando apenas o componente `Card`.

---

# 12. Design System técnico

Criar um design system interno do Newra.

## Tokens

```text
colors/
typography/
spacing/
radius/
shadow/
breakpoints/
motion/
z-index/
content-width/
```

> **Onde os tokens vivem neste projeto:** o `apps/web` usa **Tailwind v4** — não
> existe `tailwind.config.js`. Os tokens são variáveis CSS declaradas em
> `@theme inline` dentro de `apps/web/styles/globals.css`, com os valores
> concretos em `@layer base` (`:root` para o claro, `.dark` para o escuro).
> O `styles/tokens.css` proposto na §23 deve ser importado pelo `globals.css` e
> expor cada família via `@theme inline` — é assim que o Tailwind gera as
> utilities (`bg-brand-600`, `text-ink-700`, ...).

## Border radius

Reduzir o uso de cantos arredondados muito grandes.

Proposta:

- cards editoriais: 0–12px;
- inputs: 8px;
- botões: 8px;
- badges: pill;
- áreas editoriais grandes: 0 ou 12px.

O portal deve parecer mais “publicação” e menos “template SaaS”.

## Sombras

Quase nenhuma sombra em conteúdo editorial.

Usar bordas, contraste de superfície e espaçamento como principais mecanismos de separação.

---

# 13. Imagens

O `NewsCard` atual já usa `next/image` e fallback quando não existe imagem. Fonte: https://github.com/tavinholoco/newra-news/blob/main/apps/web/components/news/news-card.tsx.

Na V2.0:

- adotar proporções variadas por componente;
- evitar que todas as imagens sejam 16:9;
- utilizar imagens maiores na notícia principal;
- definir `sizes` específicos por composição;
- usar `priority` apenas para hero/LCP;
- lazy load em conteúdo abaixo da dobra;
- criar tratamento consistente para imagens ausentes;
- aplicar `object-position` conforme tipo de imagem quando necessário.

A estética do portal depende muito da qualidade do recorte das fotos.

---

# 14. Motion design

O projeto atual possui uma animação simples `fade-in-up`. Fonte: `apps/web/styles/globals.css`.

Na V2.0, o movimento deve ser editorial e discreto:

- hover de imagem com scale entre 1.01–1.03;
- underline/weight em links;
- microtransições de filtros;
- skeletons;
- sticky header reduzido ao rolar;
- animações apenas quando agregarem entendimento.

Evitar:

- parallax pesado;
- animação contínua;
- bounce;
- grandes deslocamentos;
- loading teatral.

Adicionar suporte completo a `prefers-reduced-motion`.

---

# 15. Acessibilidade

A V2.0 deve adotar WCAG 2.2 AA como referência mínima.

Checklist técnico:

- contraste mínimo de 4,5:1 para texto normal;
- foco visível;
- navegação completa por teclado;
- landmarks semânticos;
- headings em ordem;
- `alt` útil nas imagens;
- botões com nomes acessíveis;
- estados de loading anunciáveis quando necessário;
- `aria-current` para categoria ativa;
- tamanho de toque confortável no mobile;
- não depender de cor para transmitir informação.

Fonte: https://www.w3.org/TR/WCAG22/.

---

# 16. SEO e descoberta

A base de SEO existente deve ser preservada e aprofundada.

A página de artigo precisa utilizar `NewsArticle` quando adequado, com propriedades como:

- headline;
- image;
- datePublished;
- dateModified;
- author;
- publisher;
- mainEntityOfPage.

O Google documenta que dados estruturados ajudam a compreender melhor páginas de artigos e podem melhorar a apresentação de título, imagem e datas nos resultados. Fontes: https://developers.google.com/search/docs/appearance/structured-data/article e https://developers.google.com/search/docs/appearance/structured-data.

## Também implementar

- canonical URL;
- alternates pt-BR/en;
- Open Graph por artigo;
- Twitter/X card;
- BreadcrumbList;
- sitemap geral;
- sitemap específico de notícias;
- metadados por categoria;
- páginas indexáveis sem depender de estado client-side.

O sitemap de Google Notícias deve conter apenas URLs de artigos recentes dos últimos dois dias, segundo a documentação oficial. Fonte: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap?hl=pt-BR.

---

# 17. Performance

A estética não pode destruir o desempenho.

A meta da V2.0 deve ser:

- LCP < 2,5s;
- INP < 200ms;
- CLS < 0,1;
- imagens otimizadas;
- JavaScript client-side mínimo;
- Server Components por padrão;
- componentes client-side somente quando necessário.

O Google recomenda atingir bons Core Web Vitals como parte de uma boa experiência e para o desempenho em Search. Fonte: https://developers.google.com/search/docs/appearance/core-web-vitals.

## Estratégia

O componente mais importante acima da dobra deve ser server-rendered.

Evitar transformar Home inteira em Client Component por causa de favoritos, filtros ou carrosséis.

---

# 18. Backend: mudanças que devem acompanhar o frontend

Mesmo que a V2.0 tenha foco visual, algumas mudanças de backend serão necessárias para suportar a experiência.

## 18.1 Home editorial

Criar uma resposta agregada para a Home, evitando múltiplas chamadas para cada bloco.

Exemplo conceitual:

```ts
GET /api/home

{
  hero,
  dailyBriefing,
  topStories,
  trending,
  latest,
  categories,
  newsletter
}
```

> Todas as rotas da API são registradas sob o prefixo `/api/*` em
> `apps/api/src/app.ts` — o endpoint agregado é `GET /api/home`, e o mesmo vale
> para `GET /api/news/:id/related` (§18.3) e `GET /api/trending` (§18.2).

Isso reduz complexidade de composição e melhora a previsibilidade do frontend.

## 18.2 Trending

Criar endpoint/consulta para notícias em alta.

Sinal inicial:

```text
score = recency + clicks + saves + shares
```

Não é necessário começar com machine learning.

## 18.3 Related stories

Adicionar endpoint:

```text
GET /news/:id/related
```

## 18.4 Histórico do briefing

O artigo diário deve possuir:

- data de referência;
- data/hora de geração;
- versão do prompt/modelo;
- lista de fontes;
- versão publicada;
- status.

Isso melhora transparência, auditoria e reprocessamento.

> **Ponto de partida real:** o modelo `Article` tem hoje apenas `title`,
> `content`, `summary`, `date` e `newsCount` — nenhum dos campos de auditoria
> acima existe, e não há relação com as notícias que originaram o briefing.
> A migration `add_daily_briefing_metadata` (§37-E) precisa adicionar
> `generatedAt`, `promptVersion`, `modelVersion` e `status`, mais a relação
> `BriefingSource`. `packages/types/src/article.ts` acompanha a mesma migration
> — sem isso o `DailyBriefing` da §24 não tem de onde ser preenchido.

## 18.5 Métricas

Expandir o painel atual para eventos de produto:

- homepage_view;
- story_open;
- briefing_open;
- category_view;
- search;
- article_scroll_25;
- article_scroll_50;
- article_scroll_90;
- favorite_add;
- share;
- newsletter_signup;
- ad_view;
- ad_click;
- subscription_intent.

---

# 19. Personalização futura

O projeto já possui autenticação, favoritos e um painel de métricas (hoje restrito a ADMIN, §23).

Isso abre espaço para uma segunda camada de produto:

### “Seu Newra”

O usuário poderá escolher:

- categorias favoritas;
- temas;
- fontes;
- horário do briefing;
- tipo de alerta.

O relatório Reuters Institute 2026 destaca a importância crescente de consumo intermediado, personalização e novos formatos, além do crescimento do uso de IA para notícias. Fonte: https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary.

Não implementar toda a personalização na primeira entrega da V2.0. Primeiro criar a arquitetura visual que comporte isso.

---

# 20. Newsletter

A newsletter deve deixar de ser apenas uma página funcional e virar uma peça de aquisição.

## CTA na Home

```text
O mundo não cabe no seu feed.
O resumo certo cabe na sua manhã.

Receba o Newra Daily no seu e-mail.

[ seu@email.com ] [ Quero receber ]
```

## Estratégia

A newsletter é particularmente importante porque cria um canal próprio que não depende exclusivamente de busca ou redes sociais.

Pesquisas recentes do setor mostram que publishers seguem tratando newsletters como um instrumento multifuncional de aquisição, retenção e monetização. Fonte: https://digiday.com/media/publisher-strategies-what-forbes-business-insider-the-guardian-and-others-are-focusing-on-in-2025/.

---

# 21. Monetização: estratégia proposta

Não iniciar a V2.0 com paywall agressivo.

O Newra ainda precisa fortalecer sua proposta de valor e provar retenção. O próprio Reuters Institute aponta que o pagamento por notícias continua concentrado em uma faixa relativamente limitada de mercados e que o deslocamento de audiência para plataformas externas dificulta o funil de assinaturas. Fonte: https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary.

## Fase 1: publicidade leve

Implementar poucos espaços de anúncio:

- 1 slot no desktop abaixo do primeiro bloco editorial;
- 1 slot entre grandes seções;
- 1 slot contextual dentro/ao redor do artigo;
- formatos mobile cuidadosamente dimensionados.

Nunca:

- anúncio cobrindo conteúdo;
- pop-up instantâneo;
- excesso de anúncios no topo;
- falso conteúdo patrocinado;
- layout que muda enquanto o usuário lê.

As boas práticas do Google AdSense recomendam organizar o conteúdo pensando no usuário, não sobrecarregar a página e manter anúncios claramente identificados. Fonte: https://support.google.com/adsense/answer/1282097?hl=en.

A própria documentação também reforça que experiência, velocidade e posicionamento afetam a viewability. Fonte: https://support.google.com/adsense/answer/6219980?hl=en.

## Fase 2: Newsletter patrocinada

Possibilidades:

- “Newra Daily apresentado por ...”;
- patrocínio por categoria;
- slots patrocinados claramente marcados.

Isso tende a combinar melhor com uma publicação de nicho do que encher o site de banners.

## Fase 3: Newra Plus

Quando houver base de usuários recorrentes, testar assinatura:

```text
FREE
• notícias
• Daily Brief
• histórico limitado
• newsletter básica

PLUS
• experiência sem anúncios
• briefing premium
• personalização por tema
• newsletters especiais
• alertas personalizados
• áudio do briefing
• histórico completo
```

A intenção inicial deve ser vender **conveniência e personalização**, não simplesmente “acesso a notícias”.

## Fase 4: B2B / API

Em uma fase posterior, o motor de agregação e briefing pode ser transformado em produto:

- API de briefings;
- widgets para sites;
- resumos para empresas;
- newsletter white-label;
- monitoramento por tópico.

Essa pode se tornar uma linha de receita mais escalável que publicidade, mas exige evolução de backend e produto além da V2.0 visual.

---

# 22. Como monetização deve influenciar o design

Isso precisa ser definido **antes** de finalizar o layout.

Exemplo:

```text
Content width
      ↓
Editorial modules
      ↓
Ad slots reservados
      ↓
Newsletter CTA
      ↓
Subscription CTA
```

Não deixar para “colocar Adsense depois”.

O melhor caminho é reservar espaços de anúncio no design system desde a V2.0, mas mantê-los invisíveis quando não existir inventário.

Criar:

```tsx
<AdSlot
  placement="home-after-hero"
  format="leaderboard"
/>
```

Isso evita refatorações futuras.

---

# 23. Arquitetura de componentes da V2.0

## Estrutura proposta

```text
apps/web/
├── app/
│   └── [locale]/
│       ├── page.tsx
│       ├── news/            # + news/[id]/
│       ├── article/         # + article/[date]/
│       ├── favorites/
│       ├── newsletter/      # hoje só newsletter/unsubscribe/ — ver nota abaixo
│       ├── about/
│       ├── signin/          # existe hoje; precisa sobreviver ao redesign
│       └── admin/           # existe hoje (noindex, role ADMIN)
│           └── metrics/     # era /dashboard, público — ver nota abaixo
│
├── components/
│   ├── editorial/
│   │   ├── hero-story.tsx
│   │   ├── briefing-card.tsx
│   │   ├── story-card.tsx
│   │   ├── story-card-horizontal.tsx
│   │   ├── story-card-compact.tsx
│   │   ├── trending-list.tsx
│   │   ├── category-section.tsx
│   │   ├── category-nav.tsx
│   │   ├── reading-time.tsx
│   │   ├── source-list.tsx
│   │   └── related-stories.tsx
│   │
│   ├── layout/
│   │   ├── top-bar.tsx
│   │   ├── masthead.tsx
│   │   ├── editorial-nav.tsx
│   │   ├── footer.tsx
│   │   └── mobile-nav.tsx
│   │
│   ├── monetization/
│   │   ├── ad-slot.tsx
│   │   ├── newsletter-cta.tsx
│   │   └── premium-cta.tsx
│   │
│   └── ui/
│       └── shadcn primitives
│
└── styles/
    ├── globals.css
    └── tokens.css
```

> **Métricas saíram de `/[locale]/dashboard` (20/08/2026).** A rota era pública
> e indexada. É métrica de **pipeline** — volume coletado, provider de IA,
> duração da execução, dias com falha — ou seja, operação do projeto, não
> conteúdo editorial. Passou para `/[locale]/admin/metrics`, atrás do mesmo
> guard do painel admin, que agora vive em `admin/layout.tsx` e vale para todo
> o segmento. `GET /api/metrics/dashboard` também passou a exigir JWT com role
> ADMIN: esconder só a página deixaria o dado a um `curl` de distância. A URL
> antiga responde 308. Sai da §28 Fase 6 e do sitemap.

> **Landing de newsletter:** hoje não existe `/[locale]/newsletter` — a
> newsletter é o `SubscribeForm` no rodapé mais a página
> `/[locale]/newsletter/unsubscribe`. A §20 trata a newsletter como peça de
> aquisição, o que exige uma landing própria; ela entra como entregável da
> **Fase 2 — Shell** (§28) e como rota da baseline visual (§30).

> **Tailwind v4:** `styles/tokens.css` não substitui a configuração — ele é
> importado por `globals.css` e expõe os tokens via `@theme inline`. Ver §12.

---

# 24. Data contract para o frontend

Criar tipos explícitos para o modelo editorial.

```ts
interface EditorialStory {
  id: string;
  title: string;
  dek?: string;
  imageUrl?: string;
  category: Category; // enum de packages/types/src/news.ts
  source: string;
  publishedAt: string;
  updatedAt?: string;
  readingTimeMinutes?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
}

interface DailyBriefing {
  id: string;
  date: string;
  title: string;
  summary: string;
  sourceCount: number;
  readingTimeMinutes: number;
  generatedAt: string;
  aiDisclosure: boolean;
  sources: BriefingSource[];
}
```

O objetivo é permitir que o frontend seja orientado por composição editorial, e não por campos genéricos de card.

---

# 25. Fluxos principais de usuário

## Fluxo 1: visitante

```text
Home
→ Hero
→ Daily Brief
→ categoria
→ artigo
→ relacionado
→ newsletter
```

## Fluxo 2: leitor recorrente

```text
Home
→ Top Stories
→ salvar
→ voltar
→ favoritos
```

## Fluxo 3: usuário de newsletter

```text
Landing/Home
→ cadastro
→ confirmação
→ recebimento diário
→ retorno ao site
```

## Fluxo 4: usuário Premium futuro

```text
Home
→ Plus
→ checkout
→ perfil
→ preferências
→ briefing personalizado
```

---

# 26. Métricas de sucesso da V2.0

A V2.0 não deve ser avaliada apenas por “ficou bonito”.

## Produto

- CTR do hero;
- CTR do Daily Brief;
- profundidade de scroll;
- artigos por sessão;
- saves por usuário;
- sessões recorrentes;
- newsletter signup rate;
- share rate.

## Técnica

- Lighthouse;
- Core Web Vitals;
- error rate;
- API latency;
- image transfer size;
- cache hit rate.

> **Piso, não meta.** A V1 já entrega **Performance 96 · Acessibilidade 96 ·
> Best Practices 96 · SEO 100** em produção, e o `.lighthouserc.json` falha o
> workflow abaixo de 90 em qualquer categoria. Um redesign que entregue 91 é
> uma regressão, não um sucesso. O critério de aceite da V2.0 é **manter ou
> superar 96/96/96/100**; se a Fase 3 baixar esse número, o problema é o
> layout, não o threshold.

## Monetização

- revenue per session;
- viewability;
- CTR de anúncios;
- newsletter sponsorship CTR;
- premium conversion;
- churn;
- ARPU.

---

# 27. Analytics recomendado

Implementar uma camada de eventos desacoplada.

```ts
analytics.track('story_open', {
  storyId,
  category,
  position,
  source,
});
```

Eventos devem ser centralizados em uma função/serviço único para evitar analytics espalhado pelo JSX.

Idealmente, manter anonimização e retenção de dados compatíveis com LGPD.

---

# 28. Plano de implementação

## Fase 0 — Discovery técnico

Objetivo: preparar terreno antes do redesign.

```text
[x] mapear todas as rotas públicas                          (docs/v2/00 §1.1)
[x] mapear todos os componentes atuais                      (docs/v2/00 §1.2)
[x] documentar contrato das APIs                            (docs/v2/00 §1.3)
[x] medir Lighthouse atual                                  (docs/v2/00 §3.1)
[x] registrar Core Web Vitals atuais                        (docs/v2/00 §3.2)
[x] registrar métricas atuais de uso                        (docs/v2/00 §3.5)
[x] definir design tokens V2                                (docs/v2/01)
[x] criar sitemap de telas                                  (docs/v2/02)

    -- pré-requisitos de infraestrutura (auditoria §40) --
[x] remover migrations do .gitignore                        (§37-A)
[x] gerar a migration de baseline 0_init                    (§37-G)
[x] criar o job de deploy de migrations                     (§37-C)
[x] escolher licença e adicionar LICENSE                    (§36-H)
[x] rodar `migrate resolve --applied 0_init` no Neon        (§37-G)
[x] cadastrar o secret DATABASE_URL no GitHub               (§37-C)
[x] receber e vetorizar o asset de logo                     (§40.3)
[x] decidir o lockup: wordmark tipográfico                  (§40.3)
[x] mapear todos os usos de brand-400 e brand-900 no web    (§4.1 — 13 usos)

    -- entregues além do checklist original --
[x] escolher a tipografia: Newsreader + Inter               (§5, docs/v2/01 §7)
[x] contrato de GET /api/home, /trending, /:id/related      (§35, docs/v2/03)
[x] catálogo de eventos de analytics                        (§35, docs/v2/04)
[x] inventário de slots de anúncio                          (§35, docs/v2/04)
[x] capturar a baseline visual da V1                        (§30, docs/v2/baseline-v1/)
```

**Entrega:** diagnóstico técnico + design tokens → **`docs/v2/`** (concluída em
20/08/2026).

> **Três correções que a Fase 0 fez no próprio plano**, todas por medição:
> (1) o piso "96·96·96·100" da §26 era da home apenas — duas rotas já estavam
> abaixo, e o critério de aceite passa a ser a tabela por rota do diagnóstico;
> (2) `brand-600` não passa AA para texto normal sobre `paper`, só sobre branco
> puro — links usam `brand-700`; (3) a paleta da §4.1 não cobre a camada
> semântica do shadcn (31 variáveis), e 8 delas são código morto.
>
> A verificação também encontrou dois defeitos de infraestrutura que a §40 dava
> como resolvidos: a migration `0_init` não replicava em banco limpo (banner do
> CLI do Prisma colado no SQL) e faltava o `migration_lock.toml`. Corrigidos.

## Fase 0.5 — Backend editorial

Objetivo: entregar os dados que as Fases 3–5 consomem. **Nenhuma fase do
frontend produz isso** — as Fases 1 e 2 são 100% de interface, e a Fase 3 abre
com `HeroStory`, `DailyBrief` e `TrendingList`, que dependem de endpoints
inexistentes. Contratos fechados em `docs/v2/03-contratos-api.md`.

```text
    -- antes da Fase 1: o dado só é capturado daqui para frente --
[x] migration add_daily_briefing_metadata                   (§18.4, §37-E)
[x] pipeline gravando generatedAt/promptVersion/modelVersion/status
[x] pipeline gravando BriefingSource (lista de fontes do dia)
[x] tipos compartilhados + docs/api.md

    -- durante as Fases 1–2, em branch própria; mergeado antes da Fase 3 --
[ ] GET /api/home            (agregado da Home — §18.1)
[ ] GET /api/trending        (etapa 1: recência + favoritos — §18.2)
[ ] GET /api/news/:id/related                              (§18.3)
```

> **Por que a migration saiu antes da Fase 1.** Nada registrava quais notícias
> entravam no briefing — o Stage 5 logava só a contagem — e o cleanup apaga
> `News` e `PipelineLog` aos 30 dias, enquanto `Article` vive 90. Cada dia sem a
> migration era um briefing permanentemente sem lista de fontes, sem backfill
> possível. A Fase 5 exibe transparência de IA sobre esse histórico.

> **Por que o resto não é "paralelo".** Backend (`apps/api`) e frontend
> (`apps/web`) não conflitam em arquivo, então a branch pode correr junto das
> Fases 1–2 — mas é **pré-requisito**, não trabalho concorrente: a Fase 3 não
> abre antes dela estar mergeada.

## Fase 1 — Foundation ✅ 20/08/2026 — branch `feat/v2-design-foundation`

```text
[x] nova paleta                     (styles/tokens.css, duas camadas)
[x] tipografia                      (Newsreader + Inter)
[x] spacing                         (--spacing-section|block|gutter)
[x] grid                            (container-editorial + larguras de coluna)
[x] breakpoints                     (padrões do Tailwind v4 — as larguras da
                                     §30 são pontos de verificação, não @media)
[x] typography scale                (text-display … text-overline)
[x] buttons                         (radius 8px, --primary = brand-700)
[x] badges                          (pill; o override de cor sumiu)
[x] article metadata                (components/editorial/article-meta)
[x] card primitives                 (ring --line, sem hover lift)

    -- fica em aberto, sem bloquear a Fase 2 --
[ ] Lighthouse por rota contra a tabela do 00-diagnostico.md §3.1
[ ] baseline visual da V2 (docs/v2/baseline-v2/)
```

> Detalhe do que a fase encontrou no caminho — as renomeações forçadas pelo
> namespace do Tailwind v4 e o par de erro que reprovava sobre o rodapé — em
> `docs/v2/01-design-tokens.md` §11.

## Fase 2 — Shell ✅ 20/08/2026 — branch `feat/v2-header`

```text
[x] top bar                         (data, edição, newsletter, idioma, tema, entrar)
[x] masthead                        (marca inline + wordmark tipográfico — §40.3)
[x] category navigation             (= `editorial-nav`, a linha 3 do masthead
                                     da §10. NÃO é o `category-nav` da Fase 4,
                                     que é o filtro do acervo em /news)
[x] mobile header                   (wordmark some, marca fica)
[x] footer                          (ritmo dos tokens: container-editorial + py-section)
[x] newsletter block                (monetization/newsletter-cta)
[x] landing /[locale]/newsletter    (§23 — entrou no sitemap)
[x] /[locale]/about                 (medida de 68ch + escala nomeada)
[x] /[locale]/newsletter/unsubscribe (ritmo dos tokens; os 2 estados)

    -- derivados do vetor da marca, que a §40.3 pede nesta fase --
[x] app/icon.svg                    (com safe area — o viewBox justo cola na borda a 16px)
[x] app/apple-icon.tsx              (180×180; `.tsx` e não PNG versionado)
[x] opengraph-image                 (era gradiente slate #0f172a, fora da marca)

    -- ao fechar a fase --
[x] reavaliar o lockup desenhado agora que a tipografia está fixa (§40.3-B)
    → fica o tipográfico; o lockup medido já dá 5,41:1, praticamente a
      proporção que B perseguia. Medições em §40.3
[x] recapturar a baseline visual (§30) — 42 capturas, 12 rotas
```

> **A faixa de categorias exigiu uma URL.** `editorial-nav` aparece em todas as
> telas e precisa levar a algum lugar; as categorias eram estado local do
> `/news`. Passaram a `…/news?category=X`, que dá para compartilhar e o
> buscador enxerga. O `/news` **lê** o parâmetro; **escrever** a URL a cada
> clique de filtro e de página continua sendo o "filter state" da Fase 4.

## Fase 3 — Home ✅ 21/08/2026 — branch `feat/v2-home`

```text
[x] HeroStory                       (imagem `priority` — é o LCP; sem indicador
                                     "Atualizado", ver nota abaixo)
[x] DailyBrief                      (= `briefing-card`: superfície própria,
                                     selo, contagem de fontes e a linha de
                                     transparência de IA da §8)
[x] TopStories                      (coluna ao lado do hero)
[x] TrendingList                    (ranking; numeral `aria-hidden`, a posição
                                     é semântica pelo `<ol>`)
[x] CategorySections                (lead + lista; "ver tudo" em
                                     /news?category=X, a URL da Fase 2)
[x] AdSlot                          (as 2 posições da Home; sem inventário não
                                     renderiza nada — §8 dos slots)
[x] responsive layouts              (duas faixas de 3 colunas que colapsam;
                                     mobile em coluna, sem overflow em 375px)

    -- a camada de cards da §11, que os blocos acima consomem --
[x] story-card / -horizontal / -compact
[x] story-image                     (placeholder de marca num lugar só)
[x] section-heading                 (filete + título + "ver tudo")
[x] latest-stories                  (a grade cronológica de "mais notícias")

    -- ao fechar a fase --
[x] Lighthouse por rota contra produção (§26) — 21/08, ver tabela abaixo
[x] recapturar a baseline visual (§30) — e foi ela que achou o hero sem clamp
```

### Medição de 21/08 ([run 32477242736](https://github.com/tavinholoco/newra-news/actions/runs/32477242736))

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 78 · 86 · 94 | **100** | 100 | 100 |
| `/pt-BR/news` | 95 | **100** | 100 | 100 |
| `/pt-BR/article` | 95 | **100** | 100 | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 85 · 94 · 95 | 100 | 100 | 100 |

**Acessibilidade 100 nas cinco rotas, zero auditorias reprovando.** É o alvo da
fase, atingido. Mas a atribuição precisa ficar certa: o `heading-order` que
sobrava em `/news` e `/article` era o `h3` "NAVEGAÇÃO" do rodapé, e ele virou
`h2` no commit `523ee90` — **da Fase 2**, uma hora depois da medição de 20/08.
Esta é só a primeira medição depois de aquilo chegar em produção; a Fase 3 não
o corrigiu.

**Performance da home caiu.** A linha da home traz as três execuções porque a
variação foi grande demais para um número só, e porque o resumo do workflow
publica a "execução representativa" — que o lhci escolhe pela mediana de FCP e
interactive, não do score — e por isso estampou 78. Somando `/en`, que é a mesma
página, a mediana real é ~90, contra 97 da V1 (§3.1 do diagnóstico).

A causa foi achada e corrigida: **o `dek` do hero não tinha clamp**. Com 1.876
caracteres em produção, o parágrafo ocupava 704px e 519.618 px² — área maior que
a imagem do hero (350.815 px²) —, o que fazia dele o **elemento de LCP** da
página, medido em 2,8–3,9s. Um bloco de texto que ninguém pré-carrega. Todos os
outros cards já clampavam; o hero era o único que não.

> **O gate do Lighthouse nunca tinha rodado.** A execução de 21/08 passou com a
> home em 78, doze pontos abaixo do piso de 90 que o `.lighthouserc.json`
> define. A action só executa `lhci assert` quando recebe `configPath` ou
> `budgetPath`; ela lê o rc para as URLs do collect de qualquer jeito, e é por
> isso que a configuração parecia ligada. O log tem "Collecting" e "Uploading" e
> nenhum "Asserting". Corrigido junto do clamp.

> **Uma chamada de rede, não seis.** A Home consome só `GET /api/home`, e é o
> servidor que garante que nenhuma matéria aparece em dois blocos. A Home da V1
> fazia duas chamadas para montar bem menos página.
>
> **Todo bloco se omite sozinho.** Hero sem imagem no acervo, briefing antes de
> o pipeline do dia rodar, trending sem publicação nas últimas 24h, categoria
> sem matéria: os quatro são estados normais. Quando os dois lados de uma faixa
> faltam, o wrapper também sai — um grid vazio tem altura zero mas ainda consome
> o `gap-section` do pai, e o buraco no meio da página não tem explicação para
> quem olha.
>
> **O `h1` da Home é `sr-only`.** Quem abre a página vê a manchete do dia, não a
> palavra "Home", mas quem navega por heading precisa de uma raiz de outline —
> sem ela a página abriria direto num `h2`. **Não é o Lighthouse que pede
> isto**, ao contrário do que a primeira redação desta seção dizia: o
> `heading-order` reprova salto de nível, não ausência de `h1`, e
> `page-has-heading-one` não está no conjunto auditado.
>
> **Sem o indicador "Atualizado" que a §6.2 previa como opcional.** O `updatedAt`
> do contrato é o `@updatedAt` do Prisma: muda quando o pipeline reclassifica a
> categoria, não quando alguém revisa o texto. Rotular isso como "atualizado"
> mentiria em praticamente toda matéria.
>
> **A revisão da fase achou um defeito de Fase 1 que só a Home tornou visível.**
> O `cn` usa `tailwind-merge`, que resolve `text-<valor>` por heurística: um
> tamanho nomeado (`text-meta`) e uma cor nomeada (`text-ink-muted`) caíam no
> mesmo grupo, e a última classe apagava a primeira. A linha de metadata dos
> cards vinha renderizando em `--ink` cheio desde a Fase 1 — passava no
> contraste (17:1), então o Lighthouse nunca reclamou; o que se perdia era a
> hierarquia, exatamente o problema que a §2.2 aponta na V1. Corrigido em
> `lib/utils.ts`, declarando a escala tipográfica como `font-size` para o
> `tailwind-merge`, com `tests/lib/cn.test.ts` de guarda.

## Fase 4 — News / Category ✅ 21/08/2026 — branch `feat/v2-news-category`

```text
[x] category landing   (título + descrição curta por categoria — §7)
[x] search UI          (URL, histórico local, vazio útil, destaque do termo)
[x] filter state       (a URL passa a ser escrita, não só lida)
[x] pagination         (numerada, na URL — não "carregar mais")
[x] empty states       (três, e cada um com a saída que cabe)
[x] skeletons          (com a forma da tela que antecedem)

    -- o que a §7 pede e o §28 não listava --
[x] category-nav com contagem       (a ficha da tela em docs/v2/02 §, não o §28)
[x] filtro de fonte                 (a lista vem das facetas, não de constante)
[x] filtro de período               (rótulo na URL, data derivada na consulta)
[x] ordenação                       (recent | oldest)

    -- fica para a Fase 6, com o resto do ecossistema de conta --
[ ] "somente salvos"                (§7 — junta Favorite e News, resposta por
                                     usuário, e portanto sem cache de CDN)

    -- ao fechar a fase, contra produção --
[ ] Lighthouse por rota (§26)
[ ] recapturar a baseline visual (§30)
```

> **A contagem exigiu um endpoint.** O `category-nav` mostra quantas matérias
> cada categoria tem, e nada expunha isso — o frontend teria de disparar oito
> requisições para desenhar oito pílulas. `GET /api/news/facets` é **aditivo**:
> a forma do `GET /api/news` que a admin e os favoritos consomem não mudou.
> Cada faceta ignora a própria dimensão, senão a categoria escolhida mostraria
> o seu número e as outras sete zerariam — perdendo justamente a informação que
> faz alguém trocar de categoria.

> **A URL passou a ser escrita.** Era a dívida que a Fase 2 registrou ao criar
> `…/news?category=X`: a tela **lia** o parâmetro, mas clicar num filtro mudava
> `useState` e a URL passava a mentir. Agora não há segunda cópia do estado.
> Escolha escreve com `push`, para o botão Voltar funcionar; a busca, debounced,
> escreve com `replace` — senão "copa do mundo" deixaria quatro entradas de
> histórico.

> **Nada nesta fase desenha um card.** A lista compõe `hero-story` e
> `story-card-horizontal`, os mesmos da Home. Eles ganharam duas props
> opcionais: o termo a destacar, e um slot de ação — que é como a listagem
> manteve o botão de favoritar da V1 sem aninhar `<button>` dentro da âncora do
> card.

> **Quatro defeitos vieram da revisão da própria fase**, três contra o app
> rodando e um pelo teste. O maior: a pílula "Todas" mostrava `facets.total`,
> que já aplica o filtro de categoria — com Mundo selecionado ela lia 594 e
> depois abria 2.373. Cada pílula promete o que o próprio clique devolve.
> Detalhe em `docs/progress.md`, item 19.

## Fase 5 — Article

```text
[ ] article hero
[ ] body typography
[ ] source list
[ ] AI disclosure
[ ] share/save
[ ] related stories
[ ] newsletter CTA
```

## Fase 6 — Account ecosystem

```text
[ ] favorites
[ ] profile
[ ] preferences
[ ] newsletter settings
```

## Fase 7 — SEO/performance/accessibility

```text
[ ] NewsArticle JSON-LD
[ ] BreadcrumbList
[ ] news sitemap
[ ] canonical
[ ] metadata
[ ] image audit
[ ] keyboard audit
[ ] contrast audit
[ ] screen reader audit
[ ] Core Web Vitals audit
```

## Fase 8 — Monetização

```text
[ ] AdSlot abstraction
[ ] reserved inventory
[ ] privacy/consent layer
[ ] newsletter sponsorship placement
[ ] pricing experiment framework
```

## Fase 9 — Release

```text
[ ] visual regression
[ ] mobile QA
[ ] desktop QA
[ ] Lighthouse CI
[ ] E2E smoke tests
[ ] SEO validation
[ ] analytics validation
[ ] production canary
```

---

# 29. Estratégia de Git e engenharia

Para uma mudança tão grande, evitar um único PR gigantesco.

Sugestão:

```text
feat/v2-editorial-api        # Fase 0.5 — precede feat/v2-home
feat/v2-design-foundation
feat/v2-header
feat/v2-home
feat/v2-news
feat/v2-article
feat/v2-monetization
feat/v2-seo
feat/v2-analytics
```

A primeira é a única de backend. Ela existe porque a lista original era toda de
frontend e nenhuma fase da §28 comportava `GET /api/home`, `/api/trending` e
`/api/news/:id/related` — que a Fase 3 consome. Pode correr em paralelo às
branches de foundation e header (apps diferentes, sem conflito de arquivo), mas
precisa estar mergeada antes de `feat/v2-home` começar.

Cada feature deve ter:

- objetivo;
- screenshots;
- testes;
- checklist de acessibilidade;
- impacto de performance;
- eventual alteração de API.

Como o repositório já possui CI/CD com lint, testes e Lighthouse, a V2.0 deve aproveitar esse mecanismo em vez de tratar QA visual como etapa manual. Fonte: README do repositório.

---

# 30. Testes visuais

Criar baseline para:

- 375px;
- 768px;
- 1024px;
- 1440px;
- 1920px.

Rotas mínimas:

```text
/pt-BR
/pt-BR/news
/pt-BR/news/[id]
/pt-BR/article
/pt-BR/article/[date]
/pt-BR/favorites
/pt-BR/signin
/pt-BR/about
/pt-BR/newsletter          # só depois que a landing da Fase 2 existir
/en
```

Todas essas rotas existem hoje, com uma exceção: `/pt-BR/newsletter` só entra na baseline depois que a landing for entregue na Fase 2 (§23). `/pt-BR/admin` e `/pt-BR/admin/metrics` ficam fora — são `noindex`, exigem role ADMIN e `force-dynamic`, o que as torna instáveis como referência visual. As métricas estavam nesta lista como `/pt-BR/dashboard` até 20/08/2026, quando deixaram de ser públicas (§23).

Executar visual regression após cada etapa relevante.

---

# 31. Critérios de aceite da V2.0

## Visual

- [ ] Newra possui identidade editorial própria.
- [ ] Laranja está presente sem dominar a interface.
- [ ] Home tem hierarquia clara de importância.
- [ ] Hero é visualmente dominante.
- [ ] Daily Brief é reconhecido como principal diferencial.
- [ ] Desktop não parece uma grade de cards SaaS.
- [ ] Mobile mantém hierarquia sem virar uma versão empobrecida do desktop.

## UX

- [ ] usuário encontra categorias em até uma interação;
- [ ] busca está visível;
- [ ] artigo pode ser salvo/compartilhado;
- [ ] fontes são fáceis de localizar;
- [ ] AI disclosure é claro;
- [ ] navegação por teclado funciona.

## Performance

- [ ] LCP alvo < 2,5s;
- [ ] INP alvo < 200ms;
- [ ] CLS alvo < 0,1;
- [ ] imagens acima da dobra otimizadas;
- [ ] JavaScript client-side minimizado.

## Monetização

- [ ] Ad slots não quebram o layout;
- [ ] anúncios são claramente identificados;
- [ ] newsletter tem CTA consistente;
- [ ] áreas premium futuras já têm espaço conceitual.

---

# 32. Riscos

## Risco 1: copiar demais o Behance

Mitigação: extrair princípios editoriais, não componentes visuais específicos.

## Risco 2: exagerar no laranja

Mitigação: laranja como sinal, neutros como estrutura.

## Risco 3: transformar tudo em client-side

Mitigação: Server Components por padrão.

## Risco 4: monetização prejudicar UX

Mitigação: criar `AdSlot` como componente arquitetural desde a V2.0 e limitar inventário.

## Risco 5: IA reduzir confiança

Mitigação: transparência de fontes, processo de geração e timestamps.

## Risco 6: visual bonito, produto sem retenção

Mitigação: medir saves, retorno, newsletter e profundidade de leitura antes de concluir que o redesign funcionou.

---

# 33. O que não fazer

Não fazer:

- fundo laranja em grandes áreas o tempo inteiro;
- cartões gigantes arredondados em todas as seções;
- gradientes laranja/amarelo em toda a interface;
- 3 colunas idênticas para tudo;
- anúncios antes do conteúdo principal;
- paywall na primeira versão do redesign;
- autoplay de vídeo;
- excesso de animação;
- texto pequeno para caber mais notícias;
- depender de cores para comunicar categoria;
- esconder busca em três níveis de menu.

---

# 34. Direção final recomendada

A transformação central do Newra News deve ser esta:

```text
V1
Feed de notícias
        ↓
V2
Publicação digital de notícias
        ↓
V3
Plataforma personalizada de inteligência editorial
```

A V2.0 deve concentrar energia em cinco pilares:

1. **Editorial grid** — a Home precisa contar uma história visual.
2. **Daily Brief como produto** — a geração por IA precisa ser claramente diferenciada.
3. **Reading experience** — artigo confortável, confiável e transparente.
4. **Own-audience** — newsletter, contas, favoritos e retorno direto.
5. **Monetization-ready** — anúncios e premium projetados desde a arquitetura, não enxertados depois.

O resultado ideal não é um “Newra mais colorido”. É um **Newra mais confiável, mais editorial, mais memorável e mais preparado para crescer**.

---

# 35. Prioridade prática

### Antes de escrever o novo frontend

```text
1. Fechar design tokens
2. Fechar sitemap de telas
3. Fechar wireframes desktop/mobile
4. Definir API agregada da Home
5. Definir eventos de analytics
6. Definir slots de monetização
7. Implementar foundation
```

### Depois

```text
8. Header + navigation
9. Home
10. Article
11. Category/Search
12. Account/Favorites
13. Newsletter
14. SEO
15. Performance
16. Ads
```

### Somente depois

```text
17. Premium
18. Personalização avançada
19. Audio briefing
20. B2B/API
```

---

# 36. README profissional (padrão open source)

Pesquisas recentes sobre boas práticas de README convergem para uma sequência parecida: nome do projeto e descrição de uma linha, um recurso visual mostrando o produto em funcionamento, um resumo curto de "por que existe", instalação, um exemplo rápido de uso, uso/configuração mais detalhada, como contribuir e por fim licença/créditos — nessa ordem de urgência decrescente, porque quem lê escaneia de cima para baixo e abandona assim que perde o fio. Fonte: https://repoclip.io/blog/how-to-write-a-github-readme.

O README atual do Newra News já cobre boa parte disso — funcionalidades, screenshots, stack, quick start, scripts, pipeline diário, estrutura de pastas e documentação — mas pode ganhar mais força seguindo os pontos abaixo.

### A. Ordem e hierarquia das seções

Reorganizar o topo do documento para deixar a proposta de valor visível antes de qualquer detalhe técnico: nome + tagline, recurso visual, "por que existe", só então funcionalidades e stack.

### B. Badges funcionais, não decorativos

Guias atualizados recomendam usar apenas selos que respondem a uma pergunta real de quem avalia o projeto — status do build, versão, licença, cobertura de testes — evitando empilhar badges decorativos que diluem o sinal. Fonte: https://pushpen.dev/blog/github-readme-best-practices-2026.

Sugestão para o Newra (ajustar nomes de workflow reais antes de publicar):

```text
[build] [license] [node version] [coverage]
```

**Aplicado em 19/08/2026.** O workflow real é `ci.yml`, então o badge de build passou a apontar para ele. Dois valores estavam errados no rascunho e foram corrigidos contra o repositório: o badge de Node dizia `>=18`, mas o `package.json` exige `>=22.0.0`, o CI usa Node 22 e o Render fixa `NODE_VERSION 22.12.0`; e o badge de licença virou MIT com o arquivo `LICENSE` na raiz.

### C. Seção "Por que o Newra existe"

Um parágrafo curto logo no topo, antes de "Funcionalidades", explicando o problema que o produto resolve (organizar o excesso de notícias do dia em uma leitura confiável). Isso é especialmente útil para quem chega ao repositório vindo de um currículo ou portfólio.

### D. Diagrama de arquitetura em Mermaid

O GitHub renderiza blocos Mermaid nativamente em qualquer `.md`, sem precisar de plugin externo — vale usar isso para mostrar visualmente o pipeline (coleta → dedupe → geração IA → publicação) logo abaixo da seção de funcionalidades, complementando o texto que já existe. Fonte: https://gingiris.github.io/growth-tools/blog/2026/04/02/github-readme-template-guide/.

### E. Seção Roadmap ligada a este plano

Adicionar uma seção curta "🗺️ Roadmap" linkando para este documento (ou uma versão resumida em `docs/roadmap.md`), para deixar claro que o projeto está em evolução ativa — reforça a seção "Produção" que já existe.

### F. CONTRIBUTING.md separado

Mover instruções de contribuição (fork, branch, testes, PR) para um `CONTRIBUTING.md` dedicado e deixar no README apenas um link curto. Isso mantém o documento principal focado no público majoritário — quem só quer entender e rodar o projeto — sem misturar instrução de uso com instrução de contribuição. Fonte: https://pushpen.dev/blog/github-readme-best-practices-2026.

### G. Evitar "doc drift"

O maior risco de um README não é nascer incompleto, é ficar desatualizado conforme o código muda — isso é apontado como a prática mais negligenciada em READMEs de 2026. Fonte: https://pushpen.dev/blog/github-readme-best-practices-2026.

Sugestão prática: adicionar ao checklist de PR (seção 29) um item "README/docs atualizados?" sempre que uma mudança afetar comandos, variáveis de ambiente ou estrutura de pastas.

### H. Estrutura final sugerida

```text
1. Nome + tagline + badges
2. GIF/screenshot do produto rodando
3. Por que o Newra existe (2-3 frases)          — novo
4. Funcionalidades (já existe)
5. Arquitetura (diagrama Mermaid)                — novo
6. Stack (já existe)
7. Quick Start (já existe)
8. Scripts (já existe)
9. Pipeline diário (já existe)
10. Estrutura de pastas (já existe)
11. Documentação (já existe)
12. Roadmap                                      — novo
13. Contributing (link para CONTRIBUTING.md)     — novo
14. Produção (já existe)
15. Licença                                      — novo, se ainda não existir
```

**Entregável desta seção:** um `README.md` revisado, já seguindo essa ordem, entregue como arquivo separado deste plano.

**Status em 19/08/2026 — concluído.** `README.md` reescrito nessa ordem (com links relativos, que sobrevivem a forks e branches, em vez de URLs absolutas para `github.com/tavinholoco`); `CONTRIBUTING.md` criado com branches, Conventional Commits, convenções de código, testes, fluxo de migrations e checklist de PR — incluindo o item "README/docs atualizados?" da §36-G; `LICENSE` (MIT) adicionado na raiz. O diagrama Mermaid da §36-D usa `<br/>` para quebra de linha dentro dos nós: o `\n` do rascunho é renderizado literalmente pelo GitHub.

---

# 37. Estratégia de migrations do banco de dados

O projeto já usa Prisma Migrate (`pnpm db:migrate`) sobre PostgreSQL, então a V2.0 não precisa adotar uma ferramenta nova — precisa de uma estratégia explícita para as mudanças de schema que os itens da seção 18 exigem (Home agregada, trending, related stories, histórico de briefing, métricas de produto).

### A. Regra central: schema muda → migration nova, nunca edição manual

**Pré-condição resolvida em 19/08/2026:** até então o `.gitignore` ignorava `packages/database/prisma/migrations/*`, e a pasta continha apenas um `.gitkeep` — não havia histórico de migrations versionado, o que tornava esta seção inteira inexequível. As linhas foram removidas do `.gitignore` e as migrations passaram a ser versionadas.

Alterações devem sempre passar por `schema.prisma` seguido de uma migration gerada, nunca por alteração direta no banco. Quando o banco precisar ser alterado manualmente por algum motivo excepcional, o schema deve ser sincronizado via introspecção e uma migration formal criada logo em seguida, para manter o histórico de migrations como fonte única de verdade. Fonte: https://github.com/prisma/prisma/discussions/24571.

### B. Fluxo local (desenvolvimento)

```bash
# 1. editar packages/database/prisma/schema.prisma
# 2. gerar e aplicar localmente
#    o `--` é obrigatório: o script raiz é `turbo db:migrate`, e sem ele o
#    turbo consome o --name em vez de repassá-lo ao Prisma
pnpm db:migrate -- --name add_briefing_metadata
# 3. revisar o SQL gerado em packages/database/prisma/migrations/ antes de commitar
```

### C. Fluxo de deploy (staging/produção)

`migrate deploy` deve rodar dentro do pipeline de CI/CD, nunca localmente contra o banco de produção — a própria documentação do Prisma desaconselha essa prática, inclusive porque manter a URL de produção configurada localmente não é uma boa prática de segurança. Fonte: https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate.

Como o repositório já tem GitHub Actions configurado (lint, testes, Lighthouse), o caminho natural é adicionar um step de `prisma migrate deploy` ao job de deploy, condicionado a merges em `main` — nunca rodando a cada PR.

**Estado em 19/08/2026 — resolvido.** Não existia job de deploy: Render e Vercel deployam sozinhos ao observar a `main`, e o `ci.yml` só faz lint/typecheck/test/build. Foi criado o workflow dedicado `.github/workflows/migrate.yml`, disparado em push na `main` quando `schema.prisma` ou `migrations/**` mudam (mais `workflow_dispatch`), rodando `migrate status` seguido de `migrate deploy` com `concurrency` para serializar execuções. Ele é um no-op explícito enquanto o secret `DATABASE_URL` não existir no repositório — o que dá a ordem segura: **baseline primeiro (§37-G), secret depois**.

O `render.yaml` foi deixado intacto de propósito: aplicar migrations dentro do build da aplicação mistura deploy de código com deploy de schema e roda uma vez por instância.

### D. Nomenclatura das migrations

Uma migration por mudança lógica, nome descritivo no imperativo:

```text
add_daily_briefing_metadata
add_briefing_sources_relation
add_trending_score_fields
add_product_metrics_events
add_related_stories_cache
```

### E. Migrations que a V2.0 provavelmente vai exigir

Mapeando direto para a seção 18 deste plano:

| Mudança de produto (seção 18) | Migration correspondente |
|---|---|
| Histórico do briefing (18.4) | ✅ `add_daily_briefing_metadata` (20/08/2026) — `generatedAt`, `promptVersion`, `modelVersion`, `status` e a tabela `BriefingSource` |
| Trending (18.2) | coluna/tabela de score, ou view materializada `trending_score` |
| Related stories (18.3) | índice por categoria + data para consulta rápida, ou tabela de cache |
| Métricas de produto (18.5) | tabela `product_events` cobrindo os 13 eventos já listados |
| Personalização futura (19) | tabela `user_preferences` (categorias, tema, horário do briefing) — pode ficar só planejada nesta fase |

### F. Mudanças que quebram compatibilidade: expand and contract

Para colunas que mudam de tipo ou de obrigatoriedade, o caminho mais seguro é o padrão "expand and contract": adicionar a coluna nova em paralelo à antiga, migrar os dados existentes, e só então remover a antiga em uma migration separada. Isso evita downtime e permite reverter no meio do caminho caso algo dê errado. Fonte: https://pocketcmds.com/skills/prisma/prisma-migration-workflow.

### G. Segurança e rollback

- rodar `prisma migrate status` antes de `migrate deploy` no CI, para detectar drift antes de aplicar qualquer coisa;
- confiar no advisory lock nativo do Prisma Migrate para evitar que dois deploys simultâneos apliquem migrations em paralelo;
- se o banco de produção já existir sem histórico de migrations completo, fazer o baseline antes da primeira migration da V2.0, em vez de tentar recriar o schema do zero.

**Estado em 19/08/2026 — o baseline não é hipótese, é obrigatório.** O banco de produção no Neon foi construído com `prisma db push` (16/08, criando `User`/`Favorite`/`Subscriber`/`NewsletterLog`/`PipelineEvent`) e `prisma db push --accept-data-loss` (17/08, constraint única em `News.sourceUrl`). Ele tem o schema certo e nenhum histórico de migrations.

O primeiro passo já foi executado: as migrations saíram do `.gitignore` e a migration de baseline `0_init` foi gerada a partir do schema atual, sem tocar em banco nenhum:

```bash
pnpm --filter @newranews/database exec prisma migrate diff \
  --from-empty --to-schema-datamodel prisma/schema.prisma --script \
  > packages/database/prisma/migrations/0_init/migration.sql
```

Falta o passo que exige a URL de produção — marcar `0_init` como já aplicada, para o Prisma não tentar recriar tabelas que já existem:

```bash
DATABASE_URL="<url do Neon>" pnpm --filter @newranews/database \
  exec prisma migrate resolve --applied 0_init
```

Depois disso: conferir com `migrate status` que não há drift, cadastrar o secret `DATABASE_URL` no GitHub e deixar o `migrate.yml` assumir daí em diante. Sem o `resolve`, o primeiro `migrate deploy` falha com **P3005 — the database schema is not empty**.

O runbook completo dessa operação — incluindo o passo de conferência de drift, que precisa vir antes do `resolve` — está em [`docs/db-baseline.md`](db-baseline.md).

Fonte: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production.

### H. Onde isso entra no plano de implementação

Adicionar à **Fase 0 — Discovery técnico** (seção 28): mapear o schema atual e decidir quais mudanças de schema pertencem a cada fase seguinte, em vez de gerar uma migration gigante misturando trending + métricas + histórico de uma vez.

---

# 38. Padronização de estrutura de projeto (padrão em camadas / MVP)

O objetivo aqui é dar ao `apps/api` — e, em menor grau, ao `apps/web` — uma estrutura previsível, onde fica claro onde uma mudança deve entrar. "MVP" é usado aqui no sentido de **M**odel → **P**resenter (camada de regra de negócio) → **V**iew (camada HTTP/apresentação), uma variação do MVC comum em APIs Fastify/TypeScript.

### A. Mapeamento do padrão para o stack atual

```text
Model      → packages/database (schema Prisma) + packages/types
Presenter  → services/ (regra de negócio, não conhece Fastify)
View       → routes/ + controllers/ (recebe request, valida com Zod, chama o service, formata a resposta)
```

Esse mapeamento segue o padrão modular descrito em templates de referência para Fastify + TypeScript, onde cada entidade de negócio concentra suas rotas, controllers, services e schemas dentro do próprio módulo, favorecendo baixo acoplamento entre domínios. Fonte: https://github.com/sujeet-agrahari/node-fastify-architecture.

### B. Estrutura proposta para apps/api

```text
apps/api/
└── src/
    ├── app.ts                 # bootstrap do Fastify
    ├── plugins/                # cross-cutting: auth, cors, db, rate-limit
    ├── modules/
    │   ├── news/
    │   │   ├── news.routes.ts
    │   │   ├── news.controller.ts
    │   │   ├── news.service.ts
    │   │   ├── news.schema.ts      # validação Zod
    │   │   └── news.types.ts
    │   ├── briefing/
    │   │   ├── briefing.routes.ts
    │   │   ├── briefing.controller.ts
    │   │   ├── briefing.service.ts
    │   │   └── briefing.schema.ts
    │   ├── trending/
    │   ├── metrics/
    │   └── auth/
    └── shared/
        ├── errors/
        ├── utils/
        └── middleware/
```

**Distância do estado atual.** A API já é parcialmente em camadas: existem `plugins/`, `services/` (com testes ao lado) e `routes/` agrupadas por domínio (`routes/news/`, `routes/articles/`, `routes/metrics/`, ...), além de `config/`, `providers/`, `jobs/` e `utils/`. O que **não** existe é a camada `controllers/`: os handlers vivem dentro dos arquivos de rota, junto do registro e do schema Zod. A migração da §38-F é, portanto, real — mas é reorganização, não reescrita.

Módulo recomendado para a prova de conceito da §38-F: **`metrics`** — 1 arquivo de rota, 1 service, 1 schema, sem dependência de auth nem do pipeline. `news` é o pior candidato para começar (3 arquivos de rota: `index`, `[id]`, `admin`).

Organizar por domínio de negócio, em vez de por tipo técnico, reduz o custo cognitivo de trabalhar em uma feature de cada vez e diminui conflitos de merge entre pessoas mexendo em módulos diferentes — o principal trade-off a aceitar é alguma duplicação pontual entre módulos. Fonte: https://oneuptime.com/blog/post/2026-02-03-nodejs-large-app-structure/view.

### C. Regra de dependência entre camadas

```text
routes  →  controller  →  service  →  repository/Prisma
```

Nunca o inverso. Controllers não acessam o Prisma diretamente; services não conhecem `FastifyRequest`/`FastifyReply`. É isso que permite testar a regra de negócio sem precisar subir um servidor HTTP.

### D. Aplicação equivalente no apps/web

A seção 23 deste plano já propõe uma estrutura por domínio editorial (`components/editorial`, `components/layout`, `components/monetization`). O mesmo princípio de "Model / Presenter / View" se traduz em:

```text
Model      → data contracts da seção 24 (EditorialStory, DailyBriefing)
Presenter  → hooks/queries (TanStack Query) que buscam e formatam os dados
View       → componentes de components/editorial, "burros" (recebem props, não fazem fetch)
```

### E. Convenção de nomenclatura

- arquivos: `kebab-case.ts`;
- componentes React: `PascalCase`;
- um arquivo de teste ao lado de cada `service`/`controller` (`*.test.ts`), como já é feito hoje no projeto.

### F. Migração incremental — não é um big-bang refactor

Como o projeto já está em produção, a reestruturação deve seguir o mesmo espírito faseado da seção 28:

```text
1. Criar a nova estrutura de pastas vazia (modules/, shared/) sem mover nada ainda
2. Mover 1 módulo pequeno primeiro (ex: metrics) como prova de conceito
3. Validar que testes e CI continuam passando
4. Mover os módulos restantes um PR por vez, seguindo a convenção da seção 29 (feat/structure-<module>)
5. Só depois disso, aplicar o mesmo racional em apps/web
```

### G. Onde isso entra no plano de implementação

Encaixa como sub-tarefa da **Fase 0 — Discovery técnico** (seção 28): antes de criar os novos endpoints da seção 18 (Home agregada, trending, related stories), já criá-los dentro da nova estrutura modular, em vez de adicionar mais código à estrutura antiga e ter que migrar depois.

---

# 39. Referências usadas

- Newra News repository: https://github.com/tavinholoco/newra-news
- Newra News production URL: https://newra-news-web.vercel.app/pt-BR
- The Daily Star — Digital News Platform Redesign: https://www.behance.net/gallery/251506525/The-Daily-Star-Digital-News-Platform-Redesign
- Reuters Institute Digital News Report 2026: https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary
- Google Search Central — Core Web Vitals: https://developers.google.com/search/docs/appearance/core-web-vitals
- Google Search Central — Article structured data: https://developers.google.com/search/docs/appearance/structured-data/article
- Google Search Central — News sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap?hl=pt-BR
- W3C — WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Google AdSense — Best practices for ad placement: https://support.google.com/adsense/answer/1282097?hl=en
- Google AdSense — Viewability best practices: https://support.google.com/adsense/answer/6219980?hl=en
- Digiday — Publisher revenue strategies 2025: https://digiday.com/media/publisher-strategies-what-forbes-business-insider-the-guardian-and-others-are-focusing-on-in-2025/
- RepoClip — How to Write a Great GitHub README: https://repoclip.io/blog/how-to-write-a-github-readme
- Pushpen — GitHub README Best Practices in 2026: https://pushpen.dev/blog/github-readme-best-practices-2026
- GitHub README Template Guide 2026: https://gingiris.github.io/growth-tools/blog/2026/04/02/github-readme-template-guide/
- Prisma — Deploying database changes with Prisma Migrate: https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate
- Prisma — Development and production workflows: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
- Prisma — Discussion: How should migration be done to Production: https://github.com/prisma/prisma/discussions/24571
- PocketCmds — Master Prisma Migrations for Production: https://pocketcmds.com/skills/prisma/prisma-migration-workflow
- node-fastify-architecture (modular folder structure): https://github.com/sujeet-agrahari/node-fastify-architecture
- OneUptime — How to Structure Large Node.js Applications: https://oneuptime.com/blog/post/2026-02-03-nodejs-large-app-structure/view

---

## Nota de auditoria

A análise do repositório foi feita diretamente sobre a estrutura e os arquivos públicos do projeto. A URL de produção informada foi consultada, mas o ambiente de análise não conseguiu recuperar o HTML da aplicação naquele momento (falha de cache/fetch). Por isso, qualquer observação estritamente visual sobre o estado atual do deploy deve ser tratada como inferência baseada no código e nos screenshots/documentação versionados no próprio repositório, e não como uma auditoria pixel-perfect do deploy em produção.

---

# 40. Auditoria de prontidão do repositório (19/08/2026)

Antes de abrir a Fase 0, as seções 1–39 foram conferidas contra o estado real da `main`. Foram encontrados 3 bloqueadores, 14 divergências pontuais e 2 itens de higiene. Esta seção registra o que era, o que foi feito e o que continua pendente.

As correções foram aplicadas **no corpo das seções correspondentes** — esta seção é o registro, não a errata. Onde uma seção foi corrigida, ela traz um bloco "Estado em 19/08/2026".

## 40.1 Bloqueadores — resolvidos

### A. As migrations estavam no `.gitignore`

`.gitignore` ignorava `packages/database/prisma/migrations/*`, preservando só um `.gitkeep`. A pasta estava vazia: não havia histórico de migrations versionado, e a §37 inteira assumia que havia.

**Feito:** as linhas saíram do `.gitignore` (com um comentário explicando por que não devem voltar) e a migration de baseline `0_init` foi gerada a partir do schema atual via `migrate diff --from-empty`, sem tocar em banco nenhum — 215 linhas de SQL cobrindo os 5 enums e as 9 tabelas. Registro na §37-A e §37-G.

### B. A produção nunca recebeu `migrate deploy`

O banco no Neon foi construído com `prisma db push` (16/08) e `prisma db push --accept-data-loss` (17/08). Tem o schema certo e nenhum histórico. A §37-G tratava o baseline como hipótese; era certeza.

**Feito:** a metade que não exige a URL de produção — gerar o `0_init`. **Pendente:** o `migrate resolve --applied 0_init` contra o Neon, que só o dono das credenciais pode rodar. Comando exato na §37-G.

### C. Não existia job de deploy onde encaixar o `migrate deploy`

Render e Vercel deployam sozinhos ao observar a `main`; o `ci.yml` só fazia lint/typecheck/test/build. Não havia onde colocar o step.

**Feito:** criado `.github/workflows/migrate.yml` — dispara em push na `main` quando `schema.prisma` ou `migrations/**` mudam (mais `workflow_dispatch`), roda `migrate status` e depois `migrate deploy`, com `concurrency` serializando execuções. Enquanto o secret `DATABASE_URL` não existir, cada execução é um no-op explícito, o que força a ordem correta: baseline primeiro, secret depois. Adicionados também os scripts raiz `db:migrate:deploy` e `db:migrate:status` — o primeiro já era citado por `docs/setup.md`, mas não existia.

## 40.2 Divergências corrigidas

| # | Seção | Era | Ficou |
|---|---|---|---|
| C1 | 37-B | `pnpm db:migrate --name X` | `pnpm db:migrate -- --name X` — o script raiz é `turbo db:migrate` e sem o `--` o turbo consome o argumento |
| C2 | 36-B | Badge `node >= 18` | `>= 22` — o `package.json` exige `>=22.0.0`, o CI usa 22, o Render fixa 22.12.0 |
| C3 | 36-B | Badge de CI comentado | Ativado apontando para o workflow real, `ci.yml` |
| C4 | 36-H | `LICENSE` e `CONTRIBUTING.md` ausentes | Ambos criados — MIT na raiz, guia de contribuição com checklist de PR |
| C5 | 24 | `category: NewsCategory` | `category: Category` — o enum real, em `packages/types/src/news.ts` e no Prisma |
| C6 | 18.1 | `GET /home` | `GET /api/home` — todas as rotas ficam sob `/api/*` (`apps/api/src/app.ts`); vale também para trending e related |
| C7 | 23, 30 | Página `/[locale]/newsletter` tratada como existente | Não existe — só o `SubscribeForm` no rodapé e `/newsletter/unsubscribe`. Virou entregável explícito da Fase 2 e entra na baseline visual só depois disso |
| C8 | 23 | Estrutura de rotas sem `signin` e `admin` | Ambas listadas — existem hoje e precisam sobreviver ao redesign |
| C9 | 10 | "O header atual tem logo" | O commit `7621db3` removeu o logo e apagou os SVGs; hoje há só o wordmark textual. A §3.1-A agora declara a dependência do asset |
| C10 | 12, 23 | `tokens.css` como se houvesse `tailwind.config.js` | Tailwind v4: tokens em `@theme inline` dentro do `globals.css`, com valores em `@layer base` |
| C11 | 4.1 | Troca de paleta tratada como substituição direta | Documentado o custo real: 4 níveis de marca hoje (com override no `.dark`) contra 7 propostos, e `brand-400` sem equivalente na paleta nova |
| C12 | 38-B | Estrutura em camadas como se fosse do zero | A API já tem `plugins/`, `services/` e `routes/` por domínio; falta só `controllers/`. Módulo indicado para a prova de conceito: `metrics` |
| C13 | 18.4, 24 | `DailyBriefing` com fontes, `generatedAt` e versões | O modelo `Article` só tem `title/content/summary/date/newsCount` — nenhum campo de auditoria existe. A migration e `packages/types/src/article.ts` andam juntas |
| C14 | 26 | Lighthouse como métrica a acompanhar | Vira piso: a V1 já entrega 96/96/96/100 e o workflow falha abaixo de 90. Entregar 91 é regressão |

### Divergências fora do plano, encontradas no caminho

- `docs/setup.md` mandava aplicar o schema com `prisma db push` ("as migrations são gitignored") e citava `pnpm db:migrate:deploy`, um script que não existia. As duas coisas foram corrigidas, e a seção "Alterando o schema" foi acrescentada ao guia.
- `CLAUDE.md` apontava para `docs/PRD-NewraNews_V1_1.md`; o arquivo é `docs/PRD-NewraNews_V1.1.md` (gitignored, local-only). Também descrevia `pnpm test` como "Vitest (backend)", quando o `turbo test` cobre backend e frontend.

## 40.3 Asset de logo — recebido e padronizado (19/08/2026)

O logo foi entregue como **3 PNGs de 1600 px** (marca laranja, marca preta e um arquivo "horizontal"). Foram convertidos para vetor e padronizados em `apps/web/public/logo/`.

### O que veio

| Arquivo recebido | Canvas | Arte | Diagnóstico |
|---|---|---|---|
| marca laranja | 1600×1600 RGBA | 1183×1311, centrada | OK — cor `#C94F22` exata |
| marca preta | 1600×1600 RGBA | idêntica | Redundante: vira a variante `currentColor` |
| "horizontal" | 1600×351 RGBA | 259×287 no canto esquerdo | **Vazio à direita de x=320** — zero pixels com alpha. Não há wordmark |

Três observações relevantes:

1. **A cor é exatamente `#C94F22`** — o `brand-600` da paleta da §4.1, sem ajuste necessário. Amostragem: 191.633 px em `#C94F22`, mais 13 px de antialiasing.
2. **O arquivo horizontal não tem lockup.** É a marca sozinha num canvas de 1600×351 com 81% de área vazia. O que parecia um wordmark branco na visualização era o fundo transparente.
3. **Eram rasters.** A §40.3 original pedia SVG; PNG não serve para o masthead, que usa a marca de 24 px (mobile) a 40+ px (desktop).

### Geometria decodificada

A marca é geometricamente regular, o que permitiu reconstruí-la em vetor em vez de traçar o bitmap. Medida sobre o PNG de 1600 px (canvas com origem em 208,144):

```text
haste esquerda    stadium (320,256) → (320,1344)     raio 112
diagonal superior stadium (320,256) → (576,528)      raio 112
haste direita     stadium (1280,256) → (1280,1344)   raio 112
diagonal inferior stadium (1280,1344) → (1024,1072)  raio 112
estrela           sparkle centro (800,800)           raio 294
```

A arte tem simetria de rotação de 180° em torno de (800,800). Os quatro traços são stadiums de mesma largura (224) com caps semicirculares; as diagonais têm inclinação `dx/dy = 0.9425` e nascem exatamente no centro do cap da haste correspondente. A estrela é uma sparkle de 4 pontas — cada quadrante é uma cúbica de Bézier com os pontos de controle a `0.39·r` do centro.

**Validação:** a geometria reconstruída foi rasterizada e comparada pixel a pixel com o PNG original. Divergência sólida (erro real de forma): **3 px** em 768.744 px de arte. Todo o resto — 5.734 px — é banda de antialiasing de ≤3 px na borda, esperada entre dois rasterizadores diferentes.

### O que ficou versionado

| Arquivo | Conteúdo |
|---|---|
| `apps/web/public/logo/logo-mark.svg` | marca em `#C94F22`, 633 bytes |
| `apps/web/public/logo/logo-mono.svg` | marca em `currentColor`, 638 bytes |

Ambos: `viewBox="0 0 1184 1312"` justo (sem padding — o espaçamento é do CSS, o que maximiza a área visual a 24 px), path único com `fill-rule="evenodd"`, sem `width`/`height` fixos, sem `<text>`, sem raster embutido, com `role="img"` e `aria-label`. Redução de 36,7 KB para 0,6 KB.

Não foi criado `logo-mark-black.svg`: o preto é `logo-mono.svg` dentro de um contexto com `color: #000`.

### Wordmark — decidido em 19/08/2026

Não existe lockup horizontal, e desenhá-lo exigiria escolher tipografia e espacejamento. **Decisão: a V2 usa wordmark tipográfico, e a possibilidade de um lockup desenhado só é reavaliada depois da Fase 2.**

**A. Wordmark tipográfico — adotado.** O masthead compõe `logo-mono.svg` + "Newra News" renderizado na **fonte de interface** definida na §5 (não na serif das headlines — a própria §5 já estabelece "navegação: sans").

- acompanha a troca de tipografia da V2 sem redesenho;
- responsivo de graça: o texto some no mobile via media query e sobra a marca, sem precisar de um segundo arquivo;
- o nome continua sendo texto — selecionável, encontrável no Ctrl+F, lido por leitor de tela sem depender de `aria-label`;
- custo zero: é o que o header já faz, faltando só a marca ao lado.

Contrapartida aceita: o wordmark depende do webfont carregar, o que exige `font-display: swap` e uma stack de fallback decente para o flash não incomodar.

**B. Lockup desenhado — adiado, não descartado.** SVG com o texto em curvas: proporção entre 4:1 e 5:1, marca alinhada opticamente à **altura-x** do wordmark (não à caixa alta), mais uma variante `currentColor` — o mesmo padrão dos SVGs já versionados.

**Por que adiar e não decidir agora.** É sequenciamento, não qualidade. A §5 ainda vai fechar a tipografia da V2, e desenhar letra contra uma fonte que vai mudar é mirar em alvo móvel. Depois que a Fase 1 fixar as fontes e a Fase 2 fechar o masthead, o lockup — se ainda for desejado — nasce alinhado em vez de remendado.

As opções não são excludentes: migrar de A para B é substituir um `<span>` por um SVG inline dentro de um componente só. O ponto de reavaliação está registrado na §28, ao final da Fase 2.

**Quando B passaria na frente:** material impresso, licenciamento da marca para terceiros, ou um tratamento gráfico do nome que fonte nenhuma entrega.

### Reavaliação ao fim da Fase 2 — decidido em 20/08/2026

**O wordmark tipográfico fica. O lockup desenhado (B) segue sem ser
necessário** — desta vez não por sequenciamento, mas por medição.

Com o masthead entregue e a tipografia fixa, o lockup em produção foi medido no
tamanho em que ele realmente aparece (Inter 20px, `/pt-BR` a 1440px):

| | Medido | Alvo da §40.3-B |
|---|---|---|
| Proporção do lockup | 151,5 × 28 px = **5,41:1** | 4:1 a 5:1 |
| Alinhamento da marca | centro em **66,0** | centro da altura-x |
| Centro da caixa alta | 65,5 | — |
| Centro da altura-x | 67,5 | ← alvo |

Duas leituras saem daí.

**A proporção já é praticamente a que B perseguia.** 5,41:1 fica 8% acima do
topo da faixa que a §40.3-B definiria para um lockup desenhado. Ou seja: a
geometria que justificaria desenhar o lockup já está lá, de graça, saindo da
composição tipográfica. Desenhar para chegar onde já se está é trabalho sem
prêmio.

**A marca está alinhada à caixa alta, não à altura-x.** O centro dela cai a
0,5 px do centro da caixa alta e a 1,5 px do centro da altura-x — que era o
alinhamento que a §40.3-B pedia. **Não foi corrigido**: são 1,5 px num tipo de
20 px, e a marca transborda o texto 6 px acima e 7 px abaixo, então "centro
óptico" aqui é faixa, não ponto. Empurrar a marca com um `translate-y` de
1,5 px seria reintroduzir exatamente o número mágico que a Fase 2 passou a fase
inteira tirando do código. Fica registrado para quem reabrir B.

Os critérios que fariam B passar na frente continuam sem se aplicar: não há
material impresso, não há licenciamento da marca para terceiros, e o nome não
pede tratamento gráfico que fonte nenhuma entregue.

E as vantagens de A deixaram de ser promessa e viraram fato verificado em
produção: o nome é texto selecionável e encontrável no Ctrl+F, o leitor de tela
o lê sem `aria-label`, e o comportamento responsivo — wordmark some abaixo de
`sm`, marca fica — custou zero asset adicional. A variante `currentColor` que
a §40.3-B listava como requisito de B já existe em A: o `LogoMark` pinta com
`currentColor`, e é o que permite a marca virar branca no rodapé escuro.

**Migrar para B continua barato se um dia fizer sentido:** é trocar um `<span>`
dentro de `components/layout/logo.tsx`, e em lugar nenhum mais.

### Derivados gerados na Fase 2 ✅

A partir do vetor, sem novo asset: `app/icon.svg` (com safe area — ícones
precisam de padding, ao contrário do SVG justo), `app/apple-icon.tsx` (180×180;
saiu `.tsx` em vez de PNG versionado, para não haver binário no git nem uma
segunda fonte da marca) e a imagem Open Graph 1200×630 de
`app/opengraph-image.tsx`, que era um gradiente slate `#0f172a` sem relação com
a marca.

## 40.4 Higiene

- **`apps/web/.git/`** — repositório git órfão de 13/03/2026 com 15.652 objetos soltos e **zero commits** (`master` sem commits: era um `git add` que nunca virou commit). Os arquivos de `apps/web` sempre foram rastreados pelo monorepo, mas qualquer `git` rodado de dentro de `apps/web` operava nesse repositório vazio. **Removido** — nada recuperável foi perdido.
- **`CLAUDE.md`** — corrigido (ver §40.2).

## 40.5 O que continua pendente

Três itens, todos dependendo de algo que está fora do repositório:

| Pendência | Depende de | Bloqueia |
|---|---|---|
| ~~`migrate resolve --applied 0_init` no Neon + secret `DATABASE_URL` no GitHub~~ | — | ✅ **concluído em 19/08/2026** — drift conferido (vazio), baseline aplicado, `migrate status` retorna `Database schema is up to date!`, secret cadastrado e senha do role rotacionada |
| ~~Lockup horizontal~~ | — | ✅ **decidido em 19/08/2026 e confirmado em 20/08/2026** — wordmark tipográfico na V2. A reavaliação ao fim da Fase 2 mediu o lockup em produção: 5,41:1, praticamente a proporção que o desenhado perseguia (§40.3) |
| Landing `/[locale]/newsletter` | decisão de escopo — já registrada como entregável da Fase 2 | baseline visual da §30 |

**Nada bloqueia mais a Fase 0.** O único item aberto é de escopo, não de infraestrutura, e já tem lugar definido no plano.

---

# 41. Como conduzir a execução da V2.0 com Claude Opus 5

O desenvolvimento da V2.0 será feito em sessões com Claude Opus 5. As convenções abaixo vêm da documentação oficial de prompting do modelo e valem para todas as branches da seção 29. Fonte: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5.

### A. Entregue a especificação inteira de uma vez

O Opus 5 rende melhor recebendo a tarefa completa de antemão e sendo deixado rodar até o fim — ele entrega a feature inteira em vez de deixar stubs. Cada branch da seção 29 (`feat/v2-home`, `feat/v2-article`, ...) deve virar **um** prompt com o escopo fechado: seção do plano, componentes envolvidos, contrato de dados e critério de aceite. Fatiar a mesma branch em cinco pedidos pequenos rende menos.

### B. Escolha o effort pela dificuldade, não por hábito

- `low`/`medium` — ajustes pontuais, renomes, troca de token, correção de teste;
- `high` (padrão) — a maior parte do trabalho de componente;
- `xhigh` — Fase 1 (foundation), Fase 3 (Home) e a reestruturação modular da seção 38, que tocam muitos arquivos ao mesmo tempo.

Manter o thinking ligado e controlar custo pelo effort rende mais do que desligar o thinking.

### C. Não peça verificação — ela já acontece

O modelo verifica e corrige o próprio trabalho sem ser instruído. Instruções do tipo "revise antes de responder", "confirme que os testes passam duas vezes" ou "use um subagente para validar" provocam sobre-verificação: gastam tokens sem melhorar o resultado. Peça o critério de aceite ("`pnpm test` verde, Lighthouse ≥ 90"), não o ritual.

### D. Delimite o escopo explicitamente

O Opus 5 tende a expandir o escopo. Nas tarefas cirúrgicas — especialmente durante a migração incremental da seção 38-F, onde o objetivo é mover um módulo sem alterar comportamento — vale declarar isso no prompt:

```text
Mova apenas o módulo metrics para a nova estrutura. Não altere comportamento,
não renomeie endpoints, não refatore os testes existentes. Se encontrar um
problema fora desse escopo, aponte em uma frase e siga.
```

### E. Calibre o tamanho dos documentos que ele escreve

Arquivos que o modelo grava em disco (relatórios, atualizações do `progress.md`, descrições de PR) saem longos por padrão. Onde isso importar, peça a calibragem: *"cubra a substância, sem seções de preenchimento nem sumários redundantes"*.

### F. Use a força visual do modelo no redesign

O Opus 5 é forte em replicação visual de UI e leitura de diagramas, e rende mais quando pode **iterar com ferramentas** — abrir a página, tirar screenshot, recortar, comparar — do que apenas raciocinando sobre o código. Nas Fases 2–5, rodar o dev server e deixar o modelo comparar o resultado com a referência visual vale mais que descrever o layout em texto.

### G. Revisão de código: peça tudo e filtre depois

O modelo encontra bugs reais com alta precisão, mas segue instruções restritivas ao pé da letra. Um prompt do tipo "reporte só o que for crítico" faz ele reportar de menos. Peça o relatório completo e faça a triagem em um segundo passo.

### H. Delegue pouco

O Opus 5 aciona subagentes com facilidade, e isso multiplica custo em tarefas pequenas. Delegue só investigações amplas e genuinamente paralelas (por exemplo, mapear todos os usos de `brand-400` e `brand-900` no `apps/web` antes da Fase 1). Trabalho que cabe em algumas chamadas de ferramenta deve ser feito direto.
