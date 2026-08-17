import { z } from 'zod';
import 'dotenv/config';

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
  GROQ_MODEL: z.string().default('llama-3.1-8b-instant'),
  JOB_SECRET: z.string().min(1),
  // Barra final quebra o CORS: o browser compara o header `Origin` byte a
  // byte com `Access-Control-Allow-Origin`, e `https://site.com/` NÃO casa
  // com `Origin: https://site.com` (bug real em produção 2026-08-16 — painel
  // admin bloqueado no browser). Normaliza removendo barras finais.
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.replace(/\/+$/, '')),
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
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing = result.error.issues.map(
    (i) => `  - ${i.path.join('.')}: ${i.message}`,
  );
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
