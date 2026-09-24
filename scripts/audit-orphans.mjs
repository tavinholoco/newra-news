#!/usr/bin/env node
// Toda advisory silenciada ainda casa com um achado — a lista não silencia o
// que já não existe.
//
//   node scripts/audit-orphans.mjs
//
// **Achado do ensaio de aceitação (Fase 12 do plano de observabilidade,
// A6.02), 24/09/2026.** `pnpm.auditConfig.ignoreGhsas` tinha 20 entradas e o
// `pnpm audit --prod` ignorava 18: as duas do `browserslist`
// (GHSA-73wf-gq98-2v4g, GHSA-c83g-rgw3-j3cx, vulneráveis até a 4.28.6) tinham
// sido corrigidas por um bump — o lockfile tem a 4.28.9 — e a lista seguia
// silenciando-as. Nada acusava: o gate passa igual com exceção a mais, e a
// guarda que amarra a lista ao `docs/security-advisories.md` compara os dois
// arquivos entre si, não com o registro.
//
// Exceção órfã é o outro lado da armadilha 21 do plano ("lista de exceção sem
// motivo vira ruído"): ela **diz** que alguém decidiu aceitar um risco que
// não existe mais — e, se a advisory voltar numa versão futura, volta calada.
//
// O `pnpm` não tem flag para ignorar o `auditConfig`, e o `--json` omite as
// ignoradas. O jeito é medir com a lista vazia: o `package.json` é reescrito
// sem ela, o audit roda, e os **bytes originais** voltam no `finally`. Precisa
// de rede (o registro), por isso é passo do job de audit do CI e não da suíte.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'package.json');
const GHSA = /GHSA(?:-[a-z0-9]{4}){3}/g;

function measure() {
  const original = readFileSync(FILE);
  const pkg = JSON.parse(original.toString('utf8'));
  const ignored = pkg.pnpm?.auditConfig?.ignoreGhsas ?? [];

  let res;
  try {
    pkg.pnpm.auditConfig.ignoreGhsas = [];
    writeFileSync(FILE, `${JSON.stringify(pkg, null, 2)}\n`);
    // Uma string só, fixa: no Windows o `pnpm` é um `.cmd`, que o Node só
    // executa com `shell`, e `shell` com array de argumentos é o DEP0190.
    res = spawnSync('pnpm audit --prod --json', {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
      maxBuffer: 64 * 1024 * 1024,
    });
  } finally {
    writeFileSync(FILE, original);
  }

  let report;
  try {
    report = JSON.parse(res.stdout);
  } catch {
    // O audit sai diferente de zero quando acha algo — isso é normal. Não
    // conseguir ler o JSON não é: sem medida, não há o que afirmar.
    console.error(`Não foi possível ler o audit (status ${res.status}).\n${(res.stderr || res.stdout).slice(-600)}`);
    return 2;
  }

  // Cada advisory cita o próprio GHSA nas referências; o texto inteiro do
  // registro é o que se varre, porque o campo muda de nome entre versões.
  const found = new Set();
  for (const advisory of Object.values(report.advisories ?? {})) {
    for (const id of JSON.stringify(advisory).match(GHSA) ?? []) found.add(id);
  }

  const orphans = ignored.filter((id) => !found.has(id));
  if (orphans.length > 0) {
    console.error(
      `${orphans.length} exceção(ões) sem achado no audit --prod: ${orphans.join(', ')}.\n` +
        'Tire-as de pnpm.auditConfig.ignoreGhsas e do docs/security-advisories.md — ' +
        'a lista não deve silenciar o que já não existe.',
    );
    return 1;
  }
  console.log(`${ignored.length} exceções silenciadas, todas ainda casam com um achado do audit --prod.`);
  return 0;
}

process.exitCode = measure();
