import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
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
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  CRON_SCHEDULE: z.string().default('0 8 * * *'),
  CRON_TIMEZONE: z.string().default('America/Sao_Paulo'),
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
