#!/usr/bin/env bash
#
# Deixa um ambiente de desenvolvimento pronto do zero: banco no ar, schema
# aplicado, dados de exemplo e envs locais. Idempotente — rodar de novo não
# quebra nada e pula o que já está feito.
#
#   ./scripts/dev-bootstrap.sh
#
# Depois disso:
#   pnpm dev                                  # api + web
#   pnpm --filter @newranews/web visual:baseline   # capturas
#
# Por que existe: subir isso à mão são umas dez etapas e alguns detalhes que se
# esquece entre uma sessão e outra (que porta, qual usuário, que o Docker nem
# sempre está disponível). Em containers efêmeros — sessões do Claude Code na
# web, por exemplo — o ambiente se perde a cada sessão e o setup é refeito
# inteiro.
#
# NÃO usar para nada além de desenvolvimento local: os segredos abaixo são
# placeholders fixos e públicos.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_USER="newra"
DB_PASS="newra"
DB_NAME="newranews"
DB_PORT="5432"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${DB_PORT}/${DB_NAME}"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
ok() { printf '  ✓ %s\n' "$1"; }
skip() { printf '  · %s\n' "$1"; }
warn() { printf '  ! %s\n' "$1"; }

# ── 1. Dependências ────────────────────────────────────────────────────────
step 'Dependências'
if [ -d node_modules ] && [ -d apps/web/node_modules ]; then
  skip 'node_modules presente — pulando install'
else
  pnpm install --frozen-lockfile
  ok 'pnpm install'
fi

# ── 2. Postgres ────────────────────────────────────────────────────────────
# Docker é o caminho documentado (docker-compose.yml), mas nem todo ambiente
# tem o daemon rodando — containers de sessão remota geralmente não têm. Neste
# caso o Postgres nativo resolve, e é por isso que há dois caminhos aqui.
step 'Postgres'
if pg_isready -h 127.0.0.1 -p "$DB_PORT" -q 2>/dev/null; then
  skip "já respondendo na porta ${DB_PORT}"
elif docker info >/dev/null 2>&1; then
  docker compose up -d postgres
  for _ in $(seq 1 30); do
    pg_isready -h 127.0.0.1 -p "$DB_PORT" -q 2>/dev/null && break
    sleep 1
  done
  ok 'subiu via docker compose'
  warn 'o docker-compose.yml usa user/password — ajuste DATABASE_URL se for usá-lo'
elif command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo service postgresql start >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    pg_isready -h 127.0.0.1 -p "$DB_PORT" -q 2>/dev/null && break
    sleep 1
  done
  ok 'subiu o serviço nativo'
else
  echo '  ✗ nenhum Postgres disponível: instale o serviço ou inicie o Docker' >&2
  exit 1
fi

# Papel e banco. `|| true` porque "já existe" não é falha aqui.
if sudo -n true 2>/dev/null && command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" 2>/dev/null | grep -q 1 \
    || sudo -u postgres psql -q -c \
      "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}' SUPERUSER;" >/dev/null 2>&1 || true
  sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1 \
    || sudo -u postgres psql -q -c \
      "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null 2>&1 || true
  # Shadow database: o `prisma migrate diff --from-migrations` precisa de um
  # banco descartável para materializar as migrations e comparar com o schema.
  sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}_shadow'" 2>/dev/null | grep -q 1 \
    || sudo -u postgres psql -q -c \
      "CREATE DATABASE ${DB_NAME}_shadow OWNER ${DB_USER};" >/dev/null 2>&1 || true
  ok "banco ${DB_NAME} (+ shadow) pronto"
fi

# ── 3. Envs locais ─────────────────────────────────────────────────────────
# Nunca sobrescreve um arquivo existente — se você ajustou algo à mão, fica.
step 'Arquivos de ambiente'
write_env() {
  if [ -f "$1" ]; then
    skip "$1 já existe"
  else
    cat > "$1"
    ok "$1 criado"
  fi
}

write_env packages/database/.env <<EOF
DATABASE_URL=${DATABASE_URL}
EOF

write_env apps/api/.env <<EOF
PORT=3001
NODE_ENV=development
HOST=0.0.0.0
DATABASE_URL=${DATABASE_URL}
# Placeholders: o pipeline só precisa deles de verdade ao chamar os providers.
NEWSDATA_API_KEY=local-placeholder
GEMINI_API_KEY=local-placeholder
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=local-placeholder
GROQ_MODEL=openai/gpt-oss-20b
JOB_SECRET=local-job-secret
CORS_ORIGIN=http://localhost:3000
CRON_SCHEDULE=0 8 * * *
CRON_TIMEZONE=America/Sao_Paulo
SITE_URL=http://localhost:3000
AUTH_JWT_SECRET=local-shared-secret
ADMIN_EMAILS=
EOF

write_env apps/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-nextauth-secret-dev-only
# Precisa bater com o AUTH_JWT_SECRET do apps/api — a API valida o que o web assina.
AUTH_JWT_SECRET=local-shared-secret
EOF

# ── 4. Schema e dados ──────────────────────────────────────────────────────
step 'Schema e dados'
pnpm db:generate >/dev/null
ok 'prisma generate'
pnpm --filter @newranews/database db:migrate:deploy >/dev/null
ok 'migrations aplicadas'
node scripts/generate-seed-images.mjs >/dev/null
ok 'imagens de placeholder do seed'
pnpm --filter @newranews/database db:seed >/dev/null
ok 'seed'

printf '\n\033[1mPronto.\033[0m  pnpm dev  (api :3001 · web :3000)\n'
printf 'Capturas: pnpm --filter @newranews/web visual:baseline\n'
printf 'Em ambientes com Chromium pré-instalado, exporte CHROMIUM_PATH antes.\n\n'
