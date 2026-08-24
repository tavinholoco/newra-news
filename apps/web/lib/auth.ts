import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import type { ApiResponse, AuthUpsertResult } from '@newranews/types';
import { signAuthJwt } from '@/lib/jwt';
import { API_TIMEOUT_MS } from '@/lib/timeouts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
  ],
  /**
   * **A duração era o default silencioso do next-auth, e agora é decisão.**
   *
   * O que o next-auth entrega sozinho já está certo e fica onde está: o cookie
   * é `httpOnly` (nenhum script lê a sessão), `sameSite: 'lax'` (não viaja em
   * requisição de outro site, exceto navegação de topo por GET) e ganha
   * `secure` + prefixo `__Secure-` quando a `NEXTAUTH_URL` é HTTPS. **Não
   * declarar `cookies` à mão é parte da decisão** — fixar o nome aqui tiraria
   * o prefixo em produção e derrubaria toda sessão viva no deploy seguinte.
   *
   * O que faltava era o prazo escrito. Trinta dias é o default, e continua
   * sendo o número certo para este produto — a sessão só dá acesso a salvar
   * matéria e trocar preferência, o login é OAuth (não há senha a proteger) e
   * expirar semanalmente cobraria um round-trip no provedor por um ganho que
   * não existe. `updateAge` renova o token no máximo uma vez por dia: sem ele,
   * toda requisição reescreveria o cookie.
   */
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  // Página customizada de sign-in (app/[locale]/signin) com os botões
  // Google/GitHub localizados. Sem isso, signIn() sem provider cai num loop
  // na home (dead-end) e a página padrão do next-auth não é localizada.
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Primeiro sign-in (account existe): persiste o usuário na API via JWT
      // compartilhado (a API fica em outro host e não recebe o cookie do next-auth).
      if (account && user) {
        try {
          const jwt = await signAuthJwt({
            sub: user.id,
            email: user.email ?? '',
            name: user.name,
            image: user.image,
            purpose: 'auth-upsert',
          });

          const response = await fetch(`${API_BASE_URL}/auth/upsert`, {
            method: 'POST',
            // Este é o `fetch` mais caro do produto para o leitor: ele acontece
            // **dentro do callback de sign-in**, com a pessoa olhando uma tela
            // de carregamento do provedor OAuth. Sem prazo, uma API dormindo
            // pendurava o login inteiro.
            signal: AbortSignal.timeout(API_TIMEOUT_MS),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              image: user.image,
            }),
          });

          if (response.ok) {
            // `Partial` porque isto é JSON de rede, e o tipo descreve o
            // contrato, não a garantia: uma resposta 200 sem `data` é possível
            // e o `?.` abaixo é quem trata. O tipo compartilhado entra aqui
            // para que a rota da identidade deixe de ser a única que o web lia
            // por uma forma escrita à mão — ver `AuthUpsertResult`.
            const body = (await response.json()) as Partial<
              ApiResponse<AuthUpsertResult>
            >;
            token.id = body.data?.id ?? user.id;
            token.role = body.data?.role;
          }
        } catch {
          // Não-crítico: usuário segue logado; o upsert será retentado no
          // próximo sign-in. A API 401 só ocorre se o AUTH_JWT_SECRET divergir.
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.role = token.role as 'USER' | 'ADMIN' | undefined;
      }
      return session;
    },
  },
};
