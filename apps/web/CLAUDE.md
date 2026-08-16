# Frontend — Next.js

## Arquitetura
- Next.js 14+ com App Router
- Tailwind CSS + shadcn/ui para componentes
- TanStack Query para data fetching client-side
- **i18n com next-intl v3 (roteamento por prefixo)** — URLs `/pt-BR/...` e
  `/en/...` (`localePrefix: 'always'`); o middleware redireciona URLs sem
  prefixo para o locale negociado (cookie `NEXT_LOCALE` → accept-language →
  default `pt-BR`); `i18n/request.ts` resolve o locale do segmento `[locale]`,
  `messages/{pt-BR,en}.json` têm as strings; server components usam
  `getTranslations`/`setRequestLocale`, client components usam
  `useTranslations`/`useLocale`; navegação via `@/i18n/navigation` (Link/
  `usePathname`/`useRouter` aplicam o prefixo automaticamente)
- **Renderização estática + ISR por idioma** — com `generateStaticParams` +
  `setRequestLocale`, cada página é SSG (`revalidate: 3600`) para pt-BR e en
- **Restrição importante** — o `app/layout.tsx` raiz é pass-through (sem
  `<html>`); **não criar `loading.tsx`/`error.tsx` na raiz** (seus boundaries
  caem fora do `<html>` e quebram a hidratação — ``Only one element on
  document allowed``). Eles vivem em `app/[locale]/`; o `not-found.tsx` raiz
  deve renderizar `<html>`/`<body>` próprios (fora de qualquer layout)
- **Revalidação on-demand** — `app/api/cron/daily-news/route.ts` chama
  `revalidatePath('/[locale]', 'layout')` + `revalidatePath('/sitemap.xml')`
  após o trigger do pipeline. **Gotcha:** o cache do Next grava as tags com o
  padrão literal da rota (`_N_T_/[locale]/layout`), então revalidar por
  caminho resolvido (`/pt-BR`, `/en`) **não invalida nada** — use sempre o
  padrão `/[...]`

## i18n (regras rápidas)
- Toda string de UI deve sair de `messages/{locale}.json` (nunca hardcoded)
- Componentes importados por client components **devem** ser `'use client'` e
  usar `useTranslations` (nunca `getTranslations`, que é server-only)
- Datas/números: passar o locale para `formatDate`/`formatArticleDate`/
  `formatCount` via `toDateFormatLocale()` de `lib/i18n.ts`
- Adicionar/renomear chaves exige atualizar **os dois** JSONs — o teste
  `tests/lib/i18n-messages.test.ts` falha se houver divergência

## Padrões
- Componentes em components/ organizados por domínio
- shadcn/ui em components/ui/ (não modificar diretamente)
- Hooks customizados em lib/queries.ts (TanStack Query)
- Client HTTP configurado em lib/api.ts
- Utilitários em lib/utils.ts

## Páginas
- / → redireciona (307) para /pt-BR ou /en (middleware)
- /[locale]/ → Home com feed de notícias (SSG + ISR)
- /[locale]/news → Listagem com filtros (CSR para filtros)
- /[locale]/news/[id] → Notícia individual (dinâmica)
- /[locale]/article → Histórico de artigos
- /[locale]/article/[date] → Artigo diário (dinâmica)
- /[locale]/about → Sobre o projeto
- /[locale]/dashboard → Métricas (CSR com TanStack Query)

## SEO
- Meta tags dinâmicas via generateMetadata() em cada page
- Open Graph tags para compartilhamento social
- Hreflang: `alternates.languages` ({ 'pt-BR': '/pt-BR/...', en: '/en/...' }) em
  **todas** as generateMetadata — inclusive nas dinâmicas (`news/[id]`,
  `article/[date]`), com o id/date interpolado no path
- Sitemap gerado automaticamente (entradas duplicadas por idioma)

## Estilo
- Mobile-first com Tailwind
- Variáveis CSS do shadcn/ui para temas
- Sem CSS modules ou styled-components