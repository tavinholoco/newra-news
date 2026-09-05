import { z } from 'zod';
import 'dotenv/config';

/**
 * Os niveis do pino, do mais severo ao menos. `silent` desliga o log sem tirar
 * o logger do lugar.
 *
 * **Mora aqui e nao em `utils/logger.ts` porque o schema e quem valida** — e
 * porque o logger importa este arquivo, entao o caminho contrario seria ciclo.
 * Escrever a lista nos dois e vocabulario duplicado, que e o defeito que este
 * projeto ja pagou com o `13` dos feeds: numero (ou lista) que descreve uma
 * colecao sai derivado da colecao, nunca digitado num segundo lugar.
 */
export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  // Provider principal de noticias (NewsData.io) — opcional ate ser configurado
  // no ambiente (Render). Sem ela, o pipeline roda apenas com RSS.
  NEWSDATA_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GROQ_API_KEY: z.string().min(1),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b'),
  JOB_SECRET: z.string().min(1),
  // Barra final quebra o CORS: o browser compara o header `Origin` byte a
  // byte com `Access-Control-Allow-Origin`, e `https://site.com/` NÃO casa
  // com `Origin: https://site.com` (bug real em produção 2026-08-16 — painel
  // admin bloqueado no browser). Normaliza removendo barras finais.
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.replace(/\/+$/, '')),
  // Endereco publico da API. So o documento OpenAPI o usa: sem ele o `servers`
  // anunciava o bind (`http://0.0.0.0:3001` em producao), que nao e endereco de
  // ninguem. Opcional porque em desenvolvimento o bind local esta certo.
  API_PUBLIC_URL: z
    .string()
    .url()
    .optional()
    .transform((value) => value?.replace(/\/+$/, '')),
  CRON_SCHEDULE: z.string().default('0 8 * * *'),
  CRON_TIMEZONE: z.string().default('America/Sao_Paulo'),
  // Newsletter — opcional; sem RESEND_API_KEY o envio é pulado (graceful)
  RESEND_API_KEY: z.string().optional(),
  SITE_URL: z.string().url().default('http://localhost:3000'),
  NEWSLETTER_FROM: z.string().default('Newra News <news@newranews.com>'),
  // Auth — JWT compartilhado com o frontend (web assina, API valida)
  AUTH_JWT_SECRET: z.string().optional(),
  // E-mails que nascem com role ADMIN (lista separada por vírgula)
  ADMIN_EMAILS: z.string().default(''),
  // Nivel do log estruturado. **Sem `default` de proposito**: `utils/logger.ts`
  // resolve a ausencia para `info`, e para `silent` em teste — com um default
  // aqui, "nao configurado" e "configurado como info" seriam indistinguiveis, e
  // nao haveria como pedir `LOG_LEVEL=debug` numa suite que esta sendo depurada.
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues.map(
    (i) => `  - ${i.path.join('.')}: ${i.message}`,
  );
  // **O unico `console.*` que sobrevive na API, e a razao e de ordem de carga:**
  // isto roda no `import` do modulo, antes de `utils/logger.ts` existir — ele
  // importa este arquivo —, e termina em `process.exit(1)`. Um logger aqui seria
  // um logger configurado pelas variaveis que acabaram de ser declaradas
  // invalidas. A excecao esta escrita tambem em
  // `tests/security/secrets-in-logs.test.ts`, e as duas tem de concordar.
  // eslint-disable-next-line no-console
  console.error(
    [
      '',
      '╔══════════════════════════════════════════════════╗',
      '║  Missing or invalid environment variables:       ║',
      '╚══════════════════════════════════════════════════╝',
      '',
      ...missing,
      '',
      'Copy apps/api/.env.example → apps/api/.env and fill in the values.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

export const env = result.data;

export type Env = z.infer<typeof envSchema>;
