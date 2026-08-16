import { defineRouting } from 'next-intl/routing';

// Fonte de verdade do roteamento i18n: usado pelo middleware, pelo request
// config, pelas APIs de navegação e pelo generateStaticParams.
// localePrefix 'always' → URLs `/pt/...` e `/en/...` (permite renderização
// estática + ISR por idioma; o middleware redireciona URLs sem prefixo).
export const routing = defineRouting({
  locales: ['pt-BR', 'en'],
  defaultLocale: 'pt-BR',
  localePrefix: 'always',
});
