# Frontend — Next.js

## Arquitetura
- Next.js 14+ com App Router
- Tailwind CSS + shadcn/ui para componentes
- TanStack Query para data fetching client-side
- ISR para todas as páginas dinâmicas (revalidate: 3600)
- SSG para páginas estáticas (Sobre, 404)

## Padrões
- Componentes em components/ organizados por domínio
- shadcn/ui em components/ui/ (não modificar diretamente)
- Hooks customizados em lib/queries.ts (TanStack Query)
- Client HTTP configurado em lib/api.ts
- Utilitários em lib/utils.ts

## Páginas
- / → Home com feed de notícias (ISR)
- /news → Listagem com filtros (ISR + CSR para filtros)
- /news/[id] → Notícia individual (ISR)
- /article → Histórico de artigos (ISR)
- /article/[date] → Artigo diário (ISR)
- /about → Sobre o projeto (SSG)

## SEO
- Meta tags dinâmicas via generateMetadata() em cada page
- Open Graph tags para compartilhamento social
- Sitemap gerado automaticamente

## Estilo
- Mobile-first com Tailwind
- Variáveis CSS do shadcn/ui para temas
- Sem CSS modules ou styled-components