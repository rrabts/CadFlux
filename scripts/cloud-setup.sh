#!/usr/bin/env bash
# Preparação de desenvolvimento Linux; não publica aplicativo ou dados.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) throw new Error("Node.js 22.12+ necessário");'

# Respect packageManager even when the executor provides another pnpm version.
# npm exec avoids modifying the executor's global runtime installation.
if command -v pnpm >/dev/null 2>&1 && [[ "$(pnpm --version)" == "10.28.2" ]]; then
  pnpm_cmd=(pnpm)
else
  pnpm_cmd=(npm exec --yes --package=pnpm@10.28.2 -- pnpm)
fi

if [[ -f pnpm-lock.yaml ]]; then
  CI=true "${pnpm_cmd[@]}" install --frozen-lockfile
else
  # The initial scaffold has no lockfile yet; generate one for later review.
  CI=true "${pnpm_cmd[@]}" install --no-frozen-lockfile
fi

# PostgreSQL is provided by embedded-postgres on Linux, without apt/sudo/root.
# Runtime credentials stay in the ignored .env or inherited environment.
if [[ "${CADFLUX_SKIP_LOCAL_POSTGRES:-0}" != "1" && ! -f .env ]]; then
  if [[ -n "${DATABASE_URL:-}" || -n "${DATABASE_URL_TEST:-}" ]]; then
    node --input-type=module -e 'import { loadDatabaseEnvironment } from "./scripts/database-config.mjs"; loadDatabaseEnvironment();'
  else
    umask 077
    cp --no-clobber .env.example .env
    chmod 600 .env
  fi
fi

"${pnpm_cmd[@]}" db:generate
node scripts/cloud-runtime.mjs start
printf '%s\n' 'Ambiente de desenvolvimento pronto. A Fase 1 exige suas próprias verificações; leia docs/STATUS.md.'
