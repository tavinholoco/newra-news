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

# 21. Monetização: o que fica planejado

> **Reescrita em 22/08/2026.** A estratégia original tinha quatro fases:
> publicidade leve, newsletter patrocinada, Newra Plus e API B2B. A primeira foi
> **cancelada por decisão** e as outras tês estão **adiadas para lançamento
> futuro e indeterminado**. Nada disso está em desenvolvimento.

Não iniciar a V2.0 com paywall agressivo continua valendo, e a razão também: o
Newra ainda precisa fortalecer sua proposta de valor e provar retenção. O Reuters
Institute aponta que o pagamento por notícias segue concentrado numa faixa
relativamente limitada de mercados e que o deslocamento de audiência para
plataformas externas dificulta o funil de assinaturas. Fonte:
https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary.

## O gatilho é um número, não uma data

Nenhum dos itens abaixo se retoma por calendário. Todos dependem de **base de
usuários recorrentes**, e quem vai dizer se ela existe é a tela de métricas de
produto da Fase 8.

**O número a observar é assinante ativo da newsletter e conta criada** — os dois
persistentes. Sessão **não serve**: o identificador morre ao fechar a aba, de
propósito, e por isso a medição anônima não sabe dizer quem voltou. Enquanto
esses dois não crescerem, tudo aqui é planejamento.

## ~~Fase 1: publicidade leve~~ — **CANCELADA** (22/08/2026)

**Decisão: o site não exibe anúncio.** O código que existia (slots com altura
reservada, inventário de casa, banner de consentimento, viewability) foi
removido — ver a Fase 8 da §28 e o item 29 do `docs/progress.md`.

Se um dia for reconsiderada, o registro do que existiu está no PR #124, e a
lição de desenho continua válida: **altura reservada antes do criativo**, senão
o anúncio empurra a página depois que o leitor começou a ler.

## Fase 2: Newsletter patrocinada — **ADIADA** (indeterminado)

Possibilidades:

- "Newra Daily apresentado por ...";
- patrocínio por categoria;
- slots patrocinados claramente marcados.

Isso tende a combinar melhor com uma publicação de nicho do que encher o site de
banners — e, com a publicidade cancelada, passou a ser **o primeiro caminho de
receita**, não o segundo.

**O que falta antes:** número de assinantes para pôr numa proposta — e ele está
no bloco de audiência da tela de métricas, vindo do `Subscriber`, não do evento.

**O que já existe:** a landing `/newsletter`, o `Subscriber` no banco, o envio
diário pela etapa 7.5 do pipeline, e o evento `newsletter_signup` medindo a
conversão por origem (rodapé × CTA editorial).

## Fase 3: Newra Plus — **ADIADA** (indeterminado)

Quando houver base de usuários recorrentes, testar assinatura:

```text
FREE
• notícias
• Daily Brief
• histórico limitado
• newsletter básica

PLUS
• briefing premium
• personalização por tema
• newsletters especiais
• alertas personalizados
• áudio do briefing
• histórico completo
```

> **"Experiência sem anúncios" saiu da lista**, e por um motivo simples: não há
> anúncio para remover. Era o item mais fácil de vender e o menos honesto —
> cobrar para tirar um incômodo que o próprio site cria.

A intenção deve ser vender **conveniência e personalização**, não "acesso a
notícias".

**O que falta antes:** gente voltando. E, do lado do produto, decidir se existe
plano — `subscription_intent` está no catálogo de eventos **sem call site**, e um
`premium-cta` que não leva a lugar nenhum mede clique em botão, não intenção de
compra.

**O que já existe:** `UserPreference` com assuntos e tema (Fase 6), que é a base
da personalização, e as telas de conta.

## Fase 4: B2B / API — **ADIADA** (indeterminado)

O motor de agregação e briefing pode virar produto: API de briefings, widgets,
resumos para empresas, newsletter white-label, monitoramento por tópico.

Pode se tornar uma linha de receita mais escalável que publicidade — e, com a
publicidade cancelada, é a alternativa de teto mais alto. Mas exige evolução de
backend e de produto muito além da V2.0 visual.

---

# 22. ~~Como monetização deve influenciar o design~~ — histórico

> **Seção histórica desde 22/08/2026.** Ela existia para uma regra: decidir onde
> o anúncio entra **antes** de fechar o layout, para ele não empurrar conteúdo
> depois. Com a publicidade cancelada, a regra não tem mais objeto.
>
> **O que ela ensinou continua valendo** e está aplicado: espaço reservado antes
> do conteúdo chegar é o que protege o CLS — e é por isso que o `story-image`
> reserva proporção e o `story-card` reserva altura, mesmo sem anúncio nenhum.

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
- ~~sessões recorrentes~~ — **não mensurável** com esta camada, e é por desenho:
  o `sessionId` morre ao fechar a aba. Quem mede audiência recorrente são
  assinantes ativos e contas criadas, que a tela de métricas mostra ao lado das
  sessões (§28, Fase 8);
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
[x] GET /api/home            (agregado da Home — §18.1)
[x] GET /api/trending        (etapa 1: recência + favoritos — §18.2)
[x] GET /api/news/:id/related                              (§18.3)
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

    -- ficou em aberto na época; fechado depois --
[x] Lighthouse por rota contra a tabela do 00-diagnostico.md §3.1  (Fase 3)
[x] baseline visual da V2 (docs/v2/baseline-v2/)                   (Fase 2)
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

    -- ficou para a Fase 6, com o resto do ecossistema de conta, e saiu lá --
[x] "somente salvos"                (§7 — entregue na Fase 6; `?saved=1` troca a
                                     fonte de dados e desliga a contagem das
                                     facetas, porque elas contam o acervo)

    -- ao fechar a fase, contra produção --
[x] Lighthouse por rota (§26) — 21/08, /news de 93 para 97
[x] recapturar a baseline visual (§30) — 42 imagens; e foi ela que achou o
    defeito de produção descrito abaixo
```

### Medição de 21/08, 20:53 ([run 32525537279](https://github.com/tavinholoco/newra-news/actions/runs/32525537279))

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 95 | 100 | 100 | 100 |
| `/pt-BR/news` | **97** (era 93) | **100** | 100 | 100 |
| `/pt-BR/article` | 96 | 100 | 100 | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 94 | 100 | 100 | 100 |

Acessibilidade **100 nas cinco rotas**, com a `/news` reescrita — a hierarquia
`h1 → h2 → h3` segurou o `heading-order` que a ficha da tela mandava corrigir. O
gate rodou (`Asserting`) e passou.

> **A baseline achou o que o Lighthouse não veria.** Nas três larguras, as oito
> pílulas de categoria apareceram com **0** ao lado do nome, logo acima de
> "5.783 notícias" — e a página pontuou 97 assim, porque zero é tão rápido de
> renderizar quanto qualquer número. O build da Vercel correu antes de o deploy
> da API subir `/api/news/facets`; o `catch` da página transformou a falha num
> resultado vazio, e o `staleTime` de 5 minutos do TanStack Query fez a query
> tratá-lo como fresco e **nunca buscar de novo**. Resultado vazio é uma
> afirmação; falha é ausência. Corrigido com `prefetch` em `lib/api.ts`, que
> falha em `undefined` — e a `/article` tinha o mesmo padrão.

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

## Fase 5 — Article ✅ 21/08/2026 — branch `feat/v2-article`

```text
[x] article hero        (casca com encaixes: as duas telas, uma composição)
[x] body typography     (medida de leitura; `###` da IA vira `h2`)
[x] source list         (só no briefing — leva à fonte, não a /news/[id])
[x] AI disclosure       (só no briefing — a notícia não é gerada por IA)
[x] share/save          (share nas duas; save só onde `Favorite` alcança)
[x] related stories     (só na notícia — o briefing já lista as suas fontes)
[x] newsletter CTA      (fim das duas telas)

    -- a terceira tela, que a ficha põe nesta fase --
[x] /article no ritmo dos tokens   (agrupado por mês, o do dia marcado)

    -- pré-requisito, entregue antes (PR #112) --
[x] payload do artigo com auditoria e fontes

    -- ao fechar a fase, contra produção --
[x] Lighthouse por rota (§26) — acessibilidade 100 nas cinco; e a medição
    achou uma hidratação quebrada em /article
[x] recapturar a baseline visual (§30) — 42 imagens, 11 diferentes; e ela
    achou o dek repetido no corpo do briefing
```

### Medição de 22/08, 00:04 ([run 32538891625](https://github.com/tavinholoco/newra-news/actions/runs/32538891625))

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 93 | 100 | 100 | 100 |
| `/pt-BR/news` | 95 | 100 | 100 | 100 |
| `/pt-BR/article` | 96 | 100 | **96** | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 94 | 100 | 100 | 100 |

**Acessibilidade 100 nas cinco**, com o skip link novo e as três telas
reescritas. O gate passou. Os 4 pontos de best-practices em `/article` eram
`errors-in-console`: o `ArticleGrid` lia o relógio durante o render de uma
página **estática**, o build correu 23:5x e a medição 00:04, o dia virou no meio
e o selo "Hoje" existiu de um lado só — React #418 e #422, hidratação derrubada.
Garantido acontecer toda meia-noite UTC, não acaso de horário.

> **A baseline achou o segundo defeito**, que métrica sintética nenhuma pegaria:
> o dek do briefing e o primeiro parágrafo do corpo são **o mesmo texto**, um
> embaixo do outro. `summary` não é resumo escrito à parte — o
> `parseMarkdownResponse` o define como a primeira linha do conteúdo. Verdade
> nos seis artigos que a API devolve. Corrigido na apresentação, que é o que
> alcança os 90 dias já gravados. Detalhe no item 21 do `progress.md`.

> **`/news/[id]` era da Fase 5, não da 4.** A ficha da tela em
> `docs/v2/02-sitemap-telas.md` a marcava como Fase 4, mas os cinco itens do
> checklist acima mapeiam nela um a um — e separar as duas telas de artigo em
> fases diferentes duplicaria `source-list` e `related-stories`. A ficha foi
> corrigida.

> **A transparência de IA é só do briefing.** `/news/[id]` é matéria escrita por
> uma redação e coletada por RSS; carimbá-la como produzida por IA mentiria na
> direção que mais custa a um produto jornalístico. O que aquela tela declara é
> a outra coisa: que o texto é do veículo e que o Newra News coletou.

> **A "leia também" do briefing são as próprias fontes.** Ele já lista as
> matérias que o originaram; uma segunda lista de relacionadas seria a mesma
> informação duas vezes. `related-stories` fica em `/news/[id]`, que é onde o
> `GET /api/news/:id/related` — entregue na Fase 0.5 e até aqui **sem
> consumidor** — faz sentido.

> **Nada de renderizador de Markdown.** O corpo de produção foi medido: cinco
> subtítulos, todos `###`, sem negrito nem listas. Trazer `react-markdown` seria
> ~40 kB para reconhecer sintaxe que o modelo não produz. Os `###` saem como
> `h2`, porque o nível é decisão da página — o `h1` é o título, e `h3` abriria
> salto de nível.

> **Duas coisas da §8 não entraram, e o motivo está registrado.** "Salvar" no
> briefing: `Favorite` referencia `newsId` e um `Article` não pode ser
> favoritado — é Fase 6. E "horário da coleta": não há coluna, e o mais próximo
> (`createdAt` do artigo) fica a segundos da geração, redundante com
> `generatedAt`. Melhor omitir do que rotular um número como coisa que ele não
> é — o mesmo critério que barrou o indicador "Atualizado" na Home.

## Fase 6 — Account ecosystem ✅ 22/08/2026 — PRs #116, #117 e #118

```text
[x] favorites            (uma lista só: notícia e briefing, por data de salvamento)
[x] profile              (de leitura — o provedor reescreve nome e imagem no login)
[x] preferences          (assuntos e tema; só o que a interface honra)
[x] newsletter settings  (a inscrição, que é Subscriber, não uma preferência)

    -- herdado das Fases 4 e 5, pelo mesmo motivo --
[x] "somente salvos" em /news        (§7 — adiado na Fase 4)
[x] "salvar" no briefing             (§8 — adiado na Fase 5)

    -- o que a fase mudou no banco, decidido antes da primeira tela --
[x] Favorite polimórfico (itemType + itemId), com backfill
[x] UserPreference (categorias + tema)
[x] Subscriber.userId, com backfill por e-mail

    -- ao fechar a fase, contra produção --
[x] Lighthouse por rota (§26) — acessibilidade 100 nas cinco, gate verde
[x] recapturar a baseline visual (§30) — 20 imagens, todas explicadas
```

### Medição de 22/08, 03:01 ([run 32547642493](https://github.com/tavinholoco/newra-news/actions/runs/32547642493))

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 94 | 100 | 100 | 100 |
| `/pt-BR/news` | 96 | 100 | 100 | 100 |
| `/pt-BR/article` | 96 | 100 | 100 | 100 |
| `/pt-BR/about` | 97 | 100 | 100 | 100 |
| `/en` | 94 | 100 | 100 | 100 |

**Acessibilidade 100 nas cinco**, e o best-practices de `/article` voltou aos
100 — a correção do relógio no render, feita na Fase 5, confirmada numa segunda
medição.

> **A primeira medição reprovou, e não era a mudança.** Rodada minutos depois do
> merge, deu **83** de performance na `/pt-BR` (execuções 0,64 · 0,83 · 0,83)
> enquanto a `/en` — a mesma página, outro idioma — deu 94. O 0,64 é o custo da
> **regeneração da ISR** logo após o deploy; a página estava fria. Com o site
> aquecido (dois GETs, 0,23 s cada), a mesma rota deu 94 sem uma linha de código
> mudar. Medir logo após o merge mede o deploy, não a página.

> **Esta fase mudou o banco, e foi isso que se decidiu antes da primeira tela.**
> `Favorite` passou a ser `itemType` + `itemId` (o desenho de `articleId`
> nullable caiu: no Postgres `NULL` não colide com `NULL`, e o mesmo briefing
> poderia ser salvo N vezes); `UserPreference` nasceu com o que a interface
> honra; `Subscriber` ganhou `userId`. Decisões e execução nos itens 22 e 23 do
> `docs/progress.md`.

> **"Somente salvos" não é só interface.** Ele junta `Favorite` e `News` e
> devolve resposta **por usuário** — que não pode carregar o `s-maxage` que a
> `/news` carrega hoje, sob pena de vazar recorte entre sessões. Ou vira rota
> autenticada própria (a `/api/favorites` já é isso e já pagina), ou a `/news`
> ganha um caminho sem cache quando o parâmetro aparece.

> **A §19 pede a arquitetura antes da personalização** — mas preferência é dado
> que só existe daqui para frente, como foi a auditoria do briefing na Fase 0.5.
> Tela antes de coluna é um dia de escolha do leitor jogado fora por dia.

## Fase 7 — SEO/performance/accessibility ✅ Concluída em 2026-08-22

```text
[x] NewsArticle JSON-LD             (autoria da fonte na notícia, do site no briefing)
[x] BreadcrumbList                  (mesma lista da trilha visível, que nasceu junto)
[x] news sitemap                    (/news-sitemap.xml, 48h, só pt-BR — ver abaixo)
[x] canonical                       (+ x-default e og:url, num helper só)
[x] metadata                        (o Next não herda openGraph/twitter — ver abaixo)
[x] image audit                     (virou guarda em tests/lib/images.test.ts)
[x] keyboard audit                  (40 focáveis, todos com nome, ordem do DOM)
[x] contrast audit                  (contrast:check — 60 pares, 0 reprovando)
[x] screen reader audit             (as telas de leitura viraram <article>)
[x] Core Web Vitals audit           (Lighthouse do ritual, contra produção quente)
```

> **A medição rendeu mais que o checklist.** Os cinco itens de SEO eram código a
> escrever; as cinco auditorias eram medição — e foi ela que achou quatro
> defeitos que já estavam em produção e que nenhum item nomeava: a imagem OG e o
> ícone do iOS **inalcançáveis** (o matcher do middleware exclui o que tem ponto,
> e rota de metadata gerada não tem extensão), o `/opengraph-image.png` da tela
> do briefing que nunca existiu, o `og:image`/`og:type`/`og:site_name` ausente em
> **toda** página, e o briefing exibindo a véspera. Detalhe no item 25 do
> `docs/progress.md`.

> **A metadata do Next não faz merge profundo.** O layout declara
> `openGraph: { type, siteName, locale }` e `twitter: { card }`; a página que
> declara os seus substitui o objeto inteiro. Cinco das sete páginas públicas
> compartilhavam com `twitter:card: summary` porque as outras duas repetiam o
> valor à mão. O default passou a viver em `pageMetadata`.

> **O news sitemap leva só as URLs `pt-BR`, e é decisão sobre o conteúdo.** As
> fontes RSS são brasileiras: o corpo é o mesmo texto em português nas duas URLs,
> e o que `/en` traduz é a moldura. `news:language` é ISO 639 (`pt`), não o
> BCP-47 da rota. As duas URLs continuam no `sitemap.xml` geral, com o `hreflang`
> dizendo o que elas são.

## Fase 8 — Medição de produto ✅ Concluída em 2026-08-22, auditada em 23/08

> **Esta fase se chamava "Monetização" e foi reescrita em 22/08/2026.** A
> decisão: **não exibir anúncio no site**. O que sobra de monetização é
> planejamento, e está na §21 — aqui ficou o que de fato há para construir.

```text
[x] camada de analytics             (track(), sessão, DNT/GPC — item 27)
[x] ingestão e retenção             (ProductEvent, POST /api/events — item 26)
[x] instrumentação                  (12 eventos com call site — itens 27 e 28)
[x] tela de métricas de produto     (GET /api/metrics/product + aba no
                                     /admin/metrics — item 31)
[x] auditoria de fechamento         (o gate media cold start — item 32)
```

### Por que a fase mudou de nome

O trabalho que sobrou não é monetização: é **ler o que a camada mede**. Hoje o
`ProductEvent` recebe evento e **ninguém o lê** — uma tabela sem leitor, que é a
armadilha que este projeto evita em toda fase.

E não é medição por medição. **É a tela de métricas que produz o número que
destrava patrocínio e Newra Plus** (§21): sem ela, "retomar quando houver base de
usuários recorrentes" fica sem como ser verificado — esperar-se-ia um número que
ninguém calcula.

> **Correção de 22/08/2026: "sessões recorrentes" não é mensurável, e não é
> descuido.** Esta seção dizia que a tela produziria esse número. Ela não pode:
> o `sessionId` vive em `sessionStorage` e morre ao fechar a aba — é exatamente
> isso que mantém a medição anônima e dispensa consentimento. Saber quem voltou
> exigiria um identificador persistente, que é o que a §4 dos slots proíbe.
>
> **O gatilho, corrigido:** os dois números **persistentes** que a tela mostra
> ao lado das sessões — **assinantes ativos da newsletter** (que é literalmente
> o número que um patrocinador pede) e **contas criadas** (quem loga volta por
> definição). Sessões por dia continuam valendo como **volume**, e a tela diz
> isso na própria legenda para os dois não serem confundidos.

### A tela de métricas de produto

**Versão mínima, decidida em 22/08/2026:** consulta o `ProductEvent` cru,
agrupado por tipo e por dia, numa aba nova de `/admin/metrics`. Sem migration.

Não confundir com o que já existe ali: o painel atual mede o **pipeline**
(notícias coletadas, artigo gerado, duração, erros) — saúde de máquina. Este mede
**comportamento de gente**.

| Pergunta | De onde sai |
|---|---|
| O hero funciona, ou é enfeite? | CTR de `story_open` por `source` |
| O briefing é lido ou só aberto? | `article_scroll_90` ÷ `briefing_open` |
| O que procuram e não acham? | `search` com `resultCount: 0` |
| Que editoria puxa audiência? | `category_view` |
| **Tem gente voltando?** | assinantes ativos + contas (persistentes) |
| Quanto tráfego há? | sessões por dia — **volume**, não recorrência |

> **A tabela de agregado diário ficou de fora, e tem data para ser reavaliada.**
> Ela serve para uma coisa: comparar meses **depois** que a retenção de 90 dias
> apagar o evento cru. Como a ingestão começou agora, o problema aparece daqui a
> três meses — e o agregado entra sem retrabalho, porque o expurgo e a etapa 8 do
> pipeline já existem.

### Anúncio: **cancelado por decisão**, não esquecido

Em 22/08/2026 decidiu-se **não exibir anúncio no site**, e o código foi removido
— `AdSlot`, o inventário, o banner de consentimento, o hook de viewability, os
eventos `ad_view`/`ad_click` e o vocabulário de placements. São ~750 linhas e
três suítes que **nunca iriam ao ar**, e código que ninguém executa é a mesma
armadilha do controle que não muda nada: cada mudança de token, de i18n ou do
`cn` teria de mantê-lo verde para sempre.

A engenharia continua legível onde importa — itens **28 e 29** do
`docs/progress.md` narram o que existiu e por quê, e o PR #124 tem o código.

**Consequência direta no consentimento:** sem terceiro, não há tratamento que
exija consentimento prévio. A máquina de decisão (`granted`/`denied`/`unset`)
saiu junto, porque sem banner **ninguém escrevia a decisão** — `readConsent` lia
uma chave que nada gravava. O direito de oposição fica com **DNT e Global
Privacy Control**, que é o mecanismo padrão para medição anônima de primeira
parte. Um controle explícito de opt-out na interface é item em aberto.

## As cinco fases finais — por que a Fase 9 virou cinco

> **Reescrita em 23/08/2026.** A §28 fechava com uma fase só: "Fase 9 —
> Release", oito itens de checklist. Ela virou **quatro**: **9 (backend
> review)**, **10 (frontend review)**, **11 (integração geral)** e **12 (ajustes
> finos e release final)**. Os oito itens originais não sumiram — foram
> distribuídos, e cada um ganhou dono e critério de saída.
>
> **Emendada em 25/08/2026: são cinco.** Entre a 11 e o release entrou a **12
> (refinamento visual e de leitura)**, e a de release passou a ser a **13**. O
> motivo está escrito na seção dela, e resume-se a isto: as três revisões
> olharam **camadas** — servidor, navegador, costura —, e nenhuma delas olhou
> **uma tela com dado de produção dentro**. As abas de `/account` estavam
> desenhadas umas sobre as outras, `/admin` não tinha link em desktop nenhum, e
> 63,7% do acervo imprimia HTML como texto. Nada disso tem sintoma de código:
> build, suíte, Lighthouse e smoke passavam por cima de todos.

**Por que quatro e não uma.** Os oito itens da Fase 9 original eram todos de
*verificação de saída*: regressão visual, QA mobile e desktop, Lighthouse,
smoke, SEO, analytics, canary. Nenhum deles olha para **dentro** do que oito
fases construíram. E o que este projeto aprendeu, fase após fase, é que a
medição de saída acha **o que a tela mostra, não o que o código faz**:

- a Fase 5 foi ao ar com o artigo carregando auditoria e 15 fontes e **servindo
  sem elas** — o schema de resposta era o da V1, e o `fastify-type-provider-zod`
  serializa pelo schema. Nenhum Lighthouse veria isso;
- a Fase 7 achou a imagem OG e o ícone do iOS **inalcançáveis desde que
  existem** — o matcher do middleware exclui o que tem extensão, e rota de
  metadata gerada não tem;
- a Fase 8 **morreu no boot em produção** porque um pacote do workspace não
  emitia JavaScript. `tsc` verde, 1.026 testes verdes, e a rota nova devolvendo
  404 num serviço que respondia 200 em todo o resto;
- a auditoria de 23/08 achou o gate do Lighthouse medindo **cold start**, não
  página — e ia reprovar na segunda às 09:00 UTC, quando ninguém está olhando.

**Três dos quatro já estavam em produção quando foram achados**, e nenhum deles
seria achado por "regressão visual" ou "QA mobile". É essa a lacuna que as
Fases 9, 10 e 11 fecham: revisão **por camada** — backend, frontend, e a costura
entre os dois, que é onde mora o defeito que nenhum dos dois lados enxerga
sozinho.

**E a Fase 12 fecha a lacuna que sobrou, que é a inversa.** As três revisões
por camada leem código; a 12 lê **tela**, com o acervo de produção dentro dela.
Achou o que nenhuma das três podia achar — texto de terceiro renderizado como
marcação, um campo de subtítulo guardando 33 mil caracteres, uma faixa de
navegação colapsada por colisão de nome no CSS gerado. A Fase 13 é o
fechamento: critérios de aceite, dívida decidida, documentação e release.

### Anatomia de uma fase de revisão

Uma fase de revisão tem dois modos de fracassar, e os dois já aconteceram neste
projeto em outra forma:

1. **A revisão que produz lista e não produz mudança.** É a tabela sem leitor da
   Fase 8 e o `AdSlot` que nunca iria ao ar: trabalho que precisa ser mantido
   verde para sempre sem decidir nada. Contra isso, a regra: **todo achado sai
   da fase como uma de três coisas** — correção mergeada, **guarda no CI**, ou
   dívida registrada com o gatilho. Nunca como item de lista.
2. **A revisão que não termina.** "Revisar o backend" não tem critério de
   parada. Contra isso: **cada fase abre com um inventário fechado**, enumerado
   e com número. Revisou os 34 endpoints? O eixo fechou. "Revisou o backend" não
   fecha nada.

E uma regra de triagem, para o achado não virar discussão:

| Classe | O que é | Para onde vai |
|---|---|---|
| **Bloqueia** | dado errado, dado vazando, tela quebrada, boot que morre | corrige na própria fase |
| **Vira guarda** | defeito que o CI podia ter achado e não achou | teste ou passo de workflow, na própria fase |
| **Vira dívida** | custo real, sem sintoma hoje | "O que ficou em aberto", **com o número que a torna urgente** |

**A terceira coluna é a que costuma ser pulada.** Achado sem gatilho numérico
("otimizar quando crescer") volta a ser achado na revisão seguinte. A
`/api/favorites` e a agregação em memória da `/metrics/product` já estão escritas
assim, com o número nomeado — é o padrão a seguir, não a exceção.

### A camada de segurança e testes — obrigatória em todas

**Cada uma destas fases carrega dois eixos que não são opcionais: `S`
(segurança) e `T` (testes e guardas).** Eles existem separados dos outros eixos
por um motivo: são os dois que a pressa de fechar um projeto come primeiro, e
são os dois cujo custo de omissão só aparece depois do release.

**A regra de triagem muda para achado de segurança.** As três classes da tabela
acima valem para o resto; aqui há uma quarta:

> **Achado de segurança não vira dívida sem aceite de risco escrito.** Ou é
> corrigido, ou fica registrado com **qual é o risco, quem o aceita e o que
> mudaria a decisão**. "Fica para depois" não é aceite — é o achado voltando na
> próxima revisão com mais tempo de exposição.

E a costura entre os dois eixos, que é o que os torna permanentes:

> **Todo achado de segurança sai da fase com um teste.** Não o teste que prova
> que o defeito existia — o que prova que **ele continua fechado**. É a
> diferença entre auditoria (acontece uma vez) e guarda (roda em todo PR). O
> `runtime-deps.test.ts` é o modelo: ele não conserta nada, ele impede que volte.

**A superfície é dividida entre as fases, para não haver sobreposição nem
buraco:**

| Fase | Superfície de segurança | O que ela pergunta |
|---|---|---|
| **9** | **o servidor** | entrada, autorização, segredo, dado em repouso, e o terceiro que escreve no produto (a IA) |
| **10** | **o navegador** | cabeçalho de resposta, injeção no DOM, o que vaza no bundle, o que a página carrega de fora |
| **11** | **a costura** | em quem cada metade confia, e por quê — sessão, token, CORS, ambiente |
| **12** | **o que a tela renderiza** | texto de terceiro virando marcação, e o que o modelo escreve chegando ao HTML |
| **13** | **o gate** | o que precisa estar verde para publicar, e o que roda sozinho depois |

E a de testes, na mesma lógica: a **9** e a **10** cuidam da própria camada
(unidade, rota, componente, cobertura); a **11** entrega o que nenhuma das duas
consegue — **o fluxo ponta a ponta**; a **12** cobre **o que a tela renderiza a
partir de dado real**, que é a classe que passa por todas as outras; a **13** não
escreve teste novo, **exige que a suíte inteira esteja verde e que o gate
reprove quando deve**.

> **A medição de cada fase é contra produção**, como manda o ritual do
> `CLAUDE.md`. Revisão que só olha o repositório repete o erro que a auditoria da
> Fase 8 corrigiu: o defeito estava no ar havia dias, e o `git log` não sabia.

---

## Fase 9 — Backend review ✅ Concluída em 2026-08-23 — branch `review/v2-backend`

**Objetivo:** varrer `apps/api`, `packages/database` e `packages/types` atrás do
que oito fases de entrega deixaram passar — contrato, limite, consulta, pipeline
e observabilidade — e sair com **guarda onde hoje há convenção**.

**Inventário fechado:**

| O que | Quanto |
|---|---|
| rotas registradas | **34** (23 GET, 7 POST, 2 PUT, 2 DELETE) |
| serviços | 20 |
| providers | 8 arquivos (3 em `news/`, 3 em `ai/`, 1 de newsletter, 1 de tipos) |
| plugins | 5 (auth, cors, helmet, rate-limit, swagger) |
| modelos Prisma | 12 + 8 enums |
| migrations | 4 |
| etapas do pipeline | 10 |
| suítes / testes | 45 / 575 |

```text
    -- 9.1 contrato HTTP: o schema é o contrato --
[x] as 34 rotas conferidas contra docs/api.md (eram 32 documentadas)
[x] schema de resposta × select do serviço, rota a rota
[x] códigos de erro por rota (401 × 403 × 404) e o que o 500 devolve
[x] guarda de deriva: rota registrada ⇒ rota documentada
[x] OpenAPI: o `servers` e a exposição pública de /api/docs

    -- 9.S segurança do servidor (eixo obrigatório) --
[x] rate limit: o balde é por cliente ou é um só? (medido: era um só)
[x] CORS: métodos declarados × métodos que existem
[x] helmet: decidir a CSP (era `contentSecurityPolicy: false`)
[x] rotas /dev em produção: JOB_SECRET por query string
[x] o JWT: claims, escopo do `purpose`, expiração
[x] o que o error handler devolve num 500 do Prisma
[x] **injeção de prompt**: o feed RSS escreve no mesmo canal das instruções
[x] autorização rota a rota: quem exige ADMIN e quem só exige sessão
[x] dado pessoal em repouso e em log (Subscriber, User, PipelineEvent)
[x] advisories das dependências da API — 21 → 6, com aceite escrito das 6
[x] cada achado sai com o teste que o mantém fechado

    -- 9.3 dados e consultas --
[x] índices × consultas que de fato rodam
[x] replay das 4 migrations em banco limpo
[x] o índice único de News.sourceUrl conferido nos dois ambientes
[x] projeção de crescimento do ProductEvent aos 90 dias
[x] as duas dívidas com gatilho: /favorites e /metrics/product

    -- 9.4 pipeline --
[x] idempotência das 10 etapas, uma a uma
[x] o que é crítico e o que é não-crítico, e o que acontece ao falhar
[x] o dia sem artigo: o que a Home mostra
[x] retenção: os números do cleanup × os números da documentação

    -- 9.5 observabilidade --
[x] error rate e latência da API — **medir**, e não riscar
[x] correlação de requisição (`x-request-id`, propagado do BFF)
[x] o que o PipelineLog não registra e devia

    -- 9.T testes e guardas (eixo obrigatório) --
[x] cobertura por arquivo: onde estão os 6% que faltam
[x] teste que descreve comportamento × teste que repete implementação
[x] a guarda de build (runtime-deps): o que mais ela devia travar
[x] guarda de deriva rota ⇒ documentação (saiu da 9.1)
[x] teste de autorização por rota: 401, 403 e o caminho feliz
[x] o caminho degradado do pipeline coberto, não só o feliz
```

### O que a fase mediu, e o que ela decidiu

**A suspeita central se confirmou.** Três requisições com `X-Forwarded-For`
diferentes na mesma janela de 60s, contra produção: `x-ratelimit-remaining`
**98, 97, 96**. Balde único. A correção é `trustProxy: 1` — e não `true`, que
confiaria na ponta esquerda da cadeia, escrita pelo cliente.

**As quatro migrations nunca tinham rodado do zero**, e agora rodaram: banco
limpo, `migrate deploy`, `migrate diff` contra o `schema.prisma` devolvendo "No
difference detected". O índice único de `News.sourceUrl` está no que as
migrations produzem e não está no banco local — 5 índices contra 4.

**A §26 ganhou os dois números que prometia.** Medir saiu mais barato que
riscar: `GET /api/metrics/http` (admin), em memória, com `since` e
`uptimeSeconds` dizendo de quanto tempo a janela fala. O gatilho para persistir
é mais de uma instância no Render, ou a primeira pergunta que exija comparar
duas semanas.

**Advisories 21 → 6 em `apps/api`** (16 high → 3), por override de `fast-uri`,
`brace-expansion` e `yaml`. Das seis restantes: três pedem `fastify@5` (dívida
da Fase 13, com a high alcançável mitigada na porta), uma é HTTP/2 que a API não
serve, e duas são do `@fastify/static`, que só a UI do Swagger arrastava — e ela
deixou de ser registrada em produção. Aceite de risco escrito no item 34 do
`docs/progress.md`.

**O detalhe fase a fase está no item 34 do `docs/progress.md`.**

### 9.1 O contrato HTTP — "o que não está no schema não existe"

Esta é a regra mais cara já aprendida no backend, e ela **não tem guarda**. O
`article.service` carregava os campos de auditoria e as 15 fontes desde a Fase
0.5; `articleItemSchema` era o da V1; o serializador do Fastify serializa pelo
schema, e o dado ia do banco para o lixo na saída — com a `docs/api.md`
descrevendo o comportamento certo, então nada denunciava a divergência.

A revisão passa rota a rota comparando **três coisas que hoje só um humano
compara**: o `select` do serviço, o schema Zod de resposta, e o que a
`docs/api.md` promete.

**A deriva já existe e é medível.** A `docs/api.md` documenta 32 endpoints; o
`app.ts` registra 34. `POST /api/auth/upsert` está no código e **não está na
documentação** — a rota pela qual todo usuário é criado.

**A saída não é uma lista de correções, é uma guarda.** O Fastify já produz o
documento OpenAPI a partir dos schemas Zod; um teste que enumere as rotas
registradas e exija que cada uma apareça na `docs/api.md` torna a deriva
impossível de mergear. Custa uma suíte pequena e fecha uma classe inteira de
defeito.

### 9.S Segurança do servidor: o balde de rate limit pode ser um só para o site inteiro

**Esta é a suspeita mais séria que a análise levantou, e ela precisa ser medida
antes de ser corrigida.**

O `@fastify/rate-limit` usa `request.ip` como chave por padrão. O `buildApp` não
define `trustProxy`, e o Fastify sem ele devolve o **peer do socket** — que
atrás do proxy do Render não é o visitante. Some a isso o desenho do frontend:
**todo o tráfego server-side sai da Vercel**, e a ingestão de eventos passa pela
rota `/api/events` do Next justamente para o `sendBeacon` não precisar de
preflight. Ou seja, a maior parte das requisições chega à API de um punhado de
IPs de saída, não do IP de quem está lendo o site.

Se a suspeita se confirmar, a consequência é direta e silenciosa: **o limite de
30/min da `/api/events` vira um teto global de ingestão**, e a tela de métricas
que fechou a Fase 8 passa a subcontar sem nenhum sinal — 429 numa chamada de
`sendBeacon` não tem retorno para o cliente ler. É o mesmo padrão de defeito que
este projeto já pagou três vezes: o sintoma não se parece com a causa.

**Como medir, e não deduzir:** duas máquinas em redes diferentes batendo na
`/api/health` dentro da mesma janela de 60s, comparando o `x-ratelimit-remaining`
das duas. Contador compartilhado ⇒ balde único. (A sondagem de 23/08 mostrou
`99` na primeira requisição de uma janela fria, o que diz que o balde **não**
está sendo consumido pelo health check do Render — e não resolve a pergunta.)

O resto do eixo é inventário, e três itens já têm achado:

- **`methods: ['GET', 'POST']` no CORS, e existem 2 PUT e 2 DELETE.** Funciona
  hoje porque toda mutação passa pelo BFF do Next, server-side, onde CORS não se
  aplica. Isso é uma **dependência não declarada** entre as duas metades — e ela
  é revisitada na Fase 11, porque é lá que ela vive.
- **`/api/docs` é público em produção, e o `servers` do OpenAPI anuncia
  `http://<HOST>:<PORT>`** — em produção, `http://0.0.0.0:3001`. Ou o documento
  aponta para a URL real, ou a UI não fica pública. Do jeito que está, é uma
  vitrine que dá o endereço errado.
- **O painel `/dev/dashboard` aceita o `JOB_SECRET` por query string.** Secret em
  query string entra em log de acesso, em histórico e em `Referer`. Header ou
  nada.
- **O `purpose` do JWT é verificado numa rota e ignorado nas outras.** O token de
  `auth-upsert` passa no `authPlugin` de `/api/favorites` do mesmo jeito. Hoje os
  dois são assinados pelo mesmo servidor de confiança, então não há exploração —
  mas a claim existe justamente para escopar, e escopo que só uma rota honra não
  é escopo.

#### O feed escreve no mesmo canal das instruções

**Este é o risco de segurança mais próprio deste produto, e ele não tem
mitigação nenhuma hoje.**

O `formatNewsItems` concatena título, fonte, descrição e conteúdo de cada
notícia num texto corrido, e esse texto é colado logo abaixo de "NOTÍCIAS DO
DIA:" no `ARTICLE_USER_PROMPT`. **Não há delimitador, não há escape, e não há
fronteira dizendo ao modelo onde acabam as instruções e começa o material.** O
`stripHtml` limpa marcação — não limpa instrução.

O que torna isso diferente de um risco teórico é o que vem depois: o texto
gerado **vai ao ar sozinho**. Não há revisão humana entre a resposta do modelo e
a publicação — o Stage 7 persiste, o 7.5 manda por e-mail para os assinantes, e
a Home passa a exibir. Uma manchete construída para instruir o modelo entra pela
mesma porta por onde entra a notícia real, e sai assinada pelo site.

A superfície é grande e não é controlada por este projeto: 12 feeds RSS mais a
NewsData.io, centenas de itens por dia, texto escrito por terceiros.

A revisão não precisa resolver o problema inteiro — precisa **decidir a
fronteira**, e as opções são conhecidas e baratas:

- delimitar o material com marcadores explícitos e instruir o modelo a tratar
  tudo entre eles como **dado, nunca como instrução**;
- higienizar na ingestão o que se parece com instrução (o `feed-text.ts` já é o
  lugar onde o texto do feed é limpo uma vez só);
- validar a **saída**: o `parseMarkdownResponse` já espera um formato — título
  `# `, corpo em Markdown. Saída fora do formato é sinal, e hoje ela é aceita.

O teste que fica é o da regra: um item de feed com texto de instrução no título
**não muda a forma da saída**.

### 9.3 Dados: o que o índice promete e o que a consulta pede

O schema é bem documentado — os comentários do `Favorite`, do `BriefingSource` e
do `ProductEvent` explicam decisões que nenhum ORM explicaria. O que falta é
confrontá-lo com o que roda.

- **Replay das migrations em banco limpo.** A Fase 0 já achou uma `0_init` que
  não replicava (banner do CLI colado no SQL) e um `migration_lock.toml`
  faltando. São quatro migrations agora, e o banco local está **baselinado com
  `migrate resolve`** — que marca como aplicada sem executar o SQL. Ou seja:
  **ninguém nunca rodou as quatro do zero.** Uma branch do Neon resolve isso sem
  tocar em produção — cria, aplica as quatro, compara o schema resultante com o
  `schema.prisma`, descarta.
- **O índice único de `News.sourceUrl` existe em produção e não no local.** A
  revisão confirma em que estado cada ambiente está e escreve o resultado — hoje
  isso é conhecimento oral registrado numa armadilha do `CLAUDE.md`.
- **As duas dívidas com gatilho ganham o número.** A `/api/favorites` resolve os
  salvos inteiros antes de paginar; a `/metrics/product` agrega em memória a
  partir de uma consulta só. As duas estão documentadas como conscientes — o que
  falta é **medir o ponto em que doem**: quantos favoritos por conta, quantos
  eventos na janela de 90 dias. Sem o número, a dívida é uma frase.

### 9.4 O pipeline: o que acontece no dia em que ele não roda

Dez etapas, com retry, fallback de IA, expurgo e renormalização. O que a revisão
persegue não é o caminho feliz — é o degradado:

- **um dia sem artigo.** O acervo tem gap conhecido (89 artigos em 90 dias). A
  Home chama `getHome`: o que ela desenha quando o briefing do dia não existe?
- **falha parcial.** A newsletter é etapa 7.5 e não-crítica; o cleanup é etapa 8.
  Se a 6 falha, a 8 roda? Se rodar, ela apaga notícia de um dia que não gerou
  briefing?
- **idempotência.** O `NewsletterLog.date` protege o envio duplicado; o
  `skipDuplicates` protege a persistência; a renormalização é idempotente por
  desenho. Cada uma dessas afirmações vale um teste que ainda não existe, ou a
  confirmação de que já existe.
- **retenção.** News 30d, PipelineLog 30d, Article 90d, ProductEvent 90d por
  `occurredAt`. Conferir os números do código contra os quatro lugares que os
  documentam.

### 9.5 Observabilidade: §26 promete dois números que ninguém calcula

A §26 lista, como métrica técnica de sucesso da V2, **error rate** e **API
latency**. Uma varredura por `latency`, `responseTime`, `errorRate`, `p95` e
`onResponse` em `apps/api/src` não devolve nada: **não há instrumentação
nenhuma**. Existe observabilidade rica do *pipeline* (PipelineLog,
PipelineEvent, painel dev) e zero da *API como serviço*.

É a armadilha da tabela sem leitor, invertida: **um número prometido que ninguém
produz**. A regra deste projeto já resolveu um caso idêntico — a §26 tinha
"sessões recorrentes", e ele foi **riscado com o motivo** quando ficou claro que
a camada não podia medi-lo.

A decisão desta fase é a mesma bifurcação: **medir ou riscar.** Medir é barato
(um hook `onResponse` com rota, status e duração, e a etapa 9 agregando o dia);
riscar é honesto. O que não pode é continuar na lista sem dono — a Fase 13 vai
cobrar os dois números.

### 9.T Testes e guardas: 94% de cobertura não é a pergunta

A cobertura do backend é 94% de linhas, muito acima do piso de 70. A pergunta
útil não é a porcentagem, é **o que os testes afirmam**. A guarda de build
(`tests/build/runtime-deps.test.ts`) é o exemplo do que se procura: ela é
estática de propósito, porque `turbo test` não constrói o `apps/api` e uma
guarda que dependesse do `dist` nunca rodaria no CI. É esse tipo de teste que a
fase quer multiplicar — e a §9.1 já nomeou o próximo.

Três lacunas que a análise já enxerga:

- **Autorização não tem matriz.** Cada rota protegida tem teste, mas não há um
  lugar onde se leia *quem pode o quê*. Uma tabela — rota × anônimo × usuário ×
  admin — vira teste parametrizado, e é o que impede que uma rota nova nasça sem
  guarda. Foi assim que a `DELETE /api/news/:id` ganhou o 403 no P3.
- **O caminho degradado do pipeline é pouco coberto.** A §9.4 lista quatro
  cenários (dia sem artigo, falha parcial, idempotência, retenção). Cada
  afirmação daquelas ou tem teste, ou vira teste.
- **Achado de segurança sem teste é auditoria, não guarda.** Vale para os quatro
  itens da §9.S: rate limit por cliente, secret fora da query string, escopo do
  `purpose` e a fronteira do prompt. Quatro achados, quatro testes.

> **Saída da Fase 9.** Correções que bloqueiam, mergeadas; guardas novas, verdes
> no CI; dívida com gatilho numérico. **A verificação é contra produção** e, como
> backend não muda pixel, ela é a do `CLAUDE.md`: probe de uma rota que só existe
> na versão nova (o `uptime` mente sobre deploy) e gate do Lighthouse verde — a
> API acordada é pré-requisito das duas rotas que o gate mede.

---
## Fase 10 — Frontend review ✅ Concluída em 2026-08-24 — branch `review/v2-frontend`

**Objetivo:** varrer `apps/web` atrás do que a entrega tela a tela não vê —
fronteira servidor/cliente, acessibilidade além do que o Lighthouse mede,
consistência de token, estado e erro, i18n e peso de JavaScript.

> **O detalhe está no item 35 do `docs/progress.md`.** O resumo: **onze achados**
> — a 404 que ia ao ar sem uma linha de CSS, o site sem cabeçalho de defesa
> nenhum, a CLI de scaffolding na árvore de produção (47 das 83 advisories),
> quatro lugares onde "a API não respondeu" virava "não existe", o
> `prefers-reduced-motion` declarado e desobedecido, e o piso de cobertura que
> media um app só. **Duas propostas do próprio plano foram medidas e caíram**:
> derivar os hosts de imagem das fontes configuradas (quebraria 22,4% das
> imagens) e descer a fronteira do `story-image` (+0,33 kB, não −).
> **451 testes em 50 suítes → 522 em 57.**

**Inventário fechado:**

| O que | Quanto |
|---|---|
| páginas | **15** (rotas `[locale]`) |
| componentes | **75**, dos quais **53 são `'use client'`** |
| módulos de `lib/` | 21 |
| rotas de BFF (`app/api/`) | 12 |
| chaves de i18n | 337 por locale, 2 locales |
| telas na baseline visual | 12 rotas, 3 larguras, 42 imagens |
| suítes / testes | 50 / 451 |

```text
    -- 10.1 fronteira servidor/cliente --
[x] os 52 'use client': 44 causa, 6 so-i18n, 2 contagio estrutural
[x] first-load JS por rota (87,5 kB na /about a 167 kB na /news/[id])
[x] a fronteira desce ate a folha interativa onde der — medido que nao paga

    -- 10.2 acessibilidade alem do Lighthouse --
[x] foco na troca de pagina: ia para lugar nenhum (useResultsFocus)
[x] anuncio de resultado (aria-live) na /news e agora tambem na /article
[x] telas novas: formulario de conta, preferencias e metricas conferidos
[x] zoom 200% (viewport 640) sem estouro; prefers-reduced-motion era ignorado
[x] erro de formulario: anunciado uma vez e orfao do campo (aria-describedby)

    -- 10.3 token e consistencia visual --
[x] escape de token: `bg-white`/`text-black`/cinzas neutros passavam batido
[x] dark mode nas 12 rotas da baseline (eram 3) — 15 imagens escuras
[x] os sete criterios visuais da §31, um a um, com evidencia

    -- 10.4 estado, dado e erro --
[x] a matriz de 15 linhas x 4 colunas, e ela virou teste
[x] todo initialData auditado; 4 catches pessimistas corrigidos
[x] staleTime x revalidate: contam coisas diferentes, e de proposito

    -- 10.5 i18n --
[x] 337 = 337, zero orfa, zero faltando (a guarda ja existia e passa)
[x] plural e locale nas chaves novas (`unavailable*`, `article.resultCount`)
[x] hreflang reciproco e a decisao pt-BR-only do news sitemap, reconfirmados

    -- 10.6 performance de frontend --
[x] LCP da /news: e o hero, com fetchpriority=high — 65% e Load Delay
[x] CLS medido em 0 nas 5 rotas do gate
[x] remotePatterns: aceite de risco escrito, com o numero e a saida nomeada
[x] o audit da /news lido: `uses-responsive-images` era `sizes`, nao aquecimento

    -- 10.S seguranca do navegador (eixo obrigatorio) --
[x] cabecalhos de resposta: os seis, com guarda estatica
[x] CSP do site — 63 scripts inline medidos, e a decisao escrita
[x] os dois dangerouslySetInnerHTML travados, e o terceiro reprova
[x] NEXT_PUBLIC_*: duas, as duas enderecos, com guarda
[x] link externo com rel noopener — 4 de 4, virou guarda
[x] cookie da sessao: flags conferidas, duracao agora explicita
[x] advisories: 83 -> 36 movendo a CLI; as 8 high do `next` com aceite escrito

    -- 10.T testes e guardas (eixo obrigatorio) --
[x] limiar de cobertura no web: 70%, com 72,35% medidos
[x] a matriz de 10.4 virou teste, nao tabela
[x] guarda de acessibilidade na suite (movimento, foco, heading, formulario)
[x] os achados de 10.S saem com teste — quatro suites em tests/security/
```

### 10.1 A fronteira servidor/cliente — o Risco 3 da §32, medido

A §32 nomeia o Risco 3: "transformar tudo em client-side", com mitigação
"Server Components por padrão". Hoje **53 dos 75 componentes** são `'use
client'` — e na camada editorial, que é o coração da V2, são **21 de 28**.

**Isso não é descuido, é estrutural**, e o `apps/web/CLAUDE.md` já explica a
causa: componente importado por client component *precisa* ser client, e o
`useTranslations` do next-intl é client. Uma folha interativa no topo da árvore
arrasta tudo abaixo dela.

Por isso o eixo **não é "reduzir a contagem"** — contagem não é sintoma. É:

1. **medir o peso**, lendo o first-load JS por rota do output do `next build`;
2. **separar causa de contágio** — quais componentes são client porque têm
   estado ou evento (causa) e quais são client porque alguém acima os importou
   (contágio);
3. **descer a fronteira** onde o contágio for evitável, e **registrar por que
   não deu** onde não for.

A regra que sai da fase: *a fronteira vive na menor folha interativa*. Sem um
número de partida, "otimizar client components" é opinião.

### 10.2 Acessibilidade: o Lighthouse já dá 100, e isso não é o teto

Cinco rotas medidas, **acessibilidade 100 em todas**. Também é verdade que
auditoria automática cobre uma fração do WCAG — e este projeto já reprovou duas
vezes em `heading-order`, que é justamente do que ela pega.

O que a revisão persegue é o que a máquina não vê:

- **Foco na navegação.** A `/news` da Fase 4 pôs o estado na URL: trocar
  categoria, buscar ou paginar re-renderiza a lista. Para quem navega por
  teclado ou lê por leitor de tela, **para onde vai o foco**, e como a pessoa
  sabe que o resultado mudou? Contagem que muda em silêncio é a mesma promessa
  quebrada da pílula "Todas" — só que para quem não vê a tela.
- **As telas novas.** A auditoria de teclado da Fase 7 mediu 40 focáveis. Depois
  dela nasceram o ecossistema de conta (Fase 6 entrou antes, mas as telas de
  preferência têm formulário) e a tela de métricas de produto (Fase 8). Elas não
  passaram por leitor de tela.
- **Zoom a 200% e `prefers-reduced-motion`**, nas 15 páginas. A §14 define motion
  design; o respeito à preferência do sistema é o que falta confirmar tela a
  tela.
- **Erro de formulário.** Há quatro formulários (inscrição, preferências,
  newsletter da conta, busca). Como cada um anuncia erro?

### 10.3 Token e dark mode: a baseline cobre duas telas de doze

A suíte já proíbe boa parte do desvio — `design-tokens.test.ts` e `cn.test.ts`
existem por causa de dois defeitos reais (o `tailwind-merge` que não distingue
tamanho de cor, e o token cru que some do HTML sem erro). O que falta é
cobertura de **superfície**.

**O dark mode é o buraco medível.** A baseline versionada tem 42 imagens, e
**apenas 6 são de tema escuro** — `home`, `news` e `article-detail`, em 375 e
1440. **As outras nove rotas nunca foram capturadas no escuro**, e o dark mode é
onde token errado aparece: um `bg-white` esquecido é invisível no claro e
ilegível no escuro. Foi exatamente esse o bug da Fase 5 da V1.

Decisão do eixo: **ou a captura de dark passa a cobrir as 12 rotas** (o conjunto
vai para ~66 imagens, e o diff continua determinístico), **ou fica escrito quais
telas não têm referência escura e por quê**.

Aqui também se fecham os sete critérios visuais da §31, que estão todos
desmarcados desde que o documento nasceu. Cada um vira evidência: captura,
medição, ou risco.

### 10.4 A matriz de estado — quinze rotas, seis com fronteira

Das 15 páginas, **6 têm `loading.tsx` ou `error.tsx`**:

| Rota | loading | error | not-found |
|---|---|---|---|
| `/[locale]` | sim | sim | sim |
| `/news`, `/article` | sim | sim | — |
| `/news/[id]`, `/article/[date]` | sim | — | sim |
| `/admin/metrics` | sim | sim | — |
| **as outras nove** | — | — | — |

Entre as nove estão `/favorites` e as três telas de conta — autenticadas,
`force-dynamic`, e com busca no cliente. **A ausência pode estar certa**: se o
componente desenha o próprio esqueleto e o próprio erro (o `favorites-list` faz
isso), a fronteira de rota seria redundante. O que falta não é
necessariamente arquivo — **é a resposta escrita**. Hoje ninguém sabe dizer,
sem abrir o componente, o que cada tela mostra enquanto carrega e quando falha.

A matriz é o entregável: quinze linhas, quatro colunas (carregando, erro,
vazio, não encontrado), preenchida com onde o estado mora.

E junto dela, o item que já custou uma tela em produção: **todo `initialData`
auditado**. A regra está escrita (`prefetch` falha em `undefined`, nunca em
valor vazio; `.catch(() => null)` só onde o servidor renderiza), e a revisão
confere se ela vale em todos os pontos, não só na `/news` que a ensinou.

### 10.5 i18n: paridade de chave não é paridade de sentido

A suíte já garante que as 337 chaves existem nos dois locales e que todo
namespace usado existe. O que ela não garante é que o `en` **diz a coisa certa**
nas telas que nasceram depois — e que não há string órfã acumulada de oito
fases. Duas varreduras baratas, uma decisão registrada (o news sitemap é
pt-BR-only, e é decisão sobre conteúdo, não descuido).

### 10.6 Performance: o otimizador de imagem aceita qualquer host

> **Medido em 24/08/2026, no fechamento da Fase 9, e já é o gate reprovando.**
> A `/news` mede `[89, 90, 81]` de performance, e a mediana está **abaixo do
> piso de 90**. A causa foi isolada e não é a API: **56 requisições na página,
> zero para a API**, e a mais lenta é o próprio documento em 214 ms. O que
> derruba o score é o **LCP de uma `<img>` de card em 4.390 ms**, servida por
> `/_next/image` a partir de `s2-valor.glbimg.com`, com
> `uses-responsive-images` e `image-delivery-insight` reprovando.
>
> Ou seja: este eixo abre com **um número vermelho no CI**, e não com uma
> suspeita. O `remotePatterns: hostname: '**'` deixou de ser só risco de
> superfície aberta — é a mesma decisão que faz o produto servir imagem de
> origem que ele não controla, no tamanho que ela vier.
>
> As rotas que não dependem de imagem de terceiro (`/about`, `/article`) medem
> 96–98 com variância de 2 pontos, o que dá o teto que a `/news` deveria
> alcançar.


`next.config.js` declara `remotePatterns` com `hostname: '**'` — **qualquer host
HTTPS**. Isso é o que faz o acervo funcionar (as imagens vêm de dezenas de
veículos, e a lista muda quando `rss-sources.ts` muda), e é também um
otimizador de imagem aberto: qualquer um pode pedir ao domínio do site que
processe e sirva imagem de terceiro, no custo e no nome do projeto.

Não há resposta óbvia. As saídas são **derivar a lista de hosts das fontes
configuradas** (o dado já existe, e o acoplamento é honesto), ou **aceitar e
registrar** com o gatilho — que aqui é custo de otimização na Vercel.

O resto é medição por rota: qual elemento é o LCP e se ele tem prioridade;
onde o espaço reservado protege o CLS (a lição que sobreviveu à remoção do
anúncio, hoje aplicada no `story-image` e no `story-card`); e o audit da
`/news`, que raspa o piso em 90 e já está sinalizada para não ser confundida
com cold start se cair.

### 10.S Segurança do navegador: a API está protegida, o site não

**Medido em produção, em 23/08:**

| Cabeçalho | API (`onrender.com`) | Site (`vercel.app`) |
|---|---|---|
| `strict-transport-security` | sim | sim (da Vercel) |
| `x-content-type-options` | `nosniff` | **ausente** |
| `x-frame-options` | `SAMEORIGIN` | **ausente** |
| `referrer-policy` | `no-referrer` | **ausente** |
| `cross-origin-opener-policy` | `same-origin` | **ausente** |
| `content-security-policy` | desligada no helmet | **ausente** |

A assimetria é o achado: **o helmet protege a superfície que quase não tem
navegador — JSON servido para uma máquina — e a superfície que as pessoas de
fato abrem não tem nenhum cabeçalho de defesa**, porque o `next.config.js` não
declara `headers()`. Não é descuido de configuração: é a consequência de a
segurança ter sido pensada no app onde a biblioteca existia.

O que a fase decide:

- **O conjunto base** — `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options` (ou `frame-ancestors`) e `Permissions-Policy` — é barato e
  não tem contraindicação. Entra.
- **A CSP é a decisão de verdade, e ela tem um obstáculo concreto**: o
  `theme-init` injeta um script **inline** de propósito (é o que evita o FOUC de
  tema, e mover para arquivo externo devolveria o flash). Uma CSP sem
  `unsafe-inline` exige nonce ou hash — o hash é estável porque o script é uma
  constante. A alternativa honesta é começar em `Content-Security-Policy-Report-
  Only`, medir o que quebra, e só então aplicar.
- **Os dois `dangerouslySetInnerHTML` ficam auditados e travados.** Hoje são o
  `json-ld` (payload montado por `lib/json-ld.ts` e serializado com escape) e o
  `theme-init` (constante estática). Nenhum dos dois recebe conteúdo externo — e
  é exatamente isso que uma guarda deve congelar, porque o terceiro uso é que
  seria o problema.

> **Uma coisa que a revisão confirmou e vale registrar como saudável:** o
> `article-body` **não é um renderizador de Markdown** — ele quebra o texto em
> blocos e devolve nós de React. A decisão foi tomada por peso de bundle —
> `react-markdown` custaria ~40 kB na rota mais lida —, e ela **também é a
> mitigação de XSS** do texto gerado
> por IA: não há caminho de HTML externo para o DOM. Se um dia o prompt passar a
> pedir listas ou destaques e alguém trouxer `react-markdown`, essa propriedade
> se perde junto — e é isso que precisa estar escrito, não a ausência de defeito
> hoje.

Os quatro links externos (`source-badge`, `source-list`, `news-detail`, `about`)
já têm `rel='noopener noreferrer'` — **4 de 4**. Resultado limpo vira guarda, não
comemoração: um teste que reprove `target='_blank'` sem `rel` custa cinco linhas
e vale para todo componente futuro.

### 10.T Testes e guardas: a cobertura do web não existe

O CI roda `pnpm turbo test:coverage` com limiar de 70%. **O `@newranews/web` não
tem o script `test:coverage`** — então o passo mede só a API, e o badge de
cobertura do README fala por um app só. São 451 testes no web sem piso nenhum: o
número pode cair sem que nada reprove.

Isso é guarda, não relatório. Acrescentar o script e escolher o piso a partir do
que hoje é medido — o padrão que a API já seguiu quando o piso de 70 foi fixado
com 94 medidos.

Duas guardas a mais, que vêm dos outros eixos:

- **A matriz de estado da §10.4 vira teste**, não tabela. Tela que promete
  esqueleto e não desenha esqueleto é regressão silenciosa.
- **Acessibilidade dentro da suíte.** O Lighthouse mede a página montada, uma
  vez por semana, em cinco rotas. Uma verificação de a11y no teste de componente
  pega a classe que o `heading-order` já reprovou duas vezes — no PR, e não na
  segunda de manhã.

> **Saída da Fase 10.** A matriz de estado preenchida, o dark mode decidido, o
> peso de JS por rota registrado, **os cabeçalhos de segurança no site** e o
> piso de cobertura do web no CI, mais os critérios visuais da §31 com
> evidência. **Verificação:** Lighthouse por rota + **recaptura da baseline** —
> esta fase mexe em pixel, ao contrário da 9.

---
## Fase 11 — Integração geral review ✅ Concluída em 2026-08-24 — branch `review/v2-integration`

**Objetivo:** revisar **a costura** — o que só quebra quando as duas metades se
encontram, e que nenhuma das duas revisões anteriores consegue ver sozinha.

Esta é a fase mais importante das quatro, e a razão é histórica: **os quatro
defeitos mais caros deste projeto foram todos de costura.** O schema que
descartava o que o serviço carregava; o pacote que compilava e não emitia; o
middleware que engolia a rota de metadata; o gate que media o cold start da API
ao medir a página. Em nenhum dos quatro o backend estava errado sozinho, nem o
frontend.

**Inventário fechado** — reconferido contra o código e contra produção em
24/08/2026, ao fechar a Fase 10. Duas linhas derivaram desde que a §28 foi
escrita e estão corrigidas abaixo: o BFF tem **6** rotas por `proxyToApi` (eram 5)
e o `Cache-Control` editorial cobre **4** rotas (eram 5). O resto confere.

| Costura | Quanto |
|---|---|
| tipos compartilhados (`packages/types`) | o contrato inteiro |
| rotas de BFF no Next | 12 (**6** delas via `proxyToApi`) |
| chamadas server-side → API | prefetch de cada página estática |
| chamadas client-side → API | as que passam por `fetchWebApi` |
| hops da camada de analytics | 6, do clique ao gráfico |
| fluxos de usuário (§25) | 3 vivos + o de admin |

```text
    -- 11.1 o contrato de tipos, ponta a ponta --
[x] schema Zod × tipo compartilhado, rota a rota (assertContract em 20 respostas)
[x] estender a guarda SchemaMatchesSharedType além de /events
[x] os dois enums Category: a ponte continua num lugar só? (sim, e agora com guarda)

    -- 11.2 a camada BFF --
[x] as 12 rotas: auth, status, formato de erro (3 tinham cópia própria do proxy)
[x] timeout de fetch (hoje não existe em lugar nenhum)
[x] CORS × BFF: declarar o acoplamento ou consertar a lista

    -- 11.3 latência, cache e cold start --
[x] quem de fato espera a API acordar — medido: **hoje ninguém, a API não hiberna**
[x] Cache-Control: medido `cf-cache-status: DYNAMIC` — proposta derrubada
[x] cache hit rate do CDN — riscado, com a medição no lugar

    -- 11.T smoke E2E (eixo obrigatório de testes) --
[x] configurar o Playwright (instalado, sem config e sem spec)
[x] os 3 fluxos vivos da §25 + o de admin (29 specs em 5 arquivos)
[x] onde roda: pós-deploy contra produção, e o que faz ao reprovar
[x] os casos negativos: anônimo, sessão expirada, papel errado

    -- 11.5 analytics ponta a ponta --
[x] os 12 eventos: cada um chega ao banco? (cadeia provada, `accepted: 1`)
[x] tipo instrumentado que nunca apareceu = call site morto
[ ] a primeira leitura honesta da tela de métricas — **passa para a 13.2**

    -- 11.6 auth e sessão ponta a ponta --
[x] sessão do next-auth × expiração do JWT × o que o usuário vê
[x] role ADMIN: as três portas concordam? (a da API tinha 4 cópias)
[x] o caminho do ADMIN_EMAILS, do login ao banco

    -- 11.7 deploy e ambiente --
[x] paridade de env: render.yaml × o que a API exige
[x] a ordem dos dois deploys, e a rota nova que nasce sem dado (é o smoke)
[x] o job de migration × o boot da API

    -- 11.S segurança da costura (eixo obrigatório) --
[x] em quem cada metade confia, e por quê — o mapa, no plugin de CORS
[x] o BFF é a única porta autenticada? provar, não supor
[x] segredo compartilhado: rotação, e o que quebra ao rodar (runbook em setup.md §9.1)
[x] a rota de eventos: anônima de propósito, e sem identidade acidental
[x] LGPD: o dado que sai do produto (newsletter, e-mail, log)
```

> **O único item que não fechou, e por quê.** *"A primeira leitura honesta da
> tela de métricas"* exige credencial de admin de produção, que é do dono do
> projeto e não do agente que conduziu a fase. Tudo que **prepara** essa leitura
> foi feito e está registrado no item 36 do `docs/progress.md`: a cadeia de
> ingestão provada ponta a ponta, o balde compartilhado medido, e o número que
> diz quando a subcontagem começa. A leitura em si passa para a **13.2**, que já
> é o eixo de "o que a §26 promete e ninguém mede".

### 11.1 O contrato de tipos: uma guarda existe, e só numa rota

`packages/types` é a fonte única — a API valida com Zod, o web consome o tipo
TypeScript. **Nada verifica que os dois concordam**, exceto num lugar:
`routes/events/schemas.ts`, onde `SchemaMatchesSharedType` é uma guarda de
compilação. E ela **já pagou o próprio custo**: na primeira execução reprovou um
`z.nativeEnum(Category)` importado do Prisma, porque aquele `Category` é união
de literais e o de `packages/types` é enum nominal.

Todas as outras rotas podem derivar em silêncio: o schema diz uma coisa, o tipo
diz outra, os dois compilam, e o defeito aparece como campo `undefined` numa
tela — ou, pior, como campo que **existe no tipo e nunca chega**, que foi
exatamente o caso do artigo na Fase 5.

**Estender essa guarda às rotas editoriais, de notícia, de artigo e de conta é o
item de maior valor da fase.** É a diferença entre uma convenção mantida por
disciplina e uma que o `tsc` recusa quebrar.

### 11.2 A camada BFF: doze rotas e nenhum timeout

O desenho está certo e bem justificado — o browser nunca fala autenticado com a
API, `proxyToApi` concentra a assinatura do JWT, e a rota de eventos existe
justamente porque o `sendBeacon` não sabe fazer preflight. O que a revisão
persegue são as bordas:

- **Nenhuma chamada `fetch` do web tem timeout.** Nem em `lib/api.ts`, nem em
  `api-proxy.ts`, nem nas rotas de BFF. Some isso ao plano free do Render, que
  hiberna: uma API dormindo (ou pendurada) segura a função da Vercel até o
  limite dela. Um `AbortSignal.timeout` com fallback explícito transforma
  "página que nunca responde" em "página que diz que não conseguiu".
- **A lista de métodos do CORS.** O backend permite `GET` e `POST`; existem 2
  PUT e 2 DELETE, e eles só funcionam porque passam pelo BFF. Ou o acoplamento
  vira comentário no plugin de CORS ("mutação não é chamada do browser, por
  desenho"), ou a lista passa a refletir a superfície real. O que não serve é o
  estado atual, em que a política está certa por acidente.
- **O formato do erro.** As 12 rotas repassam o status; repassam o *corpo* de
  erro do mesmo jeito? Quem lê `{ error }` e quem lê outra coisa?

### 11.3 O cold start: o gate foi consertado, o leitor não

A auditoria da Fase 8 consertou **a medição** — o workflow aquece antes de
medir, e o gate ficou verde em 92·90·97·97·91. Ela não consertou **a causa**: a
API continua hibernando com ~15 min sem tráfego, e a primeira requisição que
dispara a regeneração da ISR continua esperando 4,9 s contra 0,22 s de uma
quente.

A pergunta que a fase precisa responder — **medindo, não supondo** — é *quem*
espera. A ISR do Next serve a cópia velha e regenera atrás; se isso valer em
todos os casos, ninguém espera, e o custo é só do gate (já resolvido). Se houver
caminho em que o visitante espera (primeira renderização de uma rota, cache
despejado, deploy novo), então há um leitor real pagando 5 s de espera às 3 da
manhã — e aí a saída é keep-alive, plano pago, ou aceitar com o número escrito.

Junto disso, dois números que a §26 promete:

- **`Cache-Control` existe em 5 rotas** (`/home`, `/trending`, `/news/facets`,
  `/news/:id/related`, `/favorites`) e **não existe na `/api/news`**, que é a
  mais chamada do acervo. A decisão de header-por-rota é boa e está justificada;
  falta aplicá-la onde vale.
- **Cache hit rate** é métrica de sucesso na §26 e ninguém a mede. Mesma
  bifurcação da §9.5: medir ou riscar.

### 11.T O smoke E2E: o Playwright está instalado e nunca foi usado

`@playwright/test` está no `devDependencies` do web desde alguma fase. **Não há
`playwright.config`, não há um único `.spec.ts`.** Uma dependência instalada que
não executa nada é a mesma armadilha do código que ninguém roda — só que sem nem
o benefício de já ter sido escrita.

O escopo sai da §25, com o Fluxo 4 fora (Premium está adiado):

| Fluxo | O que o smoke prova |
|---|---|
| **Visitante** | Home carrega, hero abre matéria, briefing abre, categoria filtra |
| **Leitor recorrente** | busca devolve, filtro bate com a contagem, paginação anda |
| **Newsletter** | inscrição responde, cancelamento por token responde |
| **Conta** | login, salvar, `/favorites` lista, preferência persiste |
| **Admin** | `/admin/metrics` carrega para ADMIN e barra o resto |

Duas decisões de desenho, e elas importam mais que a lista:

1. **Onde roda.** A cultura deste projeto é medir contra produção, e três dos
   quatro defeitos caros estavam no ar. Um smoke **pós-deploy contra produção**
   pega a classe certa de problema — inclusive a que a §11.7 descreve, dos dois
   deploys que não terminam juntos. Um E2E contra build local no CI pega
   regressão antes do merge, mas precisa da API e do Postgres de pé (o job de
   testes já sobe Postgres, então é viável). **A recomendação é começar pelo
   pós-deploy**: é o que teria achado a `/news` com as oito categorias zeradas.
2. **O que ele faz ao reprovar.** Smoke que falha e não avisa ninguém é o gate
   de segunda 09:00 outra vez. Falhar o workflow é o mínimo; o passo seguinte é
   decidir se reprovação pós-deploy dispara rollback (§13.6).

Os fluxos com login pedem uma conta de teste e um segredo — o mesmo tipo de
decisão que o `JOB_SECRET` e o `CRON_SECRET` já resolveram.

### 11.5 Analytics: seis hops, e a primeira leitura honesta

O evento atravessa: clique → `track()` → `sendBeacon` → rota `/api/events` do
Next → `POST /api/events` da API → Postgres → `/api/metrics/product` → gráfico.
**Cada hop pode perder tudo em silêncio** — `sendBeacon` não devolve status, a
rota do Next responde 502 para o log e ninguém lê, e um 429 da API é
indistinguível de "ninguém clicou".

Duas verificações concretas:

- **Os 12 eventos, um a um**, do call site até a linha no banco. Tipo
  instrumentado que **nunca apareceu** no acervo é call site morto — e é
  exatamente o tipo de coisa que só a leitura acha, porque o código compila.
- **A primeira leitura honesta da tela.** A ingestão entrou no ar em 22/08; na
  Fase 11 haverá algumas semanas de tráfego. É a primeira vez que os números
  significam algo — e é onde a suspeita da §9.S se confirma ou cai: se todo
  beacon divide um balde de 30/min, a tela subconta.

### 11.6 Auth: três portas para o mesmo `role`

O `role` ADMIN é conferido em três lugares — na página (sessão do next-auth), na
rota de BFF (sessão + role antes de assinar), e na API (claim do JWT). Três
portas para a mesma decisão é o desenho certo (defesa em profundidade), e
também três lugares para discordarem.

A revisão segue um usuário: `ADMIN_EMAILS` → `upsert` → `User.role` no banco →
claim no JWT → o que a tela mostra. E as bordas: a sessão do next-auth dura
muito mais que a hora do JWT — o token é assinado a cada chamada, então não
expira na prática, mas **o que o usuário vê se a assinatura falhar** (env
ausente, por exemplo) precisa ser uma tela, não um stack trace.

### 11.7 Ambiente: o `render.yaml` não declara o que a API precisa

**Achado da análise, e é do tipo que só aparece quando alguém recria o
serviço:** o `render.yaml` declara 15 variáveis e **não declara
`AUTH_JWT_SECRET` nem `ADMIN_EMAILS`**. As duas estão documentadas no
`.env.example` e no `setup.md`, e estão configuradas à mão no painel do Render
(foi assim que o login de produção passou a funcionar em 16/08).

Enquanto o serviço atual existir, funciona. Recriado a partir do blueprint, ele
sobe **sem autenticação configurada** — e o `verifyAuthJwt` falha fechado, então
o sintoma seria toda rota de conta devolvendo 401 num serviço saudável, com
health check verde. Exatamente o formato de defeito que este projeto já
catalogou duas vezes.

A correção é uma linha por variável, com `sync: false`. O resto do eixo é a
armadilha já conhecida — os dois deploys disparam juntos e não terminam juntos —
que aqui ganha o teste que faltava: **o smoke da §11.T rodando depois dos dois**.

### 11.S Segurança da costura: em quem cada metade confia

As Fases 9 e 10 olham cada lado por dentro. Aqui a pergunta é outra e mais
difícil de responder olhando um repositório só: **qual é a suposição de
confiança entre as duas metades, e ela está escrita em algum lugar?**

Hoje a resposta existe, mas espalhada em comentários. Reunida, ela é assim:

| Quem chama | Como se autentica | O que a API supõe |
|---|---|---|
| navegador → Next (BFF) | cookie de sessão do next-auth | — |
| Next (BFF) → API | JWT HS256, `AUTH_JWT_SECRET` compartilhado | quem assinou é servidor de confiança |
| navegador → API (direto) | nada — só rotas públicas | mutação nunca vem por aqui |
| cron da Vercel → API | `JOB_SECRET` | quem tem o segredo pode disparar o pipeline |

**A terceira linha é a suposição não declarada**, e ela é o que faz o
`methods: ['GET', 'POST']` do CORS funcionar apesar de existirem 2 PUT e 2
DELETE. Uma suposição que só é verdadeira por hábito é a que quebra quando
alguém adiciona uma chamada direta do cliente — e o sintoma seria um preflight
falhando em produção, exatamente como o bug da barra final no `CORS_ORIGIN` em
16/08.

O eixo entrega o mapa acima **no código**, como comentário no plugin de CORS e
no `api-proxy.ts`, e o transforma em teste onde der: *nenhuma chamada do
navegador usa método fora da lista do CORS* é verificável estaticamente.

Os outros três itens:

- **Rotação do segredo compartilhado.** `AUTH_JWT_SECRET` é o mesmo nos dois
  serviços. Trocá-lo exige trocar nos dois **ao mesmo tempo**, e os dois deploys
  não terminam juntos — ou seja, há uma janela em que toda rota de conta
  devolve 401. Isso precisa estar escrito no runbook da §13.6 antes de alguém
  precisar rodar às pressas.
- **A rota de eventos continua anônima.** Ela existe sem sessão, sem JWT e sem
  cabeçalho de identificação **de propósito** — é a §4 dos slots. O risco não é
  ataque, é deriva: um `userId` acrescentado "para melhorar a métrica" mudaria a
  natureza jurídica da tabela inteira. A guarda é um teste que reprova
  identidade no payload.
- **O dado que sai do produto.** E-mail de assinante (Resend), e-mail em
  `User`, e o que os `PipelineEvent` gravam em `context`. A varredura é curta e
  a pergunta é só uma: **algum log guarda dado pessoal que ninguém precisa?**

### O que a §11.T acrescenta ao smoke

O smoke da §11.T não prova só que o caminho feliz funciona. **Os casos negativos
são os que protegem a autorização**, e são baratos de escrever junto:

- anônimo em `/favorites` e `/account` → sign-in, não conteúdo;
- usuário comum em `/admin/metrics` → acesso restrito, não painel;
- token expirado ou ausente na rota de BFF → 401, e uma tela, não um stack
  trace.

São as três portas da §11.6, verificadas de fora — que é o único lugar de onde
dá para ver as três concordando.

> **Saída da Fase 11.** A guarda de tipo estendida, o smoke E2E existindo e
> verde (com os casos negativos), o timeout no BFF, a paridade de env no
> blueprint, o mapa de confiança escrito no código, e a leitura de analytics
> registrada. **Verificação:** o ritual completo — Lighthouse por rota, baseline
> visual, e o smoke, que passa a ser parte dele.

---

## Fase 12 — Refinamento visual e de leitura ✅ Concluída em 2026-08-25 — branch `refine/v2-visual-reading`

**Objetivo:** consertar o que a pessoa que usa o site vê, e que nenhuma das
três revisões viu — porque nenhuma delas olhou uma tela com dado de produção
dentro.

**Por que ela existe, e por que entre a 11 e a 13.** As Fases 9, 10 e 11
revisaram **camadas**: o servidor, o navegador, a costura. Acharam 15, 14 e 15
achados, e nenhum deles era isto:

- as abas de `/account` desenhadas **umas por cima das outras**;
- `/admin` sem link nenhum em tela de 768 px para cima;
- a tag `<img>` inteira, `srcset` e tudo, impressa **como texto** no corpo da
  matéria;
- o rótulo "Trecho" sobre uma caixa vazia em 23% do acervo;
- a palavra `null` como subtítulo em 158 notícias;
- `**asteriscos**` no meio da frase em 60% dos briefings;
- um retângulo laranja com um "N" a cada quatro células da grade.

**Nenhum destes tem sintoma de código.** O build passa, a suíte passa, o
Lighthouse passa, o smoke passa. Eles só aparecem para quem **abre a tela e
lê** — e essa era a única revisão que faltava. A 13 continua sendo o
fechamento; esta é a que torna o fechamento defensável.

> **A regra da §28 vale igual aqui**, e foi seguida: todo achado saiu como
> correção mergeada **ou** guarda no CI. Nenhum virou item de lista. Os dois
> que viraram dívida têm gatilho numérico, e estão em "O que ficou em aberto".

**Inventário fechado — sete eixos:**

```text
    -- 12.A a casca da conta --
[x] as quatro abas de /account colapsadas em 33px, texto sobre texto
[x] a causa: `--spacing-block` no @theme sombreia a utility de display
[x] guarda derivada dos tokens, não escrita à mão

    -- 12.B o alcance do painel --
[x] /admin sem link em desktop desde o masthead de três linhas (Fase 3)
[x] uma lista de sessão só, lida pelas duas cascas
[x] guarda de paridade entre desktop e mobile

    -- 12.C o painel como área --
[x] métricas viram aba do painel, não destino solto atrás dele
[x] contêiner e faixa no layout do segmento, como em /account
[x] a chave órfã que o link de canto deixava para trás

    -- 12.D o texto que vem do feed --
[x] corpo cru: 63,7% com tag HTML, 51,9% abrindo com <img>
[x] o dek guardando a matéria inteira (mediana 594, máximo 33.073)
[x] rodapé do veículo, aviso de paywall, e a palavra "null"
[x] a etapa 8.5 leva a correção às 6.669 linhas já gravadas
[x] 107 fotos recuperadas de dentro do corpo HTML

    -- 12.E a tela de leitura --
[x] marcação impressa como texto
[x] "Trecho" sem trecho
[x] o dek repetido na abertura do corpo

    -- 12.F o briefing gerado --
[x] a sintaxe que o modelo escreve, medida nos 89 retidos
[x] hierarquia de subtítulo achatada em h2
[x] o prompt fixa um subconjunto, e a época sobe para v2

    -- 12.G a notícia sem foto --
[x] 1.703 (25,5%) sem imagem em lugar nenhum do feed
[x] card de texto no lugar do placeholder de marca
[x] o placeholder fica com o caso em que sempre foi certo
```

### 12.A A faixa da conta: a classe existia e não funcionava

Os quatro links de `/account` mediam **33 px cada**, com o texto vazando da
caixa e as abas escritas umas sobre as outras. A causa não estava no
componente.

No Tailwind v4, um `--spacing-<nome>` não gera só `p-<nome>` e `gap-<nome>`:
gera o eixo de espaço inteiro, e `inline-<valor>` ali é `inline-size`. Com
`--spacing-block` declarado no `@theme`, a folha passa a ter **dois**
`.inline-block` — o de display, do core, e o de `inline-size`, derivado do
token. Mesma especificidade, vence o que vem depois: o do token.
`clamp(1.5rem, 1.25rem + 1vw, 2.5rem)` a 1280 px dá **32,80 px**, que é o
número na tela.

**Nada avisa.** A classe existe, o `display` é aplicado, e a largura vem de
outro lugar. Provado medindo a mesma marcação com `style` inline em vez da
classe: 119 px contra 33.

A guarda **deriva dos tokens** em vez de listar nomes: acrescentar
`--spacing-flex` amanhã põe `inline-flex` na lista sozinho — e esse é o caso
que dói, porque `inline-flex` está em uso por todo o projeto, enquanto
`inline-block` tinha um call site só.

> **A primeira versão da guarda passou verde sobre o defeito.** Ela montava o
> padrão numa template literal onde `\\s` tinha sido escrito como `\s`, que
> não é classe de espaço — é a letra `s`. O padrão passou a exigir um `s`
> colado no nome da classe. É a quarta vez que uma guarda estática deste
> projeto falha por análise de texto, e a saída foi parar de montar regex:
> ela parte a fonte em palavras, que não tem escape para errar.

### 12.B O painel existia e não tinha porta

`/admin` respondia 200, o menu do mobile a listava, e **nenhuma tela de 768 px
para cima oferecia um link**. A V1 tinha uma `Navbar` responsiva só, que montava
os links a partir da sessão — então eles apareciam nos dois tamanhos. O masthead
de três linhas da §10 partiu aquela barra em `Masthead`, que lê a lista estática
de `NAV_LINKS`, e `MobileNav`, que lê a sessão. **Os links de sessão foram só
para o segundo.**

Não havia sintoma: a rota funcionava, a suíte estava verde, e o único jeito de
achar era procurar o link e não encontrar.

`sessionNavLinks` passa a ser a lista única que as duas cascas leem, e o painel
entra na **top-bar**, não na navegação secundária do masthead: a linha 1 é onde
mora informação de sistema, e ADMIN não é editoria.

A guarda compara as duas cascas contra a lista gerada — rota de sessão nova
entra sozinha e reprova se cair em só um lado.

### 12.C O painel vira área, e as métricas viram aba dele

**As métricas sempre estiveram atrás do guard de admin** — `/admin/metrics`
exige sessão com role ADMIN desde que a página se mudou para lá. O que elas não
eram é **parte do painel**: a `/admin` tinha um link no canto superior direito
do título, a `/admin/metrics` tinha uma seta de voltar, e as duas telas se
citavam sem nunca formarem uma.

Eram inclusive **dois contêineres diferentes** — `max-w-5xl` no painel,
`max-w-7xl` nas métricas —, então a largura da página mudava ao trocar de tela.

A faixa de abas vive no layout, ao lado do guard, pelo mesmo motivo que ele:
tela nova de admin entra como aba e herda a casca, em vez de trazer o próprio
`max-w-*` e o próprio link de canto. E ela só é renderizada **depois** do guard
— oferecer as abas a quem não é ADMIN seria anunciar o que a pessoa não pode
abrir.

### 12.D O texto que vem do feed, medido nas 6.669 linhas

Duas correções, e a segunda só ficou visível medindo a primeira.

**O corpo nunca passou por higiene nenhuma.** Medido em produção em 25/08:

| Defeito | Alcance | Como aparecia |
|---|---|---|
| tag HTML no corpo | **63,7%** | marcação impressa como texto |
| corpo abrindo com `<img>` | **51,9%** | a tag inteira, `srcset` e tudo |
| "Trecho" com corpo vazio | **23,2%** | o rótulo sobre uma caixa vazia |
| aviso de paywall no texto | 7,3% | "Matéria exclusiva para assinantes." |
| rodapé de WordPress | 5,5% | "The post … appeared first on …" |
| a palavra `null` como texto | 158 linhas | a ESPN inteira |

**E o dek não era um dek.** Mediana de **594 caracteres**, p90 de 5.613,
**máximo de 33.073** — metade do acervo usava o campo de subtítulo para guardar
a matéria inteira, e a tela de leitura imprime o dek num parágrafo **sem
clamp**.

> **A primeira versão da higiene teria destruído a matéria de metade do
> acervo, e foi um número que a pegou.** A regra ingênua — "corpo igual ao dek
> vira `null`" — descartava **5.635 corpos**, mediana de 1.080 caracteres,
> máximo de 33.073. Ela estava certa sobre a TechCrunch, onde os dois campos
> trazem a mesma frase única, e catastrófica sobre a G1, a Folha, o Valor, a
> BBC e a Trivela, onde os dois trazem **a matéria inteira**.
>
> O erro era de premissa: quando os dois campos carregam o mesmo texto longo,
> aquele texto é o **corpo**, e o dek é a abertura dele. Não havia corpo
> repetido para descartar — havia uma matéria no campo errado.
>
> **É a lição de fluxo desta fase, e é a mesma da §28:** medir a correção
> contra produção **antes** de mergear, não depois. Um teste de unidade sobre
> um caso inventado teria passado nas duas versões.

Depois: todos os defeitos em **zero**, dek com p50 111 e máximo 320, e duas
propriedades verificadas contra o acervo inteiro em vez de argumentadas —
**nada perde texto** (as 196 linhas que encolhem perdem só rodapé, paywall e
tag) e **a passada é idempotente** (zero linhas mudam na segunda), que é o que
a etapa 8.5 exige para rodar todo dia.

A varredura da etapa 8.5 deixou de ser restrita às fontes do classificador: o
filtro existia para proteger a **categoria**, e o HTML cru estava justamente nas
fontes de categoria fixa que ele excluía. A reclassificação mantém o recorte
antigo, dentro do laço.

### 12.E A tela de leitura

Três coisas, todas visíveis:

- **imprimia marcação como texto.** O corpo é texto de terceiro e o React
  escapa o que recebe. A ingestão limpa, mas a etapa 8.5 roda uma vez por dia —
  a linha na tela cobre a janela até lá, e o dia em que um veículo novo
  inventar um formato;
- **rotulava um trecho que não existia.** Ter `content` não é ter corpo:
  perguntar aos blocos, e não ao campo, é o que faz a tela dizer a verdade;
- **mostrava o dek duas vezes.** Quando o feed manda a matéria num parágrafo
  só, a ingestão corta o dek no último fim de frase que cabe, então o corpo
  **começa** com ele — e a comparação por igualdade não via nada. O corte só
  acontece quando o dek termina em fronteira de frase: um dek que para no meio
  de uma oração é resumo, e tirá-lo deixaria a matéria abrindo por "com um
  panorama complexo".

### 12.F O briefing: a medição do renderizador tinha envelhecido

O `article-body` carregava uma nota dizendo que o corpo de produção só usava
`###`, sem negrito nem listas, e que trazer uma biblioteca de Markdown seria
~40 kB no bundle da rota mais lida para cobrir sintaxe que a IA não produz.
**O argumento estava certo. A medição tinha vencido.**

Contados os 89 briefings retidos, em 25/08:

| Sintaxe | Briefings | O que aparecia |
|---|---|---|
| `**negrito**` | **53 (60%)** | os asteriscos, no meio da frase |
| `###` | 37 (42%) | subtítulo — funcionava |
| `##` | 26 (29%) | subtítulo, **no mesmo nível do `###`** |
| `---` | 18 (20%) | um parágrafo com três traços |
| `- item` | 7 (8%) | um parágrafo começando por hífen |
| `*ênfase*` | 3 (3%) | os asteriscos |

Continua **não sendo** um renderizador de Markdown, e a lista do que ele
entende continua **medida**: link, tabela, citação, código e lista numerada
deram **zero** nos 89 e não são reconhecidos. Há teste afirmando isso.

**O nível do heading passou a ser relativo**, mapeando as profundidades
presentes para níveis consecutivos — por posição na lista, nunca por
subtração. Um documento com `##` e `####` daria `h2` e `h4` na subtração, que é
exatamente o salto que o `heading-order` reprova. O teste afirma a propriedade,
não os casos.

> **Foi a guarda de acessibilidade que avisou.** O `article-body` estava na
> lista de componentes com nível fixo permitido, e saiu dela: ele fixava `h2`
> em todo subtítulo justamente para não abrir salto a partir do `h1`, e pagava
> por isso achatando a hierarquia.

O prompt passou a fixar um subconjunto fechado em vez de pedir "Markdown", e a
**época subiu para `v2`** — é exatamente a mudança conceitual de formato de
saída que o campo foi documentado para marcar. O renderizador foi ensinado a
ler **tudo o que os 89 já escreveram**, para os briefings retidos não ficarem
para trás.

**Verificado renderizando os 89 briefings de produção pelo componente:** 394
`<strong>`, 12 `<ul>`, 56 `<hr>`, só `H2` e `H3` emitidos, nenhum nível
pulado, e **zero caracteres de marcação chegando ao texto**.

### 12.G A notícia sem foto

**1.703 notícias (25,5% do acervo) não têm imagem em lugar nenhum do feed** — a
Folha, a TechCrunch e a ESPN não mandam uma. As 107 que estavam escondidas
dentro do corpo HTML a ingestão recuperou; o resto não existe.

Elas recebiam a caixa de imagem com o placeholder de marca: um retângulo
laranja com um "N", repetido a cada quatro células da grade, e de largura cheia
entre a metadata e o texto na tela de leitura. **Anunciar ausência de foto gasta
o elemento mais pesado da composição para não dizer nada.**

O que entra não é "o mesmo card sem a imagem": a manchete sobe um degrau da
escala e ganha uma linha antes de truncar, o dek ganha três, e um filete da cor
da categoria segura a coluna. **Medido no navegador a 1280 px: a célula mantém
exatamente a mesma altura das vizinhas com foto — 387 px** —, então o ritmo da
grade fica intacto, que era a única coisa que o retângulo resolvia.

Na tela de leitura, simplesmente não há imagem. Jornal com matéria sem foto não
desenha uma moldura vazia; começa pelo texto.

O placeholder não sumiu — **mudou de papel**. Fica com o caso em que sempre foi
certo: a foto que **existe e não carrega**, onde a caixa já ocupa espaço no
layout e sumir com ela seria salto.

> **Saída da Fase 12.** As duas cascas consertadas e com guarda, o painel como
> área, o texto do feed higienizado na entrada **e** no acervo já gravado, a
> tela de leitura dizendo a verdade sobre o que tem para ler, o renderizador do
> briefing alinhado ao que o modelo escreve, e a notícia sem foto com forma
> própria. **1.314 testes → 1.391.** **Verificação:** o ritual completo —
> Lighthouse por rota, baseline visual, e o smoke.

---
## Fase 13 — Ajustes finos e release final

**Objetivo:** fechar. Não é mais revisão — é decidir cada coisa que ficou em
aberto, provar cada critério que o plano prometeu, e publicar um release que
alguém consiga apontar.

**O que diferencia esta fase das três anteriores:** as Fases 9, 10 e 11 acham
coisas. A 12 **não pode achar** — se ela achar defeito grande, ela não é a 12,
é a continuação da fase que o deixou passar. O trabalho aqui é de fechamento, e
o inventário é o dos documentos, não o do código.

```text
    -- 13.1 os critérios de aceite --
[x] §31 Visual: os 7, **fechados na Fase 10.3** com evidência medida
[ ] §31 UX: os 6, com evidência
[ ] §31 Performance: os 5, com número — **o LCP já tem o dele e reprova**:
    medido pós-merge da Fase 10, as cinco rotas ficam entre 2,57 s e 2,94 s,
    e o critério pede < 2,5 s
[ ] §31 Monetização: reescrever — 4 critérios falam de anúncio cancelado

    -- 13.2 as métricas de sucesso --
[ ] §26 Técnica: error rate, latência e cache hit rate — medir ou riscar
[ ] §26 Produto: o que a tela de métricas já mostra, com a data da leitura
[ ] §26 Monetização: marcar como adiada, conforme §21

    -- 13.3 a dívida --
[ ] cada item de "O que ficou em aberto" com decisão: entra, fica ou morre
[ ] os achados das Fases 9–11 que viraram dívida, com gatilho
[ ] a data do agregado diário (~90 dias da ingestão: ~20/11/2026)
[ ] o controle de opt-out na interface — item da Fase 8, ainda aberto
[ ] **a newsletter não entrega a assinante real** — domínio nunca verificado no
    Resend, envio só para o e-mail da conta (aberto desde 16/08)
[ ] **`GET /api/trending` etapa 2** — esperava a camada de analytics, que existe
    desde a Fase 8: o gatilho disparou e ninguém percebeu

    -- 13.4 documentação de release --
[ ] README: screenshots de 15/08 mostram **a V1**, redesenhada desde 20/08 — a
    matéria-prima já existe em `docs/v2/baseline-v2/` (51 capturas)
[ ] **o diagrama ER documenta 3 entidades e o schema tem 12** — faltam nove,
    todas da V2; os quatro `.mermaid` são de 15/08
[ ] docs/api.md (guardado por `api-docs-drift`), docs/setup.md (de 24/08),
    docs/architecture.md
[ ] docs/presentation.md — a peça de portfólio, de 16/08, descreve a V1
[ ] CHANGELOG e a tag v2.0.0 (o repositório não tem nenhuma tag)

    -- 13.5 o ritual final --
[ ] Lighthouse por rota, contra produção quente
[ ] baseline visual completa — e a decisão das larguras
[ ] smoke E2E verde
[ ] validação de SEO e leitura de analytics

    -- 13.6 canary e rollback --
[ ] o runbook que não existe: o que fazer quando quebra às 3 da manhã
[ ] promoção de preview na Vercel × build congelada no Render
[ ] o que o smoke reprovado dispara

    -- 13.7 o dia seguinte --
[ ] o que roda sozinho depois do release, e quem olha

    -- 13.S o gate de segurança do release (eixo obrigatório) --
[ ] os achados de 9.S, 10.S e 11.S: corrigidos ou com aceite escrito
[ ] varredura de dependência — hoje não existe nenhuma
[ ] gitleaks conferido contra o histórico, não só contra o PR
[ ] segredos de produção: inventário, dono e rotação
[ ] LGPD: a página que explica o que é medido e como se opor

    -- 13.T a suíte no dia do release (eixo obrigatório) --
[ ] suíte inteira verde, sem cache, nos dois apps
[ ] o gate reprova quando deve — provar com uma falha proposital
[ ] smoke pós-deploy verde contra produção
[ ] cobertura: os dois pisos no CI, não um
```

### 13.1 Os critérios de aceite: 24 caixas, 7 fechadas, 4 obsoletas

A §31 tem 24 critérios e nenhum estava marcado depois de oito fases entregues.
Isso não era desleixo: eles nunca tiveram dono, porque a fase que os fecharia era
a "Release" de oito linhas.

> **Os 7 do bloco Visual foram fechados na Fase 10.3**, em 24/08/2026, cada um
> com evidência medida — laranja em 0,22% da área da dobra, hero 8,2× a
> miniatura e 2,75× a manchete do card, briefing como único bloco em
> `bg-surface-accent`. **Restam 17**, e o "LCP alvo < 2,5 s" mudou de estado no
> fechamento da 11: com as duas telas de detalhe entrando no gate, **uma rota
> passou a alcançá-lo** — `/article/[date]` em **2,42 s** —, e as outras seis
> medem de 2,61 s a 2,90 s. O critério deixou de reprovar em bloco e virou uma
> pergunta de escopo: ele vale para toda rota ou para as de conteúdo?

Cada um vira uma de três coisas: **evidência** (captura, medição, teste),
**risco aceito** (com o motivo), ou **critério riscado** (com o motivo).

E quatro deles precisam ser **reescritos antes de serem avaliados**: o bloco
"Monetização" fala de ad slots que não quebram o layout e de anúncios claramente
identificados. **Publicidade foi cancelada por decisão em 22/08**, o código foi
removido, e avaliar um critério sobre algo que não existe é a mesma armadilha do
controle que não muda nada. O bloco vira o que sobrou de verdade: CTA de
newsletter consistente, e espaço conceitual para o futuro que a §21 descreve.

### 13.2 As métricas: três números prometidos que ninguém produz

A §26 promete, como métrica **técnica** de sucesso: Lighthouse, Core Web Vitals,
**error rate**, **API latency**, image transfer size e **cache hit rate**. Os
dois primeiros o gate mede toda segunda. Os três em negrito **não têm
instrumentação nenhuma** — a §9.5 e a §11.3 já os nomeiam, e é aqui que a
decisão se fecha.

O precedente existe e é bom: "sessões recorrentes" foi **riscado com o motivo**
quando ficou claro que a camada não podia medi-lo, e a §26 hoje carrega o
riscado à vista. Métrica que sobrevive à V2.0 sem produtor é promessa que o
próximo leitor do documento vai cobrar.

### 13.3 A dívida: cada item com decisão, e a data que já existe

A lista de "O que ficou em aberto" do `CLAUDE.md` tem quatro itens, e as Fases
9–11 vão acrescentar. Aqui cada um recebe veredito. Dois já têm gatilho escrito
e não precisam de discussão — só de registro:

- **a tabela de agregado diário** entra quando a retenção de 90 dias começar a
  apagar evento cru. A ingestão subiu em 22/08/2026: a data é **~20/11/2026**.
  Escrever a data é o que impede que ela seja redescoberta como surpresa;
- **o controle de opt-out na interface.** Sem terceiro, a oposição fica com DNT
  e Global Privacy Control, que é o mecanismo padrão para medição anônima de
  primeira parte. Um controle explícito continua sendo item em aberto desde a
  Fase 8, e merece decisão — não silêncio.

### 13.4 A documentação ainda descreve a V1

O `README.md` é a porta do projeto, e ele **não passou pela V2**:

- as três capturas em `docs/screenshots/` são de **16/08/2026** — o desenho
  anterior ao redesign inteiro;
- o texto descreve "Home com feed de notícias" e "busca e filtros por categoria
  em tempo real". A V2 tem hero editorial, Daily Brief, trending, seções por
  categoria e um acervo com facetas. Nada disso aparece.

E o repositório **não tem uma única tag**, nem `CHANGELOG`. Oito fases, 128 PRs,
e nenhum ponto que alguém possa apontar e dizer "isto é a V2.0". A tag
`v2.0.0` com nota de release é o artefato que fecha o trabalho — e, num projeto
de portfólio, é metade do valor.

O resto é conferência: `docs/api.md` (que a guarda da §9.1 passa a proteger),
`setup.md`, `architecture.md`, os quatro diagramas Mermaid, e o
`docs/presentation.md`.

### 13.5 O ritual final, com uma decisão pendente sobre a baseline

Lighthouse por rota contra produção quente; smoke E2E verde; validação de SEO;
leitura de analytics. Tudo isso já tem mecanismo depois das Fases 9–11.

**A decisão pendente é a das larguras.** A §30 pede cinco (375, 768, 1024, 1440,
1920); o script suporta as cinco; **o conjunto versionado usa três**. Não há
nada errado nisso — três larguras que sempre batem valem mais que cinco que
ninguém recaptura —, mas o documento e o repositório precisam dizer a mesma
coisa. Ou a §30 passa a pedir três, ou a captura passa a fazer cinco.

### 13.6 Canary e rollback: o runbook que não existe

"Production canary" era um item de checklist sem definição. Numa Vercel + Render
com plano free, ele significa uma coisa concreta:

- **Vercel** promove um deployment de preview; reverter é promover o anterior;
- **Render** já congela a build anterior quando o health check reprova — foi
  assim que o `ERR_MODULE_NOT_FOUND` da Fase 8 virou "rota nova dá 404" em vez
  de "site fora do ar". O comportamento de rollback existe; o que não existe é
  ele estar **escrito**.

O entregável não é infraestrutura nova, é **um runbook curto**: o que quebra
mais provavelmente (pipeline, boot da API, deploy fora de ordem), como se
reconhece cada um (probe de rota nova, não `uptime`; `/api/dev/logs` para o
pipeline), e o que se faz. Este projeto já pagou por três desses diagnósticos —
o valor está em não redescobri-los.

### 13.7 O dia seguinte

O que continua rodando sozinho depois do release, e o que cada coisa prova:

| Mecanismo | Quando | O que ele guarda |
|---|---|---|
| pipeline diário | 08:00 BRT | o produto inteiro |
| gate do Lighthouse | segunda 09:00 UTC | as quatro categorias ≥ 90 |
| smoke E2E | pós-deploy | os fluxos da §25 |
| expurgo (etapa 8) | diário | retenção e LGPD |
| renormalização (8.5) | diário | o acervo convergindo sozinho |

**Nenhum deles depende de alguém lembrar** — que é o critério que a auditoria da
Fase 8 estabeleceu quando trocou "o `CLAUDE.md` mandava aquecer" por um passo de
workflow.

### 13.S O gate de segurança: o que precisa estar verde para publicar

A Fase 13 **não caça vulnerabilidade** — isso foi trabalho das três anteriores.
Ela faz três coisas:

**1. Fecha a conta dos achados.** Cada item de `9.S`, `10.S` e `11.S` está numa
de duas colunas: **corrigido com teste**, ou **aceito com risco escrito** —
qual é o risco, quem aceita, e o que mudaria a decisão. Achado de segurança sem
uma das duas bloqueia o release. É a única classe de achado que bloqueia.

**2. Fecha a lacuna que nenhuma fase cobre: a dependência.** O CI tem
**gitleaks** (segredo no commit) e mais nada. Não há `dependabot.yml`, não há
`pnpm audit` em nenhum workflow, não há CodeQL. São dois apps, dezenas de
dependências diretas e um `pnpm-lock.yaml` que ninguém audita.

> **A varredura foi rodada em 23/08, ao planejar estas fases, e o resultado é
> grande demais para ficar só aqui.** `pnpm audit`: **116 advisories** no total
> (1 critical, 46 high); restringindo a dependências de **produção**, **102, com
> 40 high em 13 pacotes**. O critical é do `vitest` (servidor de UI, dev), mas
> entre os high de produção estão **`next`** — corrigido só a partir da 15, e o
> projeto está na 14 — e **`fastify`**, corrigido a partir da 5, com o projeto
> na 4.
>
> **Isso muda o cronograma.** Duas majors de framework não são "ajuste fino de
> release": são trabalho com risco próprio, e fazê-las na Fase 13 seria mexer
> na fundação depois de as três revisões terem certificado o que está em cima.
> Por isso a medição entra em **9.S** (API) e **10.S** (web), onde cada lado
> pode decidir e testar sozinho, e a **13.S fica com o gate** — o passo no CI e
> a conferência de que nada regrediu.

A escolha do mecanismo continua barata:
`pnpm audit --audit-level=high` como passo do CI é uma linha; o Dependabot é um
arquivo. **O que não serve é o release sair sem que ninguém tenha olhado.**

**3. Fecha a conta de LGPD.** A medição é anônima por construção e a §21
cancelou o anúncio, então não há tratamento que exija consentimento prévio — mas
**o direito de oposição hoje depende de o visitante saber que DNT e Global
Privacy Control funcionam**, e nada na interface diz isso. O controle explícito
de opt-out é item aberto desde a Fase 8. A decisão mínima do release é uma
página ou seção dizendo **o que é medido, por quanto tempo, e como se opor**.

### 13.T A suíte no dia do release: o gate precisa saber reprovar

O eixo de testes da Fase 13 não escreve teste novo. Ele verifica **três
propriedades do próprio mecanismo**, que ninguém verificou até hoje:

- **A suíte inteira verde, sem cache, nos dois apps.** O `turbo` guarda
  resultado; um `--force` no dia do release é o que separa "está verde" de
  "estava verde".
- **O gate reprova quando deve.** Um gate que nunca reprovou não está provado —
  está sem evidência. A auditoria da Fase 8 descobriu isso pelo caminho ruim: o
  gate do Lighthouse **ia** reprovar, por infraestrutura, sem que ninguém
  soubesse. Uma falha proposital e temporária (um limiar movido, um teste
  invertido, em branch descartável) prova que o vermelho aparece.
- **Os dois pisos de cobertura no CI**, não um — o do web nasce na §10.T, e aqui
  se confirma que ele de fato reprova.

> **Saída da Fase 13.** Tag `v2.0.0`, nota de release, §31 e §26 fechadas com
> evidência ou risca, README no desenho novo, runbook escrito, dívida com data,
> **achados de segurança corrigidos ou com aceite escrito**, e varredura de
> dependência no CI. **A V2.0 acaba aqui.**

---

## Ordem, paralelismo e branches

```text
Fase 9 (backend)  ─┐
                   ├─► Fase 11 (integração) ─► Fase 12 (refino) ─► Fase 13 (release)
Fase 10 (frontend) ─┘
```

**As Fases 9 e 10 correm em paralelo**, pelo mesmo argumento que a Fase 0.5 já
usou: `apps/api` e `apps/web` não conflitam em arquivo. **A Fase 11 não abre
antes das duas estarem mergeadas** — revisar a costura de um lado que ainda vai
mudar é revisar duas vezes.

**A Fase 12 vem depois da 11 e antes da 13**, e a ordem importa nas duas
pontas: ela mexe em tela e em texto gravado, então abri-la antes da 11 faria a
revisão de costura medir um alvo que ia mudar; e a 13 fecha a baseline visual e
os critérios da §31, que é justamente o que a 12 altera. **A Fase 13 não abre
antes da 12**, porque publicar a documentação de release com as capturas
anteriores ao refino seria documentar a tela errada.

Branches, seguindo a §29:

```text
review/v2-backend        # Fase 9
review/v2-frontend       # Fase 10
review/v2-integration    # Fase 11 — depois das duas mergeadas
refine/v2-visual-reading # Fase 12 — depois da 11
release/v2.0             # Fase 13
```

**Uma fase de revisão não é um PR.** Cada eixo que produzir correção ou guarda
sai como unidade revisável própria, com o mesmo checklist da §29 (objetivo,
capturas, testes, acessibilidade, performance, alteração de API) — um bloco de 40
arquivos misturando CORS, índice de banco e cobertura de teste é irrevisável, e
revisão irrevisável é como o defeito passa.

> **Como isso saiu na prática, nas duas fases já fechadas.** A 9 (PR #131) e a 10
> (PR #133) foram entregues como **um PR guarda-chuva por fase, com um commit por
> eixo** — a pedido, e nas duas. A intenção da regra (uma unidade revisável por
> eixo, nunca um amontoado) foi cumprida **pelo commit**, não pelo PR: dez
> commits na 10, cada um com um assunto e o seu porquê. Fica registrado assim
> para a fase seguinte não receber duas instruções diferentes.

**Os eixos `S` e `T` saem em PR próprio, sempre.** Correção de segurança
misturada com refatoração é a que ninguém consegue revisar de verdade — e é a
única classe de mudança em que "passou no CI" não basta. **Nenhum dos dois eixos
é adiável para a fase seguinte:** a 10 não herda o `S` da 9, e a 12 não é o
depósito do que as três anteriores não fizeram. Fase que fecha com `S` ou `T`
em aberto não fechou.

**E o registro.** Cada fase fecha em `docs/progress.md` no formato dos itens 11
a 32: o que foi achado, o que foi corrigido, o que virou guarda, o que virou
dívida — e o número. É esse registro que faz a próxima revisão começar de onde
esta parou, em vez de redescobrir.

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

review/v2-backend            # Fase 9  ─┐ paralelas: apps diferentes
review/v2-frontend           # Fase 10 ─┘
review/v2-integration        # Fase 11 — depois das duas mergeadas
refine/v2-visual-reading     # Fase 12 — depois da 11
release/v2.0                 # Fase 13
```

**As cinco últimas não são de feature, e a unidade de entrega muda.** Nas fases de
feature, a branch é o PR. Nas de revisão, a branch é o guarda-chuva: **cada eixo
que produzir correção ou guarda sai no seu próprio PR**, com o mesmo checklist
abaixo. Um PR de 40 arquivos misturando CORS, índice de banco e cobertura de
teste é irrevisável — e revisão irrevisável é exatamente como o defeito passa.

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

> **Fechados na Fase 10.3, em 24/08/2026, com evidência para cada um.** O
> conjunto versionado da baseline (`docs/v2/baseline-v2/`) passou a cobrir as
> **12 rotas nos dois temas** — 51 imagens, 15 escuras —, e as medições abaixo
> saíram do DOM de produção a 1280×1600.

- [x] **Newra possui identidade editorial própria.** Masthead de três linhas
  (§10), Newsreader nas manchetes e Inter na interface, escala tipográfica por
  papel e nenhum cartão com sombra. Evidência: `home--1440.jpg` e
  `home--1440-dark.jpg`.
- [x] **Laranja está presente sem dominar a interface.** Medido na dobra da
  Home: **0,22% da área** tem fundo de marca (4 elementos de 322 visíveis) e
  **6 elementos de texto** usam laranja. Ele é acento de link, ícone e um botão
  sólido — nunca superfície de leitura. A regra que sustenta isso é de token
  (`--brand-accent` não vai em texto) e tem guarda em `design-tokens.test.ts`.
- [x] **Home tem hierarquia clara de importância.** `h1` (sr-only) → `h2` por
  seção → `h3` nos cards, com `heading-order` verde no Lighthouse e nível por
  prop nos cards de grade — guarda em `a11y-guards.test.tsx`, que exige razão
  escrita para cada um dos sete componentes que fixam nível.
- [x] **Hero é visualmente dominante.** Medido: imagem de **790 px** contra
  miniaturas de **96 px** (8,2×) e manchete de **44 px** contra **16 px** dos
  cards (2,75×).
- [x] **Daily Brief é reconhecido como principal diferencial.** É o **único**
  bloco da Home sobre `bg-surface-accent` — conferido no DOM: exatamente uma
  ocorrência —, com kicker e ícone próprios, e a tela dele é a única com
  `ai-disclosure` e `source-list`.
- [x] **Desktop não parece uma grade de cards SaaS.** A `/news` separa itens por
  régua, não por cartão, e a suíte **proíbe sombra em conteúdo editorial** (só
  `shadow-overlay` e `shadow-modal`, ambos de camada flutuante). Evidência:
  `news--1440.jpg`.
- [x] **Mobile mantém hierarquia sem virar uma versão empobrecida do desktop.**
  As 12 rotas têm captura em 375; reflow a 200% de zoom (viewport de 640 px)
  conferido sem estouro horizontal na Home, na `/news` e na `/about`.

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
