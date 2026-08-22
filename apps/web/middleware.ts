import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Middleware do next-intl: negocia o locale (cookie NEXT_LOCALE → accept-language
// → default pt-BR) e redireciona URLs sem prefixo para `/pt/...` ou `/en/...`
// (localePrefix: 'always'). A preferência fica salva no cookie NEXT_LOCALE.
export default createMiddleware(routing);

export const config = {
  // Roda apenas em páginas — exclui rotas de API, assets do Next e arquivos
  // estáticos (ex.: favicon.ico, sitemap.xml, imagens).
  //
  // **`opengraph-image` e `apple-icon` precisam estar aqui, e a Fase 7 achou
  // isso medindo produção.** O `.*\..*` do fim exclui tudo que tem extensão —
  // e é por isso que `/icon.svg`, `/sitemap.xml` e `/robots.txt` sempre
  // funcionaram. Mas as rotas de metadata **geradas** (`opengraph-image.tsx`,
  // `apple-icon.tsx`) são servidas em URL **sem extensão**: o middleware as
  // tratava como página sem idioma e devolvia 307 para
  // `/pt-BR/opengraph-image`, que é 404. Resultado medido em produção: a
  // imagem de compartilhamento do site e o ícone do iOS estavam inalcançáveis
  // desde que existem. `twitter-image` entra por antecipação — é a mesma
  // convenção e cairia na mesma armadilha.
  matcher:
    '/((?!api|_next|_vercel|opengraph-image|twitter-image|apple-icon|.*\\..*).*)',
};
