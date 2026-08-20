// Links de navegação com a chave de tradução do label (namespace `nav.*` em
// messages/{locale}.json) — os componentes traduzem via next-intl.
export const NAV_LINKS = [
  { href: '/', key: 'home' },
  { href: '/news', key: 'news' },
  { href: '/article', key: 'articles' },
  { href: '/about', key: 'about' },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];
