# CadFlux V1.1 — verificação da Fase 1 em 02/10/2026

## Revalidação atual no Linux

A main recebeu o PR #2 no commit `5bc35d727dcde44724bfaa6b7d0f43479a0dba92`. Em 02/10, o checkout remoto Linux passou em lint, TypeScript, schema Prisma e 62 testes unitários. A validação completa em nuvem permanece bloqueada: PostgreSQL não iniciou por restrições de usuário; 23 testes de integração não executaram; Next build falhou com `uv_resident_set_memory`; os cenários de navegador não iniciaram sem build. O retorno indevido de sucesso do db:local foi corrigido e verificado. Veja [relatório Linux](CLOUD-VALIDACAO-2026-10-02.md).

## Verificação anterior no Windows

A Fase 1 foi declarada concluída no Windows: os 20 critérios de aceite foram verificados. Lint, typecheck, 85 testes e build terminaram com saída 0; os dez cenários de navegador também passaram. Os resultados a seguir correspondem à entrega anterior ao merge do PR #2. Nenhum módulo operacional de fases posteriores ou implantação de produção foi executado.

## Origem e ambiente

- Branch: `feature/phase-1-completion`, criada da `main` no commit `d4709c4b9b945848600bece033e2ed2d2325220d`, que contém o PR #1 mergeado.
- Leitura integral anterior às alterações: `AGENTS.md`, `FASE-1-ESPECIFICACAO.txt`, `STATUS.md`, `NUVEM.md` e `CLOUD-EXECUCAO.md`.
- Validação atual: Windows local, Node 24.19.0, pnpm 10.28.2, PostgreSQL 18.4, Prisma 6.19.3, Next.js 16.3.8.
- `CLOUD-EXECUCAO.md` preserva o diagnóstico histórico de 01/10. A validação abaixo foi realizada neste executor Windows; não representa uma implantação ou execução validada em nuvem.
- O banco real fica em `.local/postgres`, escuta somente em `127.0.0.1:54329` e usa bancos separados `cadflux` e `cadflux_test`. Arquivos locais, `.env`, dependências e relatórios intermediários não entram no Git.

## Banco limpo e seed

Antes da primeira migration, consultas ao catálogo PostgreSQL confirmaram **zero tabelas no schema public dos dois bancos**. `db:setup --all` aplicou a migration `20261002140000_foundation` e executou o seed em ambos, com saída final 0. Depois, a migration estava concluída e cada banco tinha 11 tabelas, incluindo `_prisma_migrations`.

O banco de desenvolvimento ficou com **3 usuários, 2 unidades e 4 categorias**, um usuário de cada perfil. Repetir `db:setup --all` terminou com saída 0, sem migrations pendentes e com as mesmas contagens no desenvolvimento. Isso confirma a idempotência sem apagar ou reconstruir o banco. O banco de testes passou a conter também os registros fictícios criados pelas suítes; suas contagens posteriores não são apresentadas como resultado isolado do seed.

A primeira tentativa dentro do sandbox aplicou a migration de desenvolvimento, mas o processo de seed falhou com `uv_os_get_passwd ENOMEM`. A reexecução autorizada fora do sandbox concluiu migrations e seed. O mesmo requisito do executor foi aplicado ao processo local do PostgreSQL; não houve instalação de serviço global.

Contas fictícias operacionais, todas com senha de demonstração `CadFlux!Demo2026`:

| Perfil        | E-mail                      | Matrícula |
| ------------- | --------------------------- | --------- |
| Direção       | direcao@cadflux.local       | DEMO-001  |
| Entrevistador | entrevistador@cadflux.local | DEMO-002  |
| Encaminhador  | encaminhador@cadflux.local  | DEMO-003  |

As unidades são Central e Norte de demonstração; as categorias são Entrevistador, Assistente Social, Coordenação e Visitador. O seed recusa produção. Dados e credenciais são exclusivamente fictícios.

## Implementação verificada

Autenticação usa senha com scrypt e salt, sessão opaca de oito horas guardada por hash, cookie httpOnly/SameSite=Lax e Secure em produção. Login válido/inválido/inativo, logout, expiração, limite de tentativas, troca obrigatória de senha e revogação de sessões têm cobertura. Cada requisição verifica o usuário atual no banco.

A autorização é centralizada em `src/modules/permissions/service.ts`; páginas, APIs e serviços administrativos verificam sessão, status, ação e escopo. Entrevistador e Encaminhador recebem 403 nas APIs administrativas e tela de acesso negado nas páginas. Alterações de perfil/status revogam sessões, preservam uma Direção ativa e impedem a Direção de alterar seu próprio perfil/status.

A Gestão de Usuários permite pesquisar (inclusive CPF com ou sem máscara), filtrar, paginar, criar, editar dados, trocar perfil/categoria/unidade, ativar/inativar e consultar histórico. Não existe exclusão física. Senhas temporárias são geradas no servidor e exibidas uma única vez; o primeiro acesso exige troca. A listagem informa o total, usa páginas de 50 e mantém os filtros entre páginas.

Importação CSV/XLSX oferece modelos, validação, prévia por linha e confirmação explícita. Rejeita perfis/vínculos/status inválidos, duplicidades, arquivos incompatíveis, fórmulas, links externos e arquivos acima dos limites. A prévia não cria usuários. A confirmação revalida no servidor, pertence ao administrador da prévia, expira em 30 minutos, é utilizada uma vez e grava o lote inteiro em transação. Arquivos não são mantidos no servidor; limites de upload, linhas e descompressão são aplicados.

AuditLog registra login/logout, criação/edição, mudanças de acesso/vínculos/status, senha e importação. Dados sensíveis são removidos recursivamente. Triggers PostgreSQL rejeitam UPDATE, DELETE e TRUNCATE da auditoria e exclusão de usuários, unidades e categorias. Histórico e auditoria são somente leitura.

O shell inclui sidebar recolhível, topbar, dados de identificação, menus por perfil, Claro/Escuro/Sistema, preferência persistida e layout responsivo. O drawer mobile funciona com teclado, foco e Escape. Dashboards e módulos futuros exibem estados vazios.

## Verificações finais

| Comando                                   | Resultado                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm db:setup --all`                     | Saída 0; migrations e seed nos dois bancos inicialmente vazios                                |
| `pnpm db:setup --all` repetido            | Saída 0; sem migrations pendentes, seed idempotente                                           |
| `pnpm lint`                               | Saída 0; sem erros nem avisos                                                                 |
| `pnpm typecheck`                          | Saída 0                                                                                       |
| `pnpm test`                               | Saída 0; 85 testes em 5 arquivos (77,92 s)                                                    |
| `pnpm build`                              | Saída 0; build de produção e todas as rotas geradas                                           |
| `PLAYWRIGHT_CHANNEL=msedge pnpm test:e2e` | Saída 0; 10 cenários aprovados (9,4 min), com intervenção de teardown Windows descrita abaixo |

No navegador, os dez cenários passaram integralmente com Microsoft Edge. Neste executor Windows protegido, o Playwright ficou esperando o encerramento automático do seu servidor Next após os casos. Encerrar somente esse processo de teste (PID 16316) com Stop-Process liberou o teardown; o runner permaneceu ativo, gerou o resumo `10 passed (9.4m)` e terminou com saída 0. O relatório final registra `passed`, sem testes falhos; a porta 3100 ficou livre. Essa intervenção do executor não foi usada para interromper ou aprovar um caso. O encerramento automático nesse sandbox não é apresentado como validado.

Os testes usam somente `DATABASE_URL_TEST` e recusam a identidade do banco de desenvolvimento, incluindo aliases locais, porta padrão e nome codificado. Suítes de integração e navegador são executadas em sequência para evitar interferência entre contagens de fixtures.

Cobertura: autenticação/permissões e proteção de APIs; gestão e integridade administrativa; paginação; importação CSV/XLSX, limites e confirmação atômica; auditoria imutável; isolamento dos bancos; fluxos completos de interface. As capturas são inspecionadas visualmente, além das verificações automáticas.

Evidências visuais: [tema claro](evidence/dashboard-light.png), [tema escuro](evidence/dashboard-dark.png) e [navegação mobile](evidence/navigation-mobile.png).

## Matriz de aceite

| CRITÉRIO                            | STATUS | EVIDÊNCIA                                                                                     |
| ----------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| 1. Projeto roda localmente          | PASSOU | Next.js de produção iniciado em `127.0.0.1:3100` para navegação real; build com saída 0       |
| 2. Banco configurado                | PASSOU | PostgreSQL 18.4 real; bancos `cadflux` e `cadflux_test` separados                             |
| 3. Migrations funcionam             | PASSOU | Dois bancos com zero tabelas antes; `20261002140000_foundation` concluída e 11 tabelas depois |
| 4. Seed funciona                    | PASSOU | Desenvolvimento com 3 usuários, 2 unidades, 4 categorias; repetição idempotente               |
| 5. Login funciona                   | PASSOU | Testes de login válido/inválido/inativo e sessões reais com hash                              |
| 6. Logout funciona                  | PASSOU | Revogação no banco, cookie limpo e acesso protegido negado após logout                        |
| 7. Rotas protegidas                 | PASSOU | Guards de páginas/APIs, expiração, status atual e troca obrigatória                           |
| 8. Três perfis existem              | PASSOU | Enum Prisma, seed e contas INTERVIEWER, REFERRAL_OPERATOR e DIRECTION                         |
| 9. Menus diferentes por perfil      | PASSOU | Navegação central por enum; verificação dos três perfis no navegador                          |
| 10. Autorização no backend          | PASSOU | `can/assertPermission`, guards e serviços; APIs administrativas 403 para dois perfis          |
| 11. Claro/escuro funciona           | PASSOU | Opções Claro/Escuro/Sistema e capturas inspecionadas                                          |
| 12. Tema persiste                   | PASSOU | `cadflux-theme`; reload e mudança de preferência do sistema cobertos                          |
| 13. Layout responsivo               | PASSOU | Navegador em 390×844, largura sem transbordo, drawer e teclado                                |
| 14. Direção gerencia usuários       | PASSOU | Criação/edição/perfil/categoria/unidade/status, filtros e paginação no backend                |
| 15. Usuário pode ser inativado      | PASSOU | Ativar/inativar com auditoria; login e sessão bloqueados para inativo                         |
| 16. Histórico básico existe         | PASSOU | Aba Histórico por usuário, com autor/data/ação; consulta protegida                            |
| 17. CSV/XLSX com validação e prévia | PASSOU | Testes de ambos os formatos, modelos, erros/duplicidades e prévia sem criar usuários          |
| 18. Auditoria registra ações        | PASSOU | Logs transacionais nas operações e triggers de imutabilidade testadas                         |
| 19. Testes críticos passam          | PASSOU | 85 testes em 5 arquivos e 10 cenários E2E aprovados; lint/typecheck/build com saída 0         |
| 20. README explica execução         | PASSOU | Requisitos, instalação, bancos, seed, contas, rotas/permissões, importação e verificações     |

## Limites e continuação

Não há atendimentos, consulta oficial de CPF, pessoas/famílias, benefícios, fechamentos, documentos oficiais, encaminhamentos ou indicadores reais. Nenhuma integração externa, publicação de aplicação ou banco de produção foi executada.

MFA e recuperação de senha possuem modelagem e interfaces preparadas; envio externo, verificação MFA completa e refinamento dos cadastros de unidades/categorias permanecem para fases posteriores. Unidades adicionais têm modelagem, sem interface completa nesta fase. Tokens de recuperação não são enviados pela tela atual.

O README detalha a arquitetura modular, as dez entidades, a migration, as rotas, a matriz de permissões e as decisões de senha/sessão/importação. Rodar localmente: instalar dependências, manter `pnpm db:local` aberto, executar `pnpm db:setup --all` e `pnpm dev` em outro terminal.

Não avançar para a Fase 2 sem nova autorização.
