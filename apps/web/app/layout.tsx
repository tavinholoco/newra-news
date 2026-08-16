// Layout raiz obrigatório pelo App Router — apenas repassa os children.
// O <html>/<body>, providers e header/footer vivem em app/[locale]/layout.tsx,
// que conhece o locale (necessário para lang, metadata e NextIntlClientProvider).
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
