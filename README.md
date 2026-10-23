# CadFlux V1.1 — Fases 1 a 4

Aplicação institucional para autenticação, autorização, gestão e registro de
atendimentos do Cadastro Único. A Fase 3 foi incorporada à `main` em 22/10/2026 pelo
[PR #7](https://github.com/rrabts/CadFlux/pull/7). Apenas dados fictícios. A Fase 4 acrescenta indicadores verificáveis, benefícios,
tipos configuráveis e unidade operacional. Consulta oficial de CPF, fechamentos,
documentos e encaminhamentos aguardam as próximas fases.

As Fases 1 e 2 foram incorporadas à `main` em 19/10/2026 pelos
[PRs #5](https://github.com/rrabts/CadFlux/pull/5) e
[#6](https://github.com/rrabts/CadFlux/pull/6). A versão integrada preserva o código
validado com 94 testes e 13 cenários de navegador. A execução após a integração
está no [run 39319811057](https://github.com/rrabts/CadFlux/actions/runs/39319811057);
confira o commit e a conclusão antes de reutilizar os resultados.
Estado e evidências: [docs/STATUS.md](docs/STATUS.md).
A [especificação da Fase 4](docs/FASE-4-ESPECIFICACAO.md) foi preparada em
23/10/2026 com as decisões de indicadores, tipos e local de atendimento.
Entrega da Fase 4 no [PR #11](https://github.com/rrabts/CadFlux/pull/11), validada com
135 testes, 20 cenários de navegador e três testes do supervisor. Evidências e
limites: [validação da Fase 4](docs/FASE-4-VALIDACAO.md).

Planejamento restante: [matriz de requisitos por fase](docs/ROADMAP.md).
Proteção da main e decisão sobre a automação auxiliar: [governança](docs/GOVERNANCA.md).
O JSON de proteção versionado precisa ser aplicado nas configurações do GitHub;
sua presença no código não comprova que a regra esteja ativa.

## Executar localmente

Requisitos: Node.js 22.12+ (validado com 24.19.0), pnpm 10.28.2 e PostgreSQL real. O lockfile deve ser preservado.

```sh
npm install --global pnpm@10.28.2
pnpm install --frozen-lockfile
```

Copie `.env.example` para `.env`. As configurações de exemplo são exclusivamente fictícias. Mantenha bancos separados em `DATABASE_URL` e `DATABASE_URL_TEST` e configure `APP_URL` com a origem exata do navegador.

Em um terminal:

```sh
pnpm db:local
```

O script inicia PostgreSQL **real**, sem instalar um serviço global, escutando somente em 127.0.0.1:54329. Os arquivos do banco ficam em `.local/postgres`, ignorados pelo Git. Caso não exista, cria `.env` a partir do exemplo e os bancos `cadflux` e `cadflux_test`. Mantenha o terminal aberto; Ctrl+C encerra o servidor e preserva os dados. Linux precisa executar esse script como usuário sem privilégios, conforme exigido pelo PostgreSQL.

Em outro terminal:

```sh
pnpm db:setup --all
pnpm dev
```

Abra [CadFlux local](http://127.0.0.1:3000). `db:setup` valida a conexão, aplica migrations e executa seed. Sem argumentos prepara somente desenvolvimento; `--test` prepara somente testes; `--all` prepara ambos. Não apaga bancos existentes.

Também é possível usar PostgreSQL existente, configurando os dois URLs fora do código. Para seed em servidor externo fictício, use `CADFLUX_ALLOW_DEMO_SEED=1`. O seed e os scripts de demonstração recusam `NODE_ENV=production`. Com Docker, `docker compose up -d` inicia o banco de desenvolvimento; crie o banco separado de teste com `docker compose exec postgres createdb -U cadflux cadflux_test` uma única vez.

## Contas fictícias

Todas usam a senha de demonstração **CadFlux!Demo2026**. Nunca utilizar estas credenciais em produção.

| Perfil        | E-mail                      | Matrícula |
| ------------- | --------------------------- | --------- |
| Direção       | direcao@cadflux.local       | DEMO-001  |
| Entrevistador | entrevistador@cadflux.local | DEMO-002  |
| Encaminhador  | encaminhador@cadflux.local  | DEMO-003  |

O seed cria duas unidades de demonstração e quatro categorias: Entrevistador, Assistente Social, Coordenação e Visitador. Categoria profissional é independente do perfil. Executar novamente preserva os usuários existentes e suas senhas.

Novos usuários criados manualmente ou por importação recebem senha aleatória temporária, apresentada somente na resposta de criação. O primeiro acesso exige troca; não há senha nos arquivos importados. Ao trocar a senha, todas as sessões são encerradas e o usuário entra novamente. Não há envio externo de convites ou recuperação de senha nesta fase.

## Rotas e permissões

| Rota / operação                                | Entrevistador           | Encaminhador            | Direção                                                                 |
| ---------------------------------------------- | ----------------------- | ----------------------- | ----------------------------------------------------------------------- |
| /dashboard, /profile, /change-password         | Próprio acesso          | Próprio acesso          | Próprio acesso                                                          |
| /users, /users/new, /users/[id], /users/import | Bloqueado               | Bloqueado               | Listar, pesquisar, criar, editar, ativar/inativar, histórico e importar |
| /units, /categories                            | Bloqueado               | Bloqueado               | Criar/editar/ativar/inativar cadastros; histórico                                            |
| /audit                                         | Bloqueado               | Bloqueado               | Consultar auditoria                                                     |
| /workspace/[slug]                              | Somente menus do perfil | Somente menus do perfil | Somente menus do perfil                                                 |
| /login, /recovery                              | Público                 | Público                 | Público                                                                 |

A gestão lista 50 usuários por página, informa o total e mantém os filtros ao navegar. Alterar os filtros volta à primeira página.

Atendimentos abrem o módulo da Fase 3. Menus de encaminhamento, fechamento, documentos e pendências continuam em desenvolvimento. A topbar oferece tema Claro/Escuro/Sistema, perfil e logout. A sidebar pode recolher; no mobile funciona como drawer com foco, Escape e navegação por teclado.

APIs: `/api/auth/login`, `/api/auth/logout`, `/api/auth/password`, `/api/auth/recovery`; `/api/users`, `/api/users/[id]`; `/api/references`, `/api/audit`; `/api/imports/template`, `/api/imports/preview`, `/api/imports/confirm`. Sessão, usuário ativo, perfil e escopo são verificados no servidor. Não existem endpoints de exclusão de usuário ou edição/exclusão de auditoria.

## Importar usuários

1. A Direção baixa o modelo CSV ou XLSX na tela de importação.
2. Preenche, como texto, `nome, cpf_ou_identificador, email, matricula, perfil, categoria, unidade, status`, nesta ordem. Não inclui senha.
3. Envia o arquivo para validação e revisa totais, linhas inválidas e duplicidades.
4. Confirma somente uma prévia sem erros. O servidor revalida os dados e cria o lote inteiro em uma transação.
5. Guarda as senhas temporárias apresentadas uma única vez para os usuários fictícios.

Perfis: `INTERVIEWER`, `REFERRAL_OPERATOR`, `DIRECTION`; status `ACTIVE` ou `INACTIVE`. Use nome da categoria e código ou nome da unidade. Identificadores funcionais são normalizados; CPF informado é validado apenas estruturalmente, sem consulta externa. Para demonstração prefira `FUNC-DEMO-...`.

Limites: 2 MiB, 1.000 usuários, uma planilha XLSX, campos de texto simples. CSV deve usar UTF-8, vírgula ou ponto e vírgula. Fórmulas, links externos, conteúdo executável, SQL, arquivos incompatíveis e ZIPs fora dos limites são rejeitados. O nome é sanitizado; arquivos não são armazenados no servidor. A prévia expira em 30 minutos, pertence ao administrador e pode ser confirmada uma vez. Nenhum usuário é criado durante a prévia; somente o registro temporário `UserImportBatch` é gravado. Um erro ou conflito impede a gravação de todo o lote.

## Arquitetura e banco

Monólito modular Next.js/TypeScript estrito, React/Tailwind, PostgreSQL/Prisma. Serviços em `src/modules/{auth,permissions,users,references,attendances,operations,catalog,indicators,imports,audit}`, componentes reutilizáveis em `src/components` e rotas em `src/app`.

Entidades: User, ProfessionalCategory, Unit, UserUnitAccess, Session, LoginRateLimit, MfaCredential, PasswordResetToken, UserImportBatch, AuditLog, Attendance, Benefit, AttendanceType e AttendanceBenefit.

Migration: `prisma/migrations/20261002140000_foundation/migration.sql`, gerada a partir do schema e acrescida de triggers para bloquear UPDATE/DELETE/TRUNCATE de AuditLog e DELETE de usuários/unidades/categorias. Auditoria registra login/logout, criação/edição, mudanças de perfil/categoria/unidade/status, troca de senha e confirmação de importação. Senhas, hashes de senha e tokens são removidos recursivamente das informações de auditoria.

Senhas usam scrypt salgado; tokens aleatórios ficam apenas por hash no banco. A sessão dura oito horas, em cookie httpOnly/SameSite=Lax e Secure em produção. Login possui limitação de tentativas no banco. Mutações exigem origem válida. Mudanças de perfil/status, unidade principal/adicionais e senha revogam sessões; cada requisição consulta o usuário atual. Outro administrador deve alterar o perfil/status da própria Direção; alterações administrativas preservam uma Direção ativa.

Unidades adicionais são gerenciadas pela Direção; recuperação de senha e MFA externo continuam preparados para integração posterior. A interface de recuperação informa que a entrega externa ainda está preparada. MFA externo, fluxo completo de recuperação e integrações externas ficam para fases posteriores autorizadas. Banco e aplicação de produção não foram publicados nesta tarefa.

## Verificar

Com PostgreSQL em execução e ambos os bancos preparados:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test` executa testes unitários e integração contra `DATABASE_URL_TEST`, recusando o mesmo banco de desenvolvimento. `pnpm test:integration` executa integração de backend, importação, cadastros, atendimentos e Fase 4. Os testes usam dados fictícios com identificadores únicos e preservam auditoria.

O teste de navegador inicia o build de produção em 127.0.0.1:3100, apontando somente ao banco de teste. Instale o Chromium de testes com `pnpm exec playwright install chromium`; em Windows com Edge/Chrome já instalado é possível definir `PLAYWRIGHT_CHANNEL=msedge` ou `chrome`. Execute `pnpm build` antes de `pnpm test:e2e`.

Validação em 02/10/2026: lint, typecheck, 85 testes em cinco arquivos e build com saída 0; dez cenários de navegador aprovados no Edge. No executor Windows protegido desta entrega, foi necessário encerrar somente o servidor Next de teste após os cenários para liberar o término do Playwright. O runner gerou o relatório final e saiu 0; o encerramento automático nesse sandbox permanece uma limitação do executor.

Resultados reais, matriz dos 20 critérios e limitações estão em [docs/STATUS.md](docs/STATUS.md). [docs/CLOUD-EXECUCAO.md](docs/CLOUD-EXECUCAO.md) preserva o diagnóstico histórico do executor anterior; não descreve a validação atual.

Revalidação Linux em 02/10/2026 da main após o PR #2: lint, TypeScript, schema Prisma e 62 testes unitários passaram. Banco, integração, build e navegador permanecem bloqueados neste executor restrito; isso não substitui a evidência anterior do Windows por aprovação em nuvem. O comando db:local foi corrigido para retornar saída 1 quando a inicialização falha. Detalhes em [docs/CLOUD-VALIDACAO-2026-10-02.md](docs/CLOUD-VALIDACAO-2026-10-02.md).

A implementação da Fase 4 foi autorizada; não avançar à Fase 5 sem nova autorização.

## Validação automatizada em nuvem

O workflow `CadFlux - Cloud validation`, em `.github/workflows/phase-1-cloud.yml`,
executa no GitHub Actions: Ubuntu 24.04, Node 24.19.0, pnpm 10.28.2 e PostgreSQL 18.
Há bancos fictícios separados, verificação de schemas vazios, migration, seed e
idempotência, lint, TypeScript, testes de backend, build e Playwright com Chromium.
O fluxo também confere o encerramento do servidor de teste e preserva evidências
do navegador por sete dias. Ele não hospeda o aplicativo nem publica produção.

A criação do workflow não comprova sua aprovação. Consultar o resultado do run e
o commit correspondente antes de declarar a Fase 1 validada em nuvem.
Instruções e distinção entre os ambientes estão em [docs/NUVEM.md](docs/NUVEM.md).

Em 19/10/2026, o [run 39302409739](https://github.com/rrabts/CadFlux/actions/runs/39302409739)
aprovou a validação completa: bancos inicialmente vazios, migration, seed
idempotente, lint, TypeScript, 85 testes, build e dez cenários de navegador com
encerramento automático do servidor. Detalhes no
[relatório de 19/10](docs/CLOUD-VALIDACAO-2026-10-19.md); atualização e execução mais
recente após ajuste das capturas no [PR #5](https://github.com/rrabts/CadFlux/pull/5).

## Fase 2 - gestão institucional

Autorizada por Roberto em 19/10/2026. O escopo está em
[docs/FASE-2-ESPECIFICACAO.md](docs/FASE-2-ESPECIFICACAO.md).

- A Direção mantém unidades e categorias: busca, filtro de status, paginação,
  criação, edição, ativação/inativação e histórico. A categoria continua
  independente dos três perfis de acesso.
- Unidade exige nome, código único e fuso válido. Categoria exige nome único.
  A migration `20261019170000_reference_integrity` também protege a unicidade
  ignorando caixa no PostgreSQL, sem mesclar/apagar dados existentes.
- A edição de usuários permite até 20 unidades adicionais, sem repetir a
  principal. Atribuições a unidades inexistentes/inativas ou repetidas são negadas.
  O campo é opcional: clientes antigos que o omitem preservam os vínculos.
- Cadastros com usuários ativos vinculados não podem ser inativados. Usuários
  inativos preservam os vínculos históricos, mas exigem referências ativas para
  voltar a acessar. Alterações de unidade revogam sessões e ficam na auditoria.
- Vínculos adicionais são administrativos: ainda não há seletor de unidade de
  operação nem ampliação de acesso individual aos futuros atendimentos.

APIs da Direção: `GET/POST /api/references/units`,
`GET/PATCH /api/references/units/[id]` e equivalentes em `/categories`.
GET de detalhe inclui histórico. Não existem DELETEs. A interface continua em
`/units`, `/categories` e `/users/[id]`. A importação mantém suas oito colunas.

As mutações compartilham o lock administrativo com a gestão/importação de usuários,
revalidam o ator e usam transação serializável. Não há registros operacionais ou
publicação de produção. Resultados atuais de validação são registrados no PR da
Fase 2, junto ao commit e ao run correspondente.
Cobertura e histórico: [docs/FASE-2-VALIDACAO.md](docs/FASE-2-VALIDACAO.md).


## Fase 3 — atendimentos

Critérios e decisões: [FASE-3-ESPECIFICACAO.md](docs/FASE-3-ESPECIFICACAO.md).
Evidências da entrega: [FASE-3-VALIDACAO.md](docs/FASE-3-VALIDACAO.md).

| Rota / operação | Entrevistador | Encaminhador | Direção |
| --- | --- | --- | --- |
| `/attendances` | Próprios registros | Bloqueado | Consulta global com filtros |
| `/attendances/new` | Criar na unidade principal ativa | Bloqueado | Bloqueado (não lança em nome de terceiros) |
| `/attendances/[id]` | Próprio registro e histórico | Bloqueado | Consulta e correção global |
| Corrigir/cancelar | Semana corrente, somente próprios | Bloqueado | Inclui semanas anteriores |
| Reaproveitar dados | Próprios registros, após confirmação | Bloqueado | Não utiliza o fluxo de criação |

APIs: `GET/POST /api/attendances`, `GET/PATCH /api/attendances/[id]`,
`POST /api/attendances/[id]/cancel`, `POST /api/attendances/reuse` e
`GET /api/attendances/options` (opções administrativas exclusivas da Direção).
Nenhum DELETE. CPF anterior é enviado no corpo do POST de reaproveitamento.

A entidade `Attendance` preserva operador/unidade/fuso de origem e usa versão para
recusar perda de alterações simultâneas. A migration
`20261020020000_attendances` cria tabela, enums, índices, constraints e triggers:
CPF/RF/RL, identificação institucional e parecer definido não mudam; registro
cancelado não reativa nem é apagado/truncado. Mutações passam pelo serviço e gravam
auditoria na mesma transação.

Inclusão e orientação são sem parecer. Atualização/averiguação podem aguardar
a classificação pós-atendimento, que fica definitiva ao ser escolhida. Orientação
não guarda código familiar. CPF tem validação estrutural, sem consulta oficial.
Possível duplicidade no mesmo CPF/data do próprio operador exige confirmação,
sem bloquear um novo atendimento distinto. A semana usa o fuso salvo no registro.
A janela de fechamento/reabertura não existe ainda.

As contas fictícias existentes permanecem. O seed não cria atendimentos de
beneficiários; testes geram registros sintéticos no banco de testes. A Fase 4 usa esses registros nos indicadores do dashboard; o botão de atendimento
abre o formulário.
Não há publicação de produção nem uso de dados reais.

## Supervisor de desenvolvimento Cloud — PR #4

O supervisor exige `flock` (util-linux), serializa chamadas simultâneas de
`start` e encerra os grupos de processos, incluindo migrations e seed.
Use `pnpm cloud:start`, `pnpm cloud:status` e `pnpm cloud:stop`.
`pnpm test:cloud` executa três regressões Linux sem bancos reais; requer porta
3000 livre. Configuração e detalhes em [docs/CLOUD-RETOMADA.md](docs/CLOUD-RETOMADA.md).


## Fase 4 — indicadores e configuração operacional

`/dashboard` apresenta números reais do banco fictício. Orientações estão no total
ativo e discriminadas; cancelados são separados. Com/sem parecer/aguardando
classificação somam o total. As datas são civis, em America/Sao_Paulo, semana de
segunda a domingo. O consolidado mensal considera o intervalo selecionado e não
representa fechamento, RMA oficial ou contagem de famílias únicas.

| Rota/API | Entrevistador | Encaminhador | Direção |
| --- | --- | --- | --- |
| `/api/indicators` | Próprios registros; somente total da unidade operacional | Bloqueado | Global, filtros por unidade/operador, detalhamento paginado |
| `/benefits`, `/service-types`, `/api/catalog/[kind]` | Bloqueado | Bloqueado | Benefícios e os sete tipos existentes; edição e histórico |
| `/api/operations` GET | Tipos, benefícios ativos e unidades autorizadas | Bloqueado | Tipos e benefícios ativos |
| `/api/operations` PATCH | Escolher unidade autorizada e ativa | Bloqueado | Bloqueado; define padrão e vínculos na gestão de usuários |

Cada possível duplicidade usa dono + CPF + data: grupos e registros envolvidos
são contados separadamente, sem deduplicar atendimentos. Filtrar uma unidade
recalcula os grupos; esses grupos não são aditivos entre unidades. O entrevistador
não recebe identificação nem detalhamento de colegas. Paginação de 50 linhas não
limita os totais; os dez últimos registros são uma lista explicitamente limitada.

Direção pode criar/renomear/inativar benefícios e renomear/ativar/inativar os sete
tipos. Códigos e regras de parecer/código familiar são fixos, sem exclusão física.
Benefícios são apenas informações do atendimento, sem certificar concessão.
Seleção vazia significa “não informado”; nomes ficam preservados no registro.
Tipos e benefícios inativos já usados podem ser mantidos ou removidos conforme
as regras da correção, mas não adicionados a novos registros.

A última unidade válida fica salva por usuário. A topbar e o novo formulário a
pré-selecionam; mudar a unidade principal pela Direção redefine a preferência.
Um formulário aberto envia a unidade que exibe, mesmo se outra aba mudar o padrão.
O servidor revalida autorização e atividade na gravação. Registros anteriores
preservam unidade/fuso/proprietário; mudança de local exige cancelamento e novo
registro. Revogação não elimina acesso ao próprio histórico.

Migration `20261023140000_indicators_configuration`: `Benefit`, `AttendanceType`,
`AttendanceBenefit`, `Attendance.kindName` e `User.operationalUnitId`. São 15
tabelas incluindo o controle Prisma. Os sete tipos são inicializados uma vez pela
migration; o seed repetido preserva nomes/configurações. Registros antigos mantêm
`kindName = NULL`, interpretado pelo mapa original fixo dos sete tipos, sem usar
nomes administrativos posteriores. Isso preserva registros cancelados imutáveis;
não há reescrita histórica nem desligamento de triggers. Benefícios antigos ficam
não informados. Preferências e alterações cadastrais geram auditoria transacional.

Validação: comandos existentes `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:cloud`, `pnpm build`, `pnpm test:e2e`. O CI exige banco limpo, quatro
migrations, seed idempotente, regressão e capturas. O teste de migração também
reproduz a base anterior preenchida, sem alterar o banco de desenvolvimento.
Módulos de pendências, fechamento e encaminhamentos continuam indisponíveis.
