# Estado da retomada — 1 de outubro de 2026

## O que ocorreu

O repositório começou vazio. Foram criados arquivos iniciais Next.js/TypeScript,
configurações de qualidade e módulos parciais. O usuário interrompeu a execução antes
de instalar dependências e pediu posteriormente a continuidade na nuvem.

## Preservado

- package.json, configurações TypeScript/Next/Tailwind/ESLint/Prettier/Vitest.
- Schema Prisma inicial: User, ProfessionalCategory, Unit, UserUnitAccess, Session,
  LoginRateLimit, MfaCredential, PasswordResetToken, UserImportBatch e AuditLog.
- Tipos e schema de usuários, autorização central inicial, cliente Prisma e erros.
- Componentes iniciais de UI, tema, marca, navegação e layout.
- Tipos iniciais de importação.
- compose.yaml para PostgreSQL de desenvolvimento e .env.example fictício.

## Ainda não verificado ou concluído

- Dependências não instaladas; não há lockfile gerado.
- Nenhuma migration executada ou seed implementada/validada.
- Autenticação, endpoints, gestão e importação ainda não concluídos.
- Layout referencia globals.css ainda ausente.
- Scripts local-postgres.mjs e setup-database.mjs referenciados ainda ausentes.
- Dashboards, páginas, testes e documentação final ainda pendentes.
- Lint, typecheck, testes e build nunca executados.
- Sem publicação do aplicativo ou banco operacional em nuvem.

## Ordem sugerida de continuidade

1. Instalar dependências na nuvem e gerar lockfile; confirmar versões compatíveis.
2. Revisar schema, criar migrations (incluindo proteção append-only) e seed fictício.
3. Concluir autenticação/sessão, status ativo, troca obrigatória de senha, recuperação
   e interfaces MFA preparadas; aplicar autorização a todas as rotas e APIs.
4. Concluir usuários e histórico; proteger autoalteração e integridade administrativa.
5. Concluir importação segura, prévia/revisão e confirmação transacional.
6. Concluir UI, dashboards vazios, tema persistido, navegação e responsividade.
7. Implementar e executar os testes exigidos, migrations/seed, lint/typecheck/build.
8. Documentar a entrega completa, validar os 20 critérios e parar na Fase 1.

A especificação original é a fonte de verdade. Este resumo não reduz seu escopo.

## Diagnóstico de continuidade no chat Cloud

Em 01/10/2026 foi verificada a execução no Linux remoto do chat. O conector GitHub
funciona, porém o shell não tem autenticação Git. Dependências foram baixadas e o
cliente Prisma gerado, mas a instalação pelo wrapper terminou com erro. Não há
PostgreSQL disponível nem conexão externa; a troca para UID sem privilégios falhou.
O build Next.js também falhou por recurso de sistema indisponível
(uv_resident_set_memory). Typecheck direto passou; lint falhou e não há testes.

Fase 1 continua incompleta. Nenhuma migration, seed ou conta foi criada.
Detalhes, comandos e matriz dos 20 critérios: [CLOUD-EXECUCAO.md](CLOUD-EXECUCAO.md).
A branch codex/phase-1-cloud contém preparação e diagnóstico, não implementação
completa. Criar/selecionar ambiente de execução adequado seguindo NUVEM.md.
