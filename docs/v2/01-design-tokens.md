# Design tokens da V2.0

Entregável da Fase 0 (plano V2 §28). Este documento **fecha** os tokens: a Fase 1
copia daqui para `apps/web/styles/tokens.css` sem tomar mais nenhuma decisão de
cor, fonte ou espaçamento.

Fonte das propostas: §4.1 (paleta), §4.2 (dark mode), §5 (tipografia), §12
(design system técnico), §14 (motion). Onde este documento diverge do plano, a
divergência está marcada e justificada — sempre por medição, nunca por gosto.

---

## 1. Arquitetura em duas camadas

O plano descreve a paleta clara na §4.1 e a escura na §4.2 com **nomes
diferentes** (`paper`/`white`/`ink-500` de um lado, `Surface 1`/`Surface 2`/
`Text muted` do outro). Não dá para gerar um tema a partir de dois vocabulários.

A solução é a separação que o Tailwind v4 + shadcn já pressupõem:

| Camada | O que é | Muda com o tema? |
|---|---|---|
| **1. Paleta** | valores hexadecimais nomeados (`brand-600`, `ink-700`, `night-800`) | não — `brand-600` é `#C94F22` sempre |
| **2. Semântica** | papéis na interface (`--surface`, `--text`, `--line`) | sim — apontam para tokens diferentes em `:root` e `.dark` |

Componentes usam **só a camada 2**. Nenhum componente deve escrever
`bg-brand-600` diretamente: escreve `bg-primary`, e o tema decide. A exceção é
material de marca genuíno (o logo, o selo "gerado por IA"), onde a cor é fixa e
não deve inverter.

Isso resolve o problema de nomenclatura de vez: no escuro, o texto principal não
é "ink-950 invertido", é `--text-primary` apontando para `mist-100`.

---

## 2. Camada 1 — paleta

### Marca

| Token | Valor | Papel |
|---|---|---|
| `brand-950` | `#6F2815` | fundo escuro de marca (rodapé) |
| `brand-800` | `#8E3518` | hover/active de sólidos |
| `brand-700` | `#A83E1C` | **texto e links** sobre fundo claro; botões sólidos |
| `brand-600` | `#C94F22` | cor de marca; preenchimentos; texto grande |
| `brand-500` | `#D96A34` | acentos, gradientes, elementos secundários |
| `brand-100` | `#F8E8DE` | fundos de destaque |
| `brand-50` | `#FCF5F0` | superfícies e callouts editoriais |

### Neutros claros

| Token | Valor | Papel |
|---|---|---|
| `ink-950` | `#111315` | texto principal |
| `ink-700` | `#34383D` | texto secundário |
| `ink-500` | `#697178` | metadata |
| `paper` | `#FAF9F7` | fundo editorial |
| `white` | `#FFFFFF` | cards e superfícies |
| `line` | `#E4E1DD` | divisória decorativa |
| `line-strong` | `#969084` | **token novo** — bordas que carregam significado (ver §4) |

### Neutros escuros

Os valores vêm da §4.2; os nomes são novos, porque a §4.2 não nomeia nada.

| Token | Valor | Papel |
|---|---|---|
| `night-900` | `#0F1113` | fundo |
| `night-800` | `#171A1D` | superfície 1 |
| `night-700` | `#20252A` | superfície 2 |
| `night-500` | `#6B6F73` | **token novo** — bordas significativas no escuro (ver §4) |
| `mist-100` | `#F3F1EE` | texto principal |
| `mist-300` | `#C4CAD0` | **token novo** — texto secundário (a §4.2 pula esse nível) |
| `mist-400` | `#A8AFB5` | metadata |
| `ember-500` | `#F07A45` | marca no escuro |
| `ember-400` | `#F79A6E` | **token novo** — hover de link no escuro |

### Apoio

| Token | Valor | Papel |
|---|---|---|
| `yellow` | `#F3B562` | preenchimento pontual — **nunca texto** (ver §4) |
| `danger-600` | `#B4241C` | erro e destrutivo, tema claro |
| `danger-400` | `#F0705F` | erro e destrutivo, tema escuro |
| `success-600` | `#2E6B41` | confirmação, tema claro |
| `success-400` | `#6FBF8A` | confirmação, tema escuro |

O `--destructive` de hoje é `oklch(0.577 0.245 27.325)` em claro e
`oklch(0.704 0.191 22.216)` em escuro — herança do shadcn, sem relação com a
paleta. A V2 nomeia os dois como acima.

Os tokens de sucesso **não estavam na §4.1 do plano**, mas o código já depende
deles: `text-green-600`/`text-emerald-600` no estado de sucesso do
`subscribe-form.tsx` e do `admin-panel.tsx`, e `text-green-300` no ícone de
confirmação de `newsletter/unsubscribe`. Sem um par nomeado, a Fase 1 teria de
improvisar um verde no meio da migração. Os valores acima passam AA nos dois
temas (6,06:1 sobre `paper`; 8,56:1 sobre `night-900`).

---

## 3. Camada 2 — semântica

Os componentes consomem esta tabela. As colunas dizem para onde cada papel
aponta em cada tema.

| Papel | Claro | Escuro |
|---|---|---|
| `--bg` | `paper` | `night-900` |
| `--surface` | `white` | `night-800` |
| `--surface-raised` | `white` | `night-700` |
| `--surface-accent` | `brand-50` | `night-800` |
| `--surface-brand` | `brand-950` | `night-900` |
| `--text-primary` | `ink-950` | `mist-100` |
| `--text-secondary` | `ink-700` | `mist-300` |
| `--text-muted` | `ink-500` | `mist-400` |
| `--text-on-brand` | `white` | `white` |
| `--link` | `brand-700` | `ember-500` |
| `--link-hover` | `brand-800` | `ember-400` |
| `--accent` | `brand-600` | `ember-500` |
| `--accent-solid` | `brand-700` | `brand-700` |
| `--accent-solid-hover` | `brand-800` | `brand-800` |
| `--line` | `line` | `rgba(255,255,255,.10)` |
| `--line-strong` | `line-strong` | `night-500` |
| `--focus` | `brand-700` | `ember-500` |
| `--danger` | `danger-600` | `danger-400` |
| `--success` | `success-600` | `success-400` |

`--accent-solid` não inverte: botões laranja sólidos com texto branco usam
`brand-700` nos dois temas, porque é o par que passa AA (6,23:1) e continua
legível sobre fundo escuro.

---

## 4. Contraste — medido, não estimado

Todos os valores abaixo foram calculados sobre a fórmula de luminância relativa
da WCAG 2.2. Alvos: **4,5:1** texto normal, **3:1** texto grande e componentes
de interface (1.4.11).

### O que passa

| Par | Ratio | Veredito |
|---|---|---|
| `ink-950` sobre `paper` | 17,70:1 | AAA |
| `ink-700` sobre `paper` | 11,22:1 | AAA |
| `ink-500` sobre `paper` | 4,71:1 | AA |
| `brand-700` sobre `paper` | 5,92:1 | AA |
| `brand-700` sobre `brand-50` | 5,77:1 | AA |
| `brand-700` sobre `brand-100` | 5,22:1 | AA |
| `white` sobre `brand-700` | 6,23:1 | AA |
| `white` sobre `brand-950` | 10,55:1 | AAA |
| `mist-100` sobre `night-900` | 16,78:1 | AAA |
| `mist-300` sobre `night-700` | 9,35:1 | AAA |
| `mist-400` sobre `night-700` | 6,96:1 | AA |
| `ember-500` sobre `night-900` | 6,82:1 | AA |

### O que **não** passa — e o que muda por causa disso

Três achados contrariam o que a §4.1 assume. Todos alteram regra de uso.

**1. `brand-600` não serve para texto normal sobre o fundo editorial.**
A §4.1 afirma que `#C94F22` tem "contraste aproximado de 4,54:1 sobre branco,
adequado para texto normal". Correto — **sobre branco puro**. Mas o fundo
editorial da V2 é `paper #FAF9F7`, e sobre ele o mesmo laranja cai para
**4,32:1**; sobre `brand-50` cai para **4,21:1**; sobre `brand-100`, **3,80:1**.

> **Regra:** links e texto em laranja usam `brand-700`, não `brand-600`.
> `brand-600` fica para preenchimento, ícones, bordas e texto ≥ 24px.

**2. `line` é invisível como borda significativa.**
`#E4E1DD` sobre `paper` dá **1,24:1**. A §12 propõe substituir sombra por borda
como mecanismo principal de separação — mas a WCAG 1.4.11 exige 3:1 para
componentes de interface. Uma borda de input a 1,24:1 não existe para quem tem
baixa visão. (A V1 tem o mesmo problema: `--border: #FDE3CF` dá 1,23:1.)

> **Regra:** `--line` (decorativo) para divisórias entre blocos de conteúdo;
> `--line-strong` para qualquer borda que delimite um controle — input, select,
> botão outline, célula de tabela com significado. `line-strong #969084` dá
> 3,02:1 sobre `paper` e 3,17:1 sobre `white`; `night-500 #6B6F73` dá de 3,05:1
> a 3,74:1 sobre as três superfícies escuras.

**3. `yellow` não pode ser texto em nenhum tamanho.**
`#F3B562` sobre branco dá **1,81:1**. Confirma a §4.1 ("amarelo apenas como
apoio"), mas de forma mais restritiva do que "não estrutural": ele só funciona
como **preenchimento**, com `ink-950` por cima (10,28:1).

Dois limites secundários, para constar: `brand-500` sobre branco é **3,46:1**
(só texto grande e UI) e `ink-500` sobre `brand-100` é **4,15:1** — metadata
dentro de callout usa `--text-secondary`, não `--text-muted`.

### Modificadores de opacidade

A §1 diz que componentes consomem só a camada semântica. Na prática o código
não usa os tokens puros: usa `token/NN`. Há **11 variantes distintas** hoje
(`text-foreground/60,70,80`, `text-muted-foreground/40,50,70`, `bg-muted/30`,
`ring-foreground/10`, `bg-destructive/10`, `border-destructive/30`,
`text-destructive/70`). Um token que passa AA sólido não passa mais quando
composto — e é isso que o leitor enxerga.

Medido com os tokens novos, sobre `paper`:

| Classe | Cor composta | Ratio | Veredito |
|---|---|---|---|
| `text-foreground/80` | `#404142` | 9,72:1 | AA |
| `text-foreground/70` | `#575859` | 6,78:1 | AA |
| `text-foreground/60` | `#6E6F6F` | 4,79:1 | AA |
| `text-muted-foreground/70` | `#959A9E` | **2,70:1** | reprova |
| `text-muted-foreground/50` | `#B2B5B8` | **1,96:1** | reprova |
| `text-muted-foreground/40` | `#C0C3C4` | **1,69:1** | reprova |

As três últimas reprovam também no escuro (2,98:1 e 2,33:1 para `/50` e `/40`
sobre `night-900`). Os usos reais são o numeral gigante "404" nas quatro
páginas de not-found (`/40`) e o estado vazio de `favorites-list.tsx`
(`/50` e `/70`) — nem mesmo o piso de 3:1 de texto grande é alcançado.

> **Regra:** opacidade pode compor `--text-primary` (até `/60`), e nunca
> `--text-muted` — que já é o nível mais claro que passa AA sólido, e portanto
> não tem margem para diluir. Onde hoje há `text-muted-foreground/40..70`, a V2
> usa `--text-muted` sólido; onde a intenção era só enfraquecer visualmente um
> ornamento (o "404"), use `--line` ou `--line-strong`, que são tokens de
> elemento decorativo e não prometem legibilidade.

Opacidade em **fundo** (`bg-muted/30`, `bg-destructive/10`) e em **borda**
(`border-destructive/30`, `ring-foreground/10`) continua liberada: não carrega
texto, e o par que importa é o do texto por cima — que deve ser reconferido
contra o fundo composto, não contra o token puro.

---

## 5. Migração dos tokens que somem

O `globals.css` de hoje tem 4 níveis de marca. `brand-400` e `brand-900` não
existem na V2. São **13 ocorrências em 3 padrões** — a migração é pequena.

| Uso hoje | Onde | Destino |
|---|---|---|
| `hover:text-brand-400` sobre `text-brand-600` (9×) | `article-card`, `news-detail`, `[locale]/page`, 3 × `not-found`, `about`, `unsubscribe`, `not-found` raiz | `text-link hover:text-link-hover` — escurece no hover em vez de clarear, e sai do amarelo |
| `from-brand-600 to-brand-400` (2×) | `news-card:36`, `news-detail:40` | `from-brand-600 to-brand-500` |
| `hover:text-brand-400` sobre `text-white/70` (1×) | `footer:37` | `hover:text-white` — no rodapé escuro o contraste vem do branco |
| `bg-brand-900` (1×) | `footer:12` | `bg-surface-brand` (→ `brand-950`) |

`brand-600` (33 usos) e `brand-100` (6 usos) mantêm o nome e mudam de valor —
mas passam a ser consumidos pela camada semântica, não diretamente.

Nenhum dos 448 testes faz asserção sobre classe de marca, então a troca não
quebra a suíte. O lado ruim disso: a suíte também não protege contra a
regressão visual — é o que a baseline em `baseline-v1/` cobre.

---

## 6. A camada do shadcn

O `globals.css` mapeia **31 variáveis semânticas** para as cores atuais.
Trocar apenas os `--brand-*` deixaria `Button`, `Card`, `Badge` e `Input` com a
paleta velha. Mapeamento completo:

| Variável shadcn | Claro | Escuro |
|---|---|---|
| `--background` | `paper` | `night-900` |
| `--foreground` | `ink-950` | `mist-100` |
| `--card` | `white` | `night-800` |
| `--card-foreground` | `ink-950` | `mist-100` |
| `--popover` | `white` | `night-700` |
| `--popover-foreground` | `ink-950` | `mist-100` |
| `--primary` | `brand-700` | `brand-700` |
| `--primary-foreground` | `white` | `white` |
| `--secondary` | `brand-50` | `night-700` |
| `--secondary-foreground` | `brand-950` | `mist-100` |
| `--muted` | `brand-50` | `night-700` |
| `--muted-foreground` | `ink-500` | `mist-400` |
| `--accent` | `brand-100` | `night-700` |
| `--accent-foreground` | `brand-950` | `mist-100` |
| `--destructive` | `danger-600` | `danger-400` |
| `--border` | `line` | `rgba(255,255,255,.10)` |
| `--input` | `line-strong` | `night-500` |
| `--ring` | `brand-700` | `ember-500` |
| `--chart-1` … `--chart-5` | ver abaixo | ver abaixo |
| `--sidebar-*` (8 variáveis) | **remover** | **remover** |

Duas observações que economizam trabalho na Fase 1:

- **`--primary` passa a ser `brand-700`, não `brand-600`.** É o botão sólido com
  texto branco, e só `brand-700` passa AA nesse par (§4).
- **As 8 variáveis `--sidebar-*` não são usadas em lugar nenhum.** Não existe
  componente de sidebar no projeto; elas vieram no boilerplate do shadcn.
  A Fase 1 deve apagá-las em vez de traduzi-las.

`--chart-1..5` **são** usadas — `components/dashboard/category-bars.tsx` monta as
barras por categoria com elas. Hoje são as 5 cores da marca, o que faz o gráfico
parecer decoração e não dado. A V2 usa uma rampa com matiz variado e luminância
crescente, legível nos dois temas:

| | Claro | Escuro |
|---|---|---|
| `--chart-1` | `#A83E1C` | `#F07A45` |
| `--chart-2` | `#C97A1E` | `#F0B45E` |
| `--chart-3` | `#5E7A4A` | `#9DC183` |
| `--chart-4` | `#3D6B7D` | `#7FB4C9` |
| `--chart-5` | `#6B5B8A` | `#B0A0D0` |

---

## 7. Tipografia — decidido

**Headlines: Newsreader. Interface: Inter.**

A §5 lista opções sem escolher, e a §40.3 já fixou que o wordmark é tipográfico
na fonte de interface — o logo depende desta decisão, então ela não podia
atravessar para a Fase 2.

Por que este par:

- **Newsreader** é serif editorial contemporânea, variável, com ótimo
  comportamento em tamanhos grandes de manchete e boa cor de texto em corrido.
- **Inter continua** porque já está no projeto e suas métricas estão validadas
  em produção. Trocar as duas fontes ao mesmo tempo dobraria o risco de CLS e de
  regressão de performance numa fase que já mexe em tudo.
- Sai o **Bricolage Grotesque** (`--font-display` atual).

Ambas estão no Google Fonts e continuam carregando por `next/font/google`, que
faz self-host e elimina a requisição a domínio de terceiro.

### Escala

Nomeada por papel, não por tamanho. `clamp()` cobre o intervalo mobile→desktop
sem breakpoint.

| Token | Tamanho | Altura | Fonte | Uso |
|---|---|---|---|---|
| `--text-display` | `clamp(2.25rem, 1.5rem + 3vw, 3.5rem)` | 1.05 | serif | manchete do hero |
| `--text-h1` | `clamp(1.875rem, 1.4rem + 2vw, 2.75rem)` | 1.1 | serif | título de artigo |
| `--text-h2` | `clamp(1.5rem, 1.25rem + 1vw, 2rem)` | 1.2 | serif | seção editorial |
| `--text-h3` | `1.375rem` | 1.3 | serif | título de card grande |
| `--text-h4` | `1.125rem` | 1.35 | sans | título de card compacto |
| `--text-body-lg` | `1.125rem` | 1.7 | serif | corpo do artigo |
| `--text-body` | `1rem` | 1.65 | sans | corpo geral |
| `--text-body-sm` | `0.9375rem` | 1.6 | sans | dek, resumo de card |
| `--text-meta` | `0.8125rem` | 1.4 | sans | fonte, data, tempo de leitura |
| `--text-overline` | `0.6875rem` | 1.2 | sans | kicker de categoria, `.08em`, maiúsculas |

A regra da §5 vira: manchete serif, subtítulo conforme contexto, metadata e
navegação sans, números e indicadores sans semibold.

---

## 8. Forma, profundidade e ritmo

### Radius (§12)

| Token | Valor | Uso |
|---|---|---|
| `--radius-none` | `0` | faixas editoriais de largura total |
| `--radius-sm` | `4px` | badges retangulares, chips |
| `--radius-md` | `8px` | inputs, botões |
| `--radius-lg` | `12px` | cards |
| `--radius-full` | `9999px` | badges pill, avatares |

Substitui o `--radius: 0.625rem` (10px) atual e seus quatro derivados
calculados. O objetivo da §12 — parecer publicação, não template SaaS — vem de
usar `0` e `12px` como extremos, não de arredondar tudo igual.

### Sombra (§12)

Conteúdo editorial não tem sombra. Separação vem de borda, superfície e espaço.

| Token | Valor | Uso |
|---|---|---|
| `--shadow-none` | `none` | **padrão de todo card editorial** |
| `--shadow-overlay` | `0 4px 16px rgb(17 19 21 / .10)` | dropdown, menu mobile |
| `--shadow-modal` | `0 16px 48px rgb(17 19 21 / .18)` | modal, dialog |

No escuro as duas sombras sobem para `.40` e `.60` de opacidade — sombra sobre
fundo escuro precisa ser mais densa para existir.

Os dois usos de profundidade que existem hoje têm destino direto: o `shadow-lg`
do painel do menu mobile (`navbar.tsx:106`) vira `--shadow-overlay`, e o
`ring-1 ring-foreground/10` do `ui/card.tsx:15` vira `--line` — é uma divisória
decorativa, não a borda de um controle, então não precisa dos 3:1 da §4.
O hover lift dos cards da V1 (sombra ao passar o mouse) sai: pela §12 a
separação de conteúdo editorial vem de borda e espaço, não de elevação.

### Espaço e medida

A escala de 4px do Tailwind continua. O que falta é o ritmo editorial:

| Token | Valor | Uso |
|---|---|---|
| `--space-section` | `clamp(2.5rem, 2rem + 2vw, 4.5rem)` | entre blocos da Home |
| `--space-block` | `clamp(1.5rem, 1.25rem + 1vw, 2.5rem)` | entre elementos de um bloco |
| `--gutter` | `clamp(1rem, 0.5rem + 2vw, 2rem)` | margem lateral da página |
| `--content-prose` | `68ch` | corpo do artigo |
| `--content-narrow` | `45rem` | formulários, páginas de texto |
| `--content-wide` | `80rem` | grade editorial (= `max-w-7xl` de hoje) |

Breakpoints seguem os padrões do Tailwind v4 (640/768/1024/1280/1536). As
larguras de captura da §30 (375/768/1024/1440/1920) são pontos de **verificação**,
não breakpoints — não devem virar `@media` novos.

### Motion (§14)

| Token | Valor |
|---|---|
| `--duration-fast` | `120ms` |
| `--duration-base` | `180ms` |
| `--duration-slow` | `240ms` |
| `--ease-standard` | `cubic-bezier(.2, 0, 0, 1)` |
| `--ease-exit` | `cubic-bezier(.4, 0, 1, 1)` |

Toda animação respeita `prefers-reduced-motion` — o padrão `motion-reduce:` já
usado no hero do artigo vira regra geral, não exceção.

### Camadas

| Token | Valor |
|---|---|
| `--z-base` | `0` |
| `--z-dropdown` | `30` |
| `--z-header` | `50` |
| `--z-overlay` | `60` |
| `--z-modal` | `70` |
| `--z-toast` | `80` |

O header sticky de hoje já usa `z-50`; o overlay do menu mobile usa `z-40` e o
menu `z-50` — a tabela acima corrige essa inversão (overlay abaixo do conteúdo
que ele escurece).

---

## 9. Como isso vira código na Fase 1

O `apps/web` usa **Tailwind v4**: não existe `tailwind.config.js`, e os tokens
são variáveis CSS expostas por `@theme inline`. A estrutura fica:

```css
/* styles/tokens.css */
@layer base {
  :root {
    /* camada 1 — paleta, não muda com o tema */
    --brand-700: #a83e1c;
    --ink-950: #111315;
    --paper: #faf9f7;
    /* ... */

    /* camada 2 — semântica, tema claro */
    --bg: var(--paper);
    --text-primary: var(--ink-950);
    --link: var(--brand-700);
    /* ... */
  }

  .dark {
    /* camada 2 — só a semântica é redeclarada */
    --bg: var(--night-900);
    --text-primary: var(--mist-100);
    --link: var(--ember-500);
    /* ... */
  }
}

@theme inline {
  /* é isto que gera as utilities: bg-bg, text-primary, border-line... */
  --color-bg: var(--bg);
  --color-text-primary: var(--text-primary);
  /* ... */
}
```

`globals.css` importa `tokens.css`. **O `@import` precisa vir antes de qualquer
regra** — é exigência do CSS, não do Tailwind, e é o erro mais provável dessa
etapa.

A camada 1 é declarada uma vez; só a camada 2 é redeclarada no `.dark`. É por
isso que a arquitetura da §1 importa na prática: o bloco `.dark` fica com ~18
linhas em vez de repetir a paleta inteira, como o `globals.css` de hoje faz.

---

## 10. Checklist de saída da Fase 1

Fechado em 20/08/2026, na branch `feat/v2-design-foundation`.

- [x] `styles/tokens.css` criado e importado antes das regras do `globals.css`
- [x] as 13 ocorrências de `brand-400`/`brand-900` migradas conforme §5
- [x] as 8 variáveis `--sidebar-*` removidas
- [x] `--chart-1..5` com a rampa nova; as 10 cores medidas contra o trilho da
      barra nos 2 temas (`brand-50` e `night-700`), todas acima de 3:1 —
      conferência visual fica para a captura da baseline v2
- [x] nenhum componente usando `bg-brand-*`/`text-brand-*` direto (só semântica)
- [x] `text-green-*`/`text-emerald-*` trocados por `--success` (4 usos)
- [x] `text-muted-foreground/40,50,70` trocados por token sólido ou `--line` (§4, "Modificadores de opacidade")
- [x] `shadow-lg` e `ring-foreground/10` mapeados conforme §8
- [x] Newsreader no lugar do Bricolage Grotesque em `app/[locale]/layout.tsx`
- [x] contraste reconferido nos pares da §4 **e nas composições de opacidade** depois
      que a interface existir
- [x] `pnpm test` verde — **480 testes em 52 suites** (365 API + 115 web), mais
      `pnpm lint` e `pnpm --filter @newranews/web build` limpos
- [x] **Lighthouse por rota** — medido contra produção depois do merge, pelo
      mesmo workflow que produziu a tabela da §3.1 ([run
      32419365560](https://github.com/tavinholoco/newra-news/actions/runs/32419365560)).
      Resultado na §12 abaixo
- [x] **Baseline visual da V2** — 39 capturas em `baseline-v2/`, de produção

---

## 11. O que a Fase 1 mudou no caminho

Três coisas não sobreviveram ao contato com o Tailwind v4 e com a medição.
Todas alteram este documento, não só o código.

### 11.1 A camada 1 não vira utility — de propósito

A §1 diz que componentes usam só a camada 2, mas isso era uma convenção: nada
impedia alguém de escrever `bg-brand-600`. Na implementação a paleta ficou
**fora** do `@theme inline`, então essas classes simplesmente não existem.

O efeito colateral é a única armadilha da decisão: uma classe de camada 1 não
gera erro de build, só deixa de pintar. É por isso que
`tests/lib/design-tokens.test.ts` varre `app/` e `components/` procurando
por elas — junto com opacidade sobre `--text-muted`, cor crua do Tailwind e
sombra fora dos dois tokens de overlay.

A exceção da §1 (material de marca genuíno) ganhou nome próprio:
`--brand-mark` e `--brand-mark-soft`, fixos nos dois temas, usados pelo
placeholder de imagem dos cards.

### 11.2 Quatro renomeações por colisão de namespace

O Tailwind v4 reserva prefixos de variável para gerar utilities, e três nomes
da §3 caíam em cima deles. Os valores não mudaram:

| §3 | implementado | por quê |
|---|---|---|
| `--text-primary`, `--text-secondary`, `--text-muted` | `--ink`, `--ink-secondary`, `--ink-muted` | `--text-*` é o namespace de **font-size** do Tailwind v4 — `--text-primary` viraria um tamanho de fonte chamado "primary" |
| `--text-on-brand` | `--on-brand` | idem |
| `--accent`, `--accent-solid`, `--accent-solid-hover` | `--brand-accent`, `--brand-solid`, `--brand-solid-hover` | `--accent` já é do shadcn (§6) **com outro valor** — a §3 e a §6 usavam o mesmo nome para coisas diferentes |
| paleta `line`, `line-strong` | `--line-100`, `--line-500` | colidiam com os papéis semânticos de mesmo nome; a numeração segue a do resto da paleta |

### 11.3 `danger-400` reprova sobre a superfície de marca

O rodapé é `--surface-brand` — escuro **nos dois temas**, como `--brand-solid`.
Por isso o formulário de inscrição não pode usar `--danger`/`--success`, que
invertem com o tema: no claro eles são os valores escuros, ilegíveis ali.

A saída natural seria fixar o par no valor de tema escuro, e é o que
`--success-on-brand` faz (`success-400` dá 4,77:1 sobre `brand-950`). Mas
`danger-400 #F0705F` dá **3,61:1** sobre `brand-950` — passa sobre neutro
escuro (6,48:1 em `night-900`) e reprova sobre o fundo de marca, que é mais
claro e mais quente. Foi acrescentado **`danger-300 #F79A90`** (5,01:1), pelo
mesmo motivo que a Fase 0 acrescentou o par de sucesso: o código precisava da
cor e ela não existia.

`scripts/check-contrast.mjs` mede os 53 pares deste documento mais as
composições de opacidade que o código realmente escreve, lendo os valores do
próprio `tokens.css`. Roda com `pnpm --filter @newranews/web contrast:check` e
sai com código 1 se algum reprovar — foi ele que achou este caso.

### 11.4 O que a revisão da própria fase corrigiu

A primeira versão da Fase 1 passou nos testes e no build com quatro defeitos
dentro. Ficam registrados porque três deles são padrões que a Fase 2 pode
repetir:

1. **`??` no lugar de `||`** em `ArticleMeta`. Com `source: ''` — que a API
   devolve quando o feed não traz o veículo — o coalescing parava na string
   vazia e o componente escondia data e tempo de leitura junto. Coberto por
   teste de regressão.
2. **Ativo e hover com o mesmo fundo** na navegação mobile: `bg-surface-accent`
   nos dois estados. A V1 distinguia com `brand-100` e `brand-100/50`; a
   tradução para a semântica perdeu o segundo nível. Voltou como `bg-accent`
   (ativo, `brand-100`) contra `bg-surface-accent` (hover, `brand-50`).
   **Migrar cor um a um perde a relação entre estados** — conferir o par, não a
   classe.
3. **`z-base` (0) num scrim.** Traduzir `z-40` para o token mais próximo em
   valor é o inverso do que a tabela da §8 quer: o scrim é `--z-overlay` e o
   painel `--z-modal`, porque o menu mobile se comporta como folha modal.
   Funciona hoje por acidente — os dois nascem dentro do `<header>`, que tem
   z-index e portanto abre contexto de empilhamento próprio. A tabela só passa
   a valer de verdade quando a Fase 2 tirar a navegação de dentro do masthead.
4. **Dois nomes para 12px.** `--radius-xl` e `--radius-2xl` tinham sido
   aliasados para `12px` em vez de as 29 classes serem migradas — o que deixava
   `rounded-lg`, `rounded-xl` e `rounded-2xl` idênticos e a escala da §8 com
   três nomes a mais do que ela define. As classes foram migradas para
   `rounded-lg` e os dois aliases, removidos.

Duas correções menores no mesmo passo: as `@utility` de duração passaram a
escrever também `--tw-duration` (sem isso a duração só vencia o
`transition-duration: var(--tw-duration, …)` do Tailwind por vir depois no
arquivo — ordem de emissão, não regra), e o estado vazio de `favorites-list`
recuperou a hierarquia que sumiu quando o `/70` do hint virou token sólido.

`design-tokens.test.ts` cobre hoje sete invariantes: camada 1, opacidade sobre
`--text-muted`, cor crua do Tailwind, escala de radius, escala de duração,
sombra fora dos overlays, e a integridade do próprio `tokens.css`.

### 11.5 Ficou para a Fase 2

Nada bloqueante, mas registrado para não parecer esquecimento:

- **`container-editorial`, a escala tipográfica e os tokens de ritmo existem e
  não são usados ainda.** O Tailwind v4 só emite a utility quando alguém a
  escreve, então `text-h1`, `py-section` e `max-w-prose` não estão no CSS
  gerado. As páginas continuam com `max-w-7xl px-4 sm:px-6 lg:px-8` — trocar o
  contêiner é reflow de layout, que é o trabalho da Fase 2, não da foundation.
- **O `heading-order` do grid de notícias continua quebrado** (§3.3 do
  diagnóstico). É estrutura semântica, e a reorganização editorial que a
  corrige é da Fase 3.

---

## 12. Lighthouse — a Fase 1 medida em produção

Mediana de 3 execuções por rota, runner do GitHub, 20/08/2026
([run 32420796553](https://github.com/tavinholoco/newra-news/actions/runs/32420796553)),
mesmo workflow e mesmas URLs que produziram a tabela da §3.1 do diagnóstico.

| Rota | Performance | Acessibilidade | Best practices | SEO |
|---|---|---|---|---|
| `/pt-BR` | 97 <sub>(=)</sub> | **100** <sub>(+4)</sub> | 96 <sub>(=)</sub> | 100 <sub>(=)</sub> |
| `/pt-BR/news` | 98 <sub>(+3)</sub> | **98** <sub>(+3)</sub> | 96 <sub>(=)</sub> | 100 <sub>(=)</sub> |
| `/pt-BR/article` | 96 <sub>(−1)</sub> | **98** <sub>(+4)</sub> | 96 <sub>(=)</sub> | 100 <sub>(=)</sub> |
| `/pt-BR/about` | 97 <sub>(−1)</sub> | **100** <sub>(+4)</sub> | 96 <sub>(=)</sub> | 100 <sub>(=)</sub> |
| `/en` | 98 <sub>(=)</sub> | **100** <sub>(+4)</sub> | 96 <sub>(=)</sub> | 100 <sub>(=)</sub> |

**A acessibilidade sobe nas cinco rotas.** Três fecham em 100 sem nenhuma
auditoria reprovando. Conferido nos relatórios, auditoria por auditoria, nas
três execuções de cada rota:

| Rota | Reprovando |
|---|---|
| `/pt-BR`, `/en`, `/pt-BR/about` | nenhuma |
| `/pt-BR/news`, `/pt-BR/article` | só `heading-order` |

**`color-contrast` desapareceu das cinco rotas.** Era ele que segurava os
scores em 94–96 na V1, por dois defeitos estruturais de token: branco sobre
`brand-600` em 16 elementos (3,27:1) e `text-white/50` no rodapé (4,04:1). O
`heading-order` que sobra é estrutura semântica, não estilo — a §3.3 do
diagnóstico já o atribui à reorganização editorial da Fase 3.

**Performance fica de pé.** `/news` ganha 3 pontos; duas rotas marcam 1 abaixo
da V1, o que é ruído entre execuções — o First Load JS da home é o mesmo 157 kB
da baseline e nenhuma auditoria de performance mudou de veredito. Registrado
como saiu, sem arredondar.

### O que a primeira medição encontrou de errado

A leitura anterior ([run 32419365560](https://github.com/tavinholoco/newra-news/actions/runs/32419365560))
tinha a home e `/en` ainda reprovando em `color-contrast`, e a causa era um erro
da própria Fase 1:

```
Element has insufficient color contrast of 4.2
(foreground #c94f22, background #fcf5f0, font size 14px)
<span class="font-display text-sm font-semibold uppercase tracking-wider">
```

É o kicker "ARTIGO DO DIA" do `article-card`. Na V1 ele era `text-brand-600`; a
migração o traduziu para `text-brand-accent`, que é o mesmo `brand-600`. Sobre
`surface-accent` isso dá **4,21:1** — passa os 3:1 de ícone e reprova os 4,5:1
de texto.

A regra da §4 estava escrita ("links e texto em laranja usam `brand-700`") e o
`check-contrast.mjs` até media esse par — **classificado como ícone**, porque foi
assim que eu li o elemento. Ele tinha ícone *e* texto na mesma linha, e a cor
herdava para os dois. Passou por build, lint, 480 testes e pelo próprio script
de contraste; só caiu numa página real.

Corrigido para `text-link` (5,77:1), com o par de texto acrescentado ao script.
A lição, para as Fases 2–7: **`--brand-accent` é preenchimento, ícone e borda;
no instante em que houver texto na mesma linha, o token é `--link`.**
