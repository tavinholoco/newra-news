// Links de navegação com a chave de tradução do label (namespace `nav.*` em
// messages/{locale}.json) — os componentes traduzem via next-intl.
export const NAV_LINKS = [
  { href: '/', key: 'home' },
  { href: '/news', key: 'news' },
  { href: '/article', key: 'articles' },
  { href: '/about', key: 'about' },
] as const;

export type NavLink = (typeof NAV_LINKS)[number];

/**
 * Item de navegação montado em runtime — o menu mobile acrescenta links por
 * sessão e por role, que não cabem na tupla literal de `NAV_LINKS`.
 * `key` é a chave de tradução no namespace `nav.*`.
 */
export interface NavItem {
  href: string;
  key: string;
}
