import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { signAuthJwt } from '@/lib/jwt';

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
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/',
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
            const body = (await response.json()) as {
              data?: { id: string; role: 'USER' | 'ADMIN' };
            };
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
