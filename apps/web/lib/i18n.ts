import { routing } from '@/i18n/routing';

// Constantes derivadas da config central de roteamento (i18n/routing.ts) para
// não duplicar a lista de locales em vários lugares.
export const LOCALES = routing.locales;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = routing.defaultLocale;

export function isSupportedLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/**
 * **O `now` do next-intl, fixo — e é o que faz uma regeneração da ISR sair
 * byte a byte igual à anterior.**
 *
 * O `NextIntlClientProvider` renderizado no servidor herda `now` da
 * configuração da requisição, e o padrão dela é `new Date()` **a cada
 * requisição** (`getConfig`: `now: result.now || getDefaultNow()`). O valor é
 * serializado no payload RSC de toda página — `"now":"$D2026-09-19T13:00:06Z"`
 * — então duas regenerações da mesma página com o mesmo dado nunca são
 * iguais. A Vercel só cobra ISR Write quando o conteúdo mudou, e aqui ele
 * "mudava" sempre: medido em 19/09/2026, a Home (53 unidades de 8 KB), `/news`
 * (28) e `/article` (26), regenerando de hora em hora nos dois idiomas,
 * somavam ~5.100 unidades/dia — 150 mil em 30 dias, o número do aviso de 75%
 * da cota do Hobby, sem precisar de um visitante sequer.
 *
 * Ninguém aqui lê esse relógio: nenhum `useNow`, nenhum `relativeTime`, nenhum
 * `getNow` — a guarda `tests/lib/isr-determinism.test.ts` mantém isso assim
 * enquanto o valor estiver fixo. Se um dia um componente precisar de "agora",
 * ele lê o relógio no cliente (num efeito, como a armadilha do relógio no
 * render já manda), nunca por este valor.
 *
 * A época é a mesma de `Date(0)`: um valor que qualquer leitor do payload
 * reconhece como pino, e não como uma data que alguém quis dizer.
 */
export const STATIC_NOW = new Date(0);

/**
 * O idioma pelo primeiro segmento do caminho — `/en/news/…` → `en`.
 *
 * Existe para o `global-error.tsx`, o único lugar que renderiza fora do
 * provider do next-intl (armadilha 9 do plano de observabilidade) e que
 * **não pode** ler `document.documentElement.lang`: no instante do render o
 * `<html>` do documento é o que está sendo substituído. Com
 * `localePrefix: 'always'`, o pathname é determinístico — e é o mesmo dado
 * que o reporter já manda como `path`. Sem prefixo, o padrão.
 */
export function localeFromPathname(pathname: string): Locale {
  const first = pathname.split('/')[1];
  return isSupportedLocale(first) ? first : DEFAULT_LOCALE;
}

/** Locale BCP-47 → locale de formatação de datas/números (Intl). */
export function toDateFormatLocale(locale: string): string {
  return locale === 'en' ? 'en-US' : 'pt-BR';
}
