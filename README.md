# CadFlux V1.1 — Fase 1

Fundação institucional para autenticação, autorização e gestão de usuários do Cadastro Único. Apenas dados fictícios. Atendimentos, encaminhamentos, indicadores operacionais, consulta oficial de CPF, fechamentos e documentos oficiais permanecem como telas vazias ou módulos em desenvolvimento.

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
| /units, /categories                            | Bloqueado               | Bloqueado               | Consultar cadastros de apoio                                            |
| /audit                                         | Bloqueado               | Bloqueado               | Consultar auditoria                                                     |
| /workspace/[slug]                              | Somente menus do perfil | Somente menus do perfil | Somente menus do perfil                                                 |
| /login, /recovery                              | Público                 | Público                 | Público                                                                 |

A gestão lista 50 usuários por página, informa o total e mantém os filtros ao navegar. Alterar os filtros volta à primeira página.

Menus de atendimento, encaminhamento, fechamento, documentos e pendências direcionam a estados vazios/“Em desenvolvimento”. Não registram operações reais. A topbar oferece tema Claro/Escuro/Sistema, perfil e logout. A sidebar pode recolher; no mobile funciona como drawer com foco, Escape e navegação por teclado.

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

Monólito modular Next.js/TypeScript estrito, React/Tailwind, PostgreSQL/Prisma. Serviços em `src/modules/{auth,permissions,users,imports,audit}`, componentes reutilizáveis em `src/components` e rotas em `src/app`.

Entidades: User, ProfessionalCategory, Unit, UserUnitAccess, Session, LoginRateLimit, MfaCredential, PasswordResetToken, UserImportBatch e AuditLog.

Migration: `prisma/migrations/20261002140000_foundation/migration.sql`, gerada a partir do schema e acrescida de triggers para bloquear UPDATE/DELETE/TRUNCATE de AuditLog e DELETE de usuários/unidades/categorias. Auditoria registra login/logout, criação/edição, mudanças de perfil/categoria/unidade/status, troca de senha e confirmação de importação. Senhas, hashes de senha e tokens são removidos recursivamente das informações de auditoria.

Senhas usam scrypt salgado; tokens aleatórios ficam apenas por hash no banco. A sessão dura oito horas, em cookie httpOnly/SameSite=Lax e Secure em produção. Login possui limitação de tentativas no banco. Mutações exigem origem válida. Mudanças de perfil/status e senha revogam sessões; cada requisição consulta o usuário atual. Outro administrador deve alterar o perfil/status da própria Direção; alterações administrativas preservam uma Direção ativa.

A modelagem permite unidades adicionais, recuperação de senha e MFA posterior. A interface de recuperação informa que a entrega externa ainda está preparada. MFA externo, fluxo completo de recuperação e refinamento dos cadastros de apoio ficam para fases posteriores autorizadas. Banco e aplicação de produção não foram publicados nesta tarefa.

## Verificar

Com PostgreSQL em execução e ambos os bancos preparados:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm test` executa testes unitários e integração contra `DATABASE_URL_TEST`, recusando o mesmo banco de desenvolvimento. `pnpm test:integration` restringe a execução à integração de backend/importação. Os testes usam dados fictícios com identificadores únicos e preservam auditoria.

O teste de navegador inicia o build de produção em 127.0.0.1:3100, apontando somente ao banco de teste. Instale o Chromium de testes com `pnpm exec playwright install chromium`; em Windows com Edge/Chrome já instalado é possível definir `PLAYWRIGHT_CHANNEL=msedge` ou `chrome`. Execute `pnpm build` antes de `pnpm test:e2e`.

Validação em 02/10/2026: lint, typecheck, 85 testes em cinco arquivos e build com saída 0; dez cenários de navegador aprovados no Edge. No executor Windows protegido desta entrega, foi necessário encerrar somente o servidor Next de teste após os cenários para liberar o término do Playwright. O runner gerou o relatório final e saiu 0; o encerramento automático nesse sandbox permanece uma limitação do executor.

Resultados reais, matriz dos 20 critérios e limitações estão em [docs/STATUS.md](docs/STATUS.md). [docs/CLOUD-EXECUCAO.md](docs/CLOUD-EXECUCAO.md) preserva o diagnóstico histórico do executor anterior; não descreve a validação atual.

Não avance para a Fase 2 sem autorização.
