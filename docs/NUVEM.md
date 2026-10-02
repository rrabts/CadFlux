# Desenvolvimento do CadFlux na nuvem

A Fase 1 está implementada na branch `feature/foundation-auth`. Consulte o README para instalação, contas fictícias e comandos; `docs/STATUS.md` registra as verificações.

O ambiente de desenvolvimento não equivale à hospedagem de produção. Não há deploy nesta entrega.

## Preparar o ambiente

1. Disponibilize o repositório, Node.js 22.12+ e pnpm 10.28.2.
2. Libere acesso aos registros npm, GitHub e downloads oficiais Prisma/Playwright.
3. Execute `pnpm install --frozen-lockfile`.
4. Copie `.env.example` para `.env` e use `pnpm db:local` (PostgreSQL real, usuário sem root) ou um PostgreSQL existente.
5. Execute `pnpm db:setup` e `pnpm dev`.
6. Execute lint, typecheck, testes, testes de navegador, formatter e build conforme README.

`scripts/cloud-setup.sh` é uma alternativa para Linux com sudo/apt: instala PostgreSQL do sistema na porta 5432 e cria bancos de demonstração. Para banco já fornecido, use `CADFLUX_SKIP_LOCAL_POSTGRES=1` e configure as URLs. Não sobrescreve `.env` existente.

Nunca envie `.env`, dados do banco, caches ou senhas reais ao GitHub. O seed usa somente dados fictícios e é bloqueado em produção. Alterações futuras devem preservar a autorização backend e os limites da fase autorizada.
