import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Middleware do next-intl: negocia o locale (cookie NEXT_LOCALE → accept-language
// → default pt-BR) e redireciona URLs sem prefixo para `/pt/...` ou `/en/...`
// (localePrefix: 'always'). A preferência fica salva no cookie NEXT_LOCALE.
export default createMiddleware(routing);

export const config = {
  // Roda apenas em páginas — exclui rotas de API, assets do Next e arquivos
  // estáticos (ex.: favicon.ico, sitemap.xml, imagens).
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
