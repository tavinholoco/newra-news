import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      /**
       * O id **da API**, e so ele.
       *
       * Opcional porque ha um estado real em que ele nao existe: a conta ainda
       * nao foi confirmada pela API (`POST /api/auth/upsert` falhou e a
       * retentativa ainda nao passou). Antes da revisao da Fase 11 o tipo dizia
       * `string` e o valor caia no id do **provedor** nesse caso — o que fazia
       * o BFF assinar um token para um usuario que nao existe no banco.
       */
      id?: string;
      role?: 'USER' | 'ADMIN';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'USER' | 'ADMIN';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** O id da API. Ausente enquanto o upsert nao tiver confirmado. */
    id?: string;
    role?: 'USER' | 'ADMIN';
    /** Epoch em ms antes do qual nao se tenta o upsert de novo. */
    upsertRetryAfter?: number;
  }
}
