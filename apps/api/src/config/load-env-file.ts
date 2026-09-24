/**
 * Carrega o `.env` da API no `process.env` — em silêncio.
 *
 * **Até a 17 o `dotenv/config` não escrevia nada; a 18 escreve.** Medido em
 * 24/09/2026: a 18 imprime `◇ injected env (N) from .env` no stderr a cada
 * boot, e sem `.env` (o Render, onde as variáveis vêm do painel) a linha sai
 * do mesmo jeito, com `(0)`. É uma linha fora do JSON do pino num processo
 * cujo log inteiro é JSON desde a Fase 1 do plano de observabilidade. O
 * `quiet: true` explícito vence o `DOTENV_CONFIG_QUIET` do ambiente, então
 * nenhuma variável esquecida no painel reacende a linha.
 *
 * **É um módulo de efeito colateral de propósito, e não uma chamada no corpo
 * de quem precisa do `.env`.** Import é içado: com `config()` no corpo, todo
 * import do arquivo roda **antes** dele — e o `gates:rehearse` importa o
 * `@newranews/database` logo abaixo, que precisa do `DATABASE_URL` já no
 * ambiente. Importado primeiro, este arquivo ocupa o lugar exato do antigo
 * `import 'dotenv/config'`, na mesma ordem.
 *
 * Guarda em `tests/config/load-env-file.test.ts`: o carregamento não escreve
 * nada, nenhum outro arquivo importa o `dotenv` direto, e quem importa este
 * arquivo o importa **primeiro**.
 */
import { config } from 'dotenv';

config({ quiet: true });
