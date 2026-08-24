// Layout raiz obrigatório pelo App Router — apenas repassa os children.
// O <html>/<body>, providers e header/footer vivem em app/[locale]/layout.tsx,
// que conhece o locale (necessário para lang, metadata e NextIntlClientProvider).
//
// **A folha de estilo é importada aqui, e é o que conserta a 404 sem CSS.** O
// `globals.css` era importado só pelo layout de idioma, e o Next associa cada
// CSS à entrada que primeiro o importa: a rota `_not-found` da raiz **não passa
// por aquele layout**, então não recebia o chunk. Importar o mesmo arquivo lá
// dentro não resolve — o Next deduplica e o chunk continua onde estava; medido,
// a 404 recebia 3,4 kB de CSS (só as `@font-face` do `next/font`) contra 56 kB
// da Home. Daqui, a folha alcança **toda** rota, inclusive a que não tem
// layout de idioma.
import '@/styles/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
