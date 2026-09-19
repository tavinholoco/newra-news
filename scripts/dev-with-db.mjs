// Sobe o postgres antes do comando de dev, e o para quando o comando termina.
//
//   node scripts/dev-with-db.mjs <comando...>
//
// É o `dev` da API (`apps/api/package.json`), e por extensão o `pnpm dev` da
// raiz e a configuração `api` do `.claude/launch.json` — os três caminhos que
// precisam do banco chegam aqui. **A sessão de dev é dona do container**: ele
// existe enquanto ela existe.
//
// ## Por que isto existe — medido em 12/09/2026
//
// Uma máquina com 16 GB, 84% em uso e 7,5 GB de pagefile. O Docker respondia
// por 2,85 GB, com **12 containers de pé — um deste projeto**; os outros onze
// eram de outro projeto e voltavam sozinhos toda vez que o Docker Desktop
// abria, por `restart: unless-stopped`. O `newranews-db` gastava 38 MB, mas
// ficava ligado por dias sem ninguém usar, e é o que impede o Resource Saver
// do Docker Desktop de pausar a VM (ele só pausa com **zero** containers).
//
// Este script fecha a metade que é deste repositório: o container nasce com o
// dev server e morre com ele. As outras metades são o `restart: "no"` do
// `docker-compose.yml` (nada ressuscita ao abrir o Docker) e o vigia
// `scripts/docker-idle-stop.ps1` (para o que escapou por fechamento brusco).
//
// ## O que ele cobre, e o que não cobre
//
// - **Saída normal e Ctrl+C:** o console entrega o Ctrl+C ao filho (`tsx`) e a
//   este processo ao mesmo tempo; o filho morre, o `exit` dele roda o `stop`.
//   Se o filho não morrer em 5 s, é morto aqui.
// - **Fechar a janela do terminal:** o Windows manda `SIGHUP` e dá poucos
//   segundos — o `stop` roda **síncrono**, direto no handler.
// - **Kill forçado (`taskkill /F`, fechar o painel do editor):** nenhum handler
//   roda. É o caso que o vigia cobre, em até 5 minutos.
//
// O `stop` é `docker compose stop`, não `down`: o volume e o container ficam,
// só o processo para. Subir de novo custa ~2 s.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compose = ['compose', '-f', path.join(raiz, 'docker-compose.yml')];
const servico = 'postgres';

const comando = process.argv.slice(2);
if (comando.length === 0) {
  console.error('uso: node scripts/dev-with-db.mjs <comando...>');
  process.exit(2);
}

function docker(args, opts = {}) {
  return spawnSync('docker', [...compose, ...args], { stdio: 'inherit', ...opts });
}

// `up -d` é idempotente: se o container já está de pé, não faz nada. Com o
// `healthcheck` do compose, `--wait` só devolve quando o `pg_isready` passa —
// é o que evita o `ECONNREFUSED` do Prisma no primeiro segundo do dev server.
const up = docker(['up', '-d', '--wait', servico]);
if (up.status !== 0) {
  console.error(
    '\n[dev-with-db] não consegui subir o postgres. O Docker Desktop está aberto?\n' +
      '  (o dev server não foi iniciado — sem banco, a API cai no primeiro request)\n',
  );
  process.exit(up.status ?? 1);
}

let parado = false;
function parar() {
  if (parado) return;
  parado = true;
  console.log(`\n[dev-with-db] parando o ${servico}…`);
  docker(['stop', servico], { stdio: 'ignore' });
}

// Uma string, e não `(cmd, args)` com `shell: true` — o Node 24 avisa
// (DEP0190) que a lista é só concatenada. O comando vem do `package.json`,
// nunca de entrada externa; o `shell` é o que resolve `tsx` pelo PATH do pnpm.
const linha = comando.map((parte) => (/\s/.test(parte) ? `"${parte}"` : parte)).join(' ');
const filho = spawn(linha, { stdio: 'inherit', shell: true });

filho.on('exit', (codigo, sinal) => {
  parar();
  process.exit(codigo ?? (sinal ? 1 : 0));
});

// Ctrl+C chega ao filho pelo console; aqui só se garante que ele morre.
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    setTimeout(() => {
      if (filho.exitCode === null) filho.kill();
    }, 5_000).unref();
  });
}

// A janela do terminal fechando: poucos segundos, então síncrono e direto.
process.on('SIGHUP', () => {
  parar();
  process.exit(0);
});
