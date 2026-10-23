# Fase 4 — especificação preparada em 23/10/2026

Roberto solicitou prosseguir com a definição da Fase 4 e respondeu às decisões
de indicadores, tipos e local de atendimento. Contrato completo:
[FASE-4-ESPECIFICACAO.md](FASE-4-ESPECIFICACAO.md).

- Orientações contam no total e também aparecem discriminadas; cancelados à parte.
- Direção pode renomear/ativar/inativar tipos, preservando códigos, regras e histórico.
- Coordenação define local padrão e vínculos. O operador pode escolher local
  autorizado, que permanece pré-selecionado nos próximos registros.
- Benefícios múltiplos, visibilidade por perfil, fórmulas de métricas, possíveis
  duplicidades, migrações e critérios de aceite estão especificados.
- Escopo: IND-01–03, CFG-01–03 e QUA-01. Todos continuam pendentes de implementação.
  Não confundir parecer aguardando classificação com o futuro módulo de pendências.

Base examinada: `832544c`, com
[run 39955215703 aprovado](https://github.com/rrabts/CadFlux/actions/runs/39955215703).
Esta alteração é somente documentação. Nenhum serviço, tela, migration ou
regra operacional foi implementado; a aplicação entregue continua nas Fases 1–3.
A futura implementação deve cumprir os critérios próprios da Fase 4 e manter a
regressão. As Fases 5–9 e produção não fazem parte desta etapa.

---

# Manutenção e planejamento — 23/10/2026

Roberto solicitou proteção da main, avaliação da automação auxiliar e alocação
dos requisitos pendentes. Base examinada: `35aab49`, com
[run 39780049860 aprovado](https://github.com/rrabts/CadFlux/actions/runs/39780049860):
123 testes, 17 cenários de navegador, três testes do supervisor e validações de
banco/build. Essa é evidência da base, não da alteração de manutenção.

- Remoção do fragmento inválido `copilot-setup-steps.yml`: não havia
  utilidade adicional demonstrada frente ao ESLint já executado pelo CI.
  Justificativa em [GOVERNANCA.md](GOVERNANCA.md).
- Requisitos pendentes vinculados a fases, com IDs, dependências, critérios e
  decisões ainda necessárias em [ROADMAP.md](ROADMAP.md).
- Proteção da main **ativa e confirmada em 23/10/2026**, pelo
  [ruleset 25721543](https://github.com/rrabts/CadFlux/rules/25721543).
  PR, check `PostgreSQL, backend and browser` do GitHub Actions, base atualizada
  e resolução de discussões são obrigatórios. Exclusão e force push bloqueados,
  sem bypass. A API da branch retornou `protected: true`.
  Configuração e evidências em [GOVERNANCA.md](GOVERNANCA.md).
- Nenhum módulo operacional novo, migration ou alteração de autenticação.
  Implementação continua nas Fases 1–3, com dados fictícios.

Validação desta manutenção no [PR #8](https://github.com/rrabts/CadFlux/pull/8):
commit `e60b93a`, [run 39951045070 aprovado](https://github.com/rrabts/CadFlux/actions/runs/39951045070).
123 testes, 17 cenários de navegador, três regressões do supervisor, migrations,
seed idempotente, lint, TypeScript e build passaram. O head final `31e5d2b`
também passou no [run 39951515366](https://github.com/rrabts/CadFlux/actions/runs/39951515366).
O PR #8 foi integrado no commit `99fe6cf`, com a mesma árvore do head validado.

A limitação inicial de autenticação administrativa foi resolvida. A proteção
foi aplicada pela interface do GitHub e conferida pela API. Este registro de
ativação altera apenas documentação e segue o fluxo obrigatório de PR e CI.

---

# CadFlux V1.1 — Fase 3 incorporada à main

Roberto autorizou iniciar Atendimentos com “Vamos” em 19/10/2026, após a proposta
de registrar, consultar e corrigir com permissões e auditoria.
Base: main `1e7ccd8`, aprovada no
[run 39320213960](https://github.com/rrabts/CadFlux/actions/runs/39320213960).
O [PR #7](https://github.com/rrabts/CadFlux/pull/7) foi incorporado à main em
22/10/2026, preservando os commits. Merge: `6bbe2366e2e0f776648e97652067414846445a6c`.
Sua árvore de arquivos é idêntica ao commit `486b049`, aprovado no
[run 39356722758](https://github.com/rrabts/CadFlux/actions/runs/39356722758):
123 testes em oito arquivos e 17 cenários de navegador, migrations, seed idempotente,
lint, TypeScript e build. As capturas finais foram inspecionadas.

As execuções posteriores da main podem ser conferidas no
[workflow de validação](https://github.com/rrabts/CadFlux/actions/workflows/phase-1-cloud.yml).
Esta atualização altera somente documentação; não muda a aplicação validada.
Conferir sempre o commit e a conclusão do run ao reutilizar evidências.

Especificação e critérios: [FASE-3-ESPECIFICACAO.md](FASE-3-ESPECIFICACAO.md).
Cobertura e evidências: [FASE-3-VALIDACAO.md](FASE-3-VALIDACAO.md).
Inclui lista e formulário, parecer pós-atendimento definitivo, correções na semana,
consulta global da Direção, reaproveitamento próprio, duplicidade com confirmação,
cancelamento com motivo e preservação de histórico. Somente dados fictícios.

Fase 4, consulta oficial de CPF, fechamento, documentos, encaminhamentos e hospedagem
de produção não fazem parte desta entrega. A Fase 4 exige autorização posterior.

---

# CadFlux V1.1 - Fase 2 em 19/10/2026

## Fases 1 e 2 incorporadas à main

Roberto autorizou o avanço em 19/10. A entrega permite manutenção de unidades e
categorias com histórico, além dos vínculos adicionais de usuários. Inclui
validações no backend, bloqueio de inativação com usuários ativos, revogação de
sessões e unicidade por caixa no banco. Não amplia o escopo para atendimentos,
encaminhamentos, fechamentos ou documentos reais.

Os PRs [#5](https://github.com/rrabts/CadFlux/pull/5) e
[#6](https://github.com/rrabts/CadFlux/pull/6) foram incorporados nessa ordem em
19/10/2026, com commits de merge e preservação da ancestralidade. Commit de
integração: `22f9cf642fc6634e3de3474ad5e849249356523f`. Sua árvore é idêntica à
versão `88dab75` aprovada no
[run 39317114075, tentativa 2](https://github.com/rrabts/CadFlux/actions/runs/39317114075/attempts/2):
94 testes em seis arquivos, 13 cenários de navegador, migrations e seed idempotente,
lint, TypeScript e build aprovados. Nenhum arquivo de aplicação mudou no merge.

A validação da própria main após a integração está no
[run 39319811057](https://github.com/rrabts/CadFlux/actions/runs/39319811057).
Conferir a conclusão e o SHA no GitHub ao reutilizar essa evidência. Commits
posteriores que ajustem apenas documentação não alteram o código validado.
Especificação: [FASE-2-ESPECIFICACAO.md](FASE-2-ESPECIFICACAO.md).
Cobertura e histórico de correções: [FASE-2-VALIDACAO.md](FASE-2-VALIDACAO.md).

A Fase 3 foi autorizada posteriormente, conforme o início deste documento.

## Validação completa em nuvem - 19/10/2026

A Fase 1 teve sua validação completa reproduzida em runner Linux do GitHub Actions:
PostgreSQL real, schemas vazios, migration e seed em dois bancos separados,
idempotência, lint, TypeScript, 85 testes, build e dez cenários de navegador
aprovados. O servidor de teste encerrou automaticamente, com a porta 3100 livre.

Run inicial: [39302409739](https://github.com/rrabts/CadFlux/actions/runs/39302409739),
commit `35557320fb8dfc1f0ad3a9fef7eda4a38a82bb06`. A retomada e a última execução
após refinamento das capturas estão no [PR #5](https://github.com/rrabts/CadFlux/pull/5).
O PR #5 foi incorporado à main em 19/10/2026, antes do PR #6.

O executor restrito do chat continua limitado; o run foi executado no GitHub,
separadamente. Consulte o [relatório de 19/10](CLOUD-VALIDACAO-2026-10-19.md) para
comandos, matriz de aceite, evidências e limites. Nenhuma aplicação foi publicada
em produção e nenhum módulo operacional de fase posterior foi implementado.

Os registros abaixo descrevem as verificações históricas de 02/10.

## Revalidação parcial no Linux - 02/10/2026 (histórico)

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

## Limites da entrega anterior da Fase 1 (histórico)

Não há atendimentos, consulta oficial de CPF, pessoas/famílias, benefícios, fechamentos, documentos oficiais, encaminhamentos ou indicadores reais. Nenhuma integração externa, publicação de aplicação ou banco de produção foi executada.

MFA e recuperação de senha possuem modelagem e interfaces preparadas; envio externo, verificação MFA completa e refinamento dos cadastros de unidades/categorias permanecem para fases posteriores. Unidades adicionais têm modelagem, sem interface completa nesta fase. Tokens de recuperação não são enviados pela tela atual.

O README detalha a arquitetura modular, as dez entidades, a migration, as rotas, a matriz de permissões e as decisões de senha/sessão/importação. Rodar localmente: instalar dependências, manter `pnpm db:local` aberto, executar `pnpm db:setup --all` e `pnpm dev` em outro terminal.

A Fase 2 já foi autorizada e incorporada, conforme o início deste documento.
Não avançar para a Fase 4 sem nova autorização.

## Supervisor de desenvolvimento Cloud — PR #4

O supervisor exige `flock` (util-linux), serializa chamadas simultâneas de
`start` e encerra os grupos de processos, incluindo migrations e seed.
Use `pnpm cloud:start`, `pnpm cloud:status` e `pnpm cloud:stop`.
`pnpm test:cloud` executa três regressões Linux sem bancos reais; requer porta
3000 livre. Configuração e detalhes em [CLOUD-RETOMADA.md](CLOUD-RETOMADA.md).
