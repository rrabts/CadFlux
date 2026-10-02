# CadFlux V1.1

Aplicação administrativa para o Cadastro Único. Desenvolvimento limitado à Fase 1.

**Estado: estrutura inicial incompleta, sem instalação ou testes concluídos.**
Este repositório é o ponto de continuidade; ainda não é uma aplicação funcional.

- [Especificação original](docs/FASE-1-ESPECIFICACAO.txt)
- [Estado atual e pendências](docs/STATUS.md)
- [Configuração e retomada na nuvem](docs/NUVEM.md)

## Stack proposta

Next.js, React, TypeScript estrito, PostgreSQL, Prisma ORM, Tailwind CSS,
componentes acessíveis e monólito modular em src/modules.

## Preparação de desenvolvimento

Node.js 22.12 ou superior. Instalar pnpm conforme packageManager do package.json.
Na nuvem Linux: `bash scripts/cloud-setup.sh`. Em ambiente com banco já existente,
definir DATABASE_URL e CADFLUX_SKIP_LOCAL_POSTGRES=1.

Os comandos previstos são `pnpm dev`, `pnpm db:generate`, `pnpm db:migrate`,
`pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`.
Migration, seed, rotas e scripts ainda precisam ser concluídos conforme STATUS.
Os comandos acima não constituem evidência de funcionamento.

Contas de demonstração previstas: direcao@cadflux.local,
entrevistador@cadflux.local e encaminhador@cadflux.local. Ainda não criadas/validadas.
Usar somente dados fictícios e senhas de desenvolvimento, nunca em produção.

## Continuidade em ambiente Cloud

A Fase 1 permanece incompleta. O diagnóstico do executor do chat, comandos,
limitações e situação dos 20 critérios estão em [docs/CLOUD-EXECUCAO.md](docs/CLOUD-EXECUCAO.md).
O caminho para selecionar/preparar um ambiente capaz de executar PostgreSQL e Next.js
está em [docs/NUVEM.md](docs/NUVEM.md). Não há contas operacionais nem migration/seed
validados nesta retomada.
