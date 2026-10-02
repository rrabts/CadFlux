#!/usr/bin/env bash
# Preparação de desenvolvimento Linux; não publica aplicativo ou dados.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) throw new Error("Node.js 22.12+ necessário");'

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@10.28.2 --activate
  else
    npm install --global pnpm@10.28.2
  fi
fi

pnpm install

if [[ "${CADFLUX_SKIP_LOCAL_POSTGRES:-0}" != "1" ]]; then
  if [[ "$(id -u)" == "0" ]]; then
    as_admin=()
    as_postgres=(runuser -u postgres --)
  else
    as_admin=(sudo)
    as_postgres=(sudo -u postgres)
  fi
  if ! command -v psql >/dev/null 2>&1; then
    "${as_admin[@]}" apt-get update
    "${as_admin[@]}" apt-get install -y postgresql postgresql-contrib
  fi
  "${as_admin[@]}" service postgresql start
  # Valores constantes fictícios, exclusivos do ambiente de desenvolvimento.
  "${as_postgres[@]}" psql -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'CREATE ROLE cadflux LOGIN PASSWORD ''cadflux_dev_only'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cadflux')\gexec
SELECT 'CREATE DATABASE cadflux OWNER cadflux'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cadflux')\gexec
SELECT 'CREATE DATABASE cadflux_test OWNER cadflux'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cadflux_test')\gexec
SQL
  if [[ ! -f .env ]]; then
    umask 077
    printf '%s\n' \
      'DATABASE_URL="postgresql://cadflux:cadflux_dev_only@127.0.0.1:5432/cadflux?schema=public"' \
      'DATABASE_URL_TEST="postgresql://cadflux:cadflux_dev_only@127.0.0.1:5432/cadflux_test?schema=public"' \
      'APP_URL="http://127.0.0.1:3000"' > .env
  fi
fi

pnpm db:generate
if [[ -d prisma/migrations ]]; then
  pnpm db:migrate
else
  printf '%s\n' 'Migration da Fase 1 ainda precisa ser criada e validada.'
fi
if [[ -f prisma/seed.ts ]]; then
  pnpm db:seed
else
  printf '%s\n' 'Seed da Fase 1 ainda precisa ser implementado e validado.'
fi
printf '%s\n' 'Preparação concluída. Execute pnpm dev e consulte o README.'
