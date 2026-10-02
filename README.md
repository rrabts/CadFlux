# CadFlux V1.1 — Fase 1

Fundação de uma aplicação administrativa para o Cadastro Único. Monólito modular com autenticação real, três perfis, gestão de usuários, unidades, categorias profissionais, importação revisada e auditoria. Os módulos operacionais futuros exibem estados vazios ou “Em desenvolvimento”.

## Stack e requisitos

- Node.js **22.12+** (validado com Node 24), pnpm **10.28.2**.
- Next.js 16 / React 19, TypeScript strict, Tailwind CSS 4, Radix UI e Sonner.
- PostgreSQL e Prisma 6.19.3. O lockfile fixa as versões efetivamente instaladas.
- Vitest com PostgreSQL real; Playwright/Chromium e axe para interface e acessibilidade.
- Linux, macOS ou Windows com PostgreSQL. O PostgreSQL embarcado é uma opção exclusivamente de desenvolvimento.

## Instalação local

```bash
git clone https://github.com/rrabts/CadFlux.git
cd CadFlux
git switch feature/foundation-auth
npm install -g pnpm@10.28.2
pnpm install --frozen-lockfile
cp .env.example .env
```

Inicie o PostgreSQL de desenvolvimento em um terminal:

```bash
pnpm db:local
```

O comando inicia um **PostgreSQL real**, em `127.0.0.1:54329`, persiste os dados em `.local/postgres` e cria `cadflux` e `cadflux_test`. Pare com Ctrl+C. Não execute como root. Alternativamente, use `docker compose up -d` ou um PostgreSQL existente e ajuste as URLs. Não use o banco embarcado em produção.

Em outro terminal:

```bash
pnpm db:setup     # aplica migrations e executa o seed
pnpm dev
```

Acesse **http://127.0.0.1:3000**. Use esse mesmo endereço em `APP_URL`; a validação de origem bloqueia alterações vindas de outras origens. Se preferir `localhost`, ajuste `APP_URL` também.

Comandos independentes:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:cleanup
```

`db:cleanup` remove sessões e tokens expirados e limpa dados pessoais das prévias vencidas. Agende sua execução periódica no ambiente operacional. Prévia confirmada tem seus dados pessoais descartados imediatamente. O histórico de auditoria é preservado.

## Variáveis de ambiente

| Variável            | Finalidade                                                          |
| ------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`      | Banco da aplicação, com credenciais próprias do ambiente            |
| `DATABASE_URL_TEST` | Banco exclusivo de testes; nome obrigatoriamente termina em `_test` |
| `APP_URL`           | Origem exata do aplicativo, incluindo protocolo e porta             |
| `NODE_ENV`          | Desenvolvimento local; Next define `production` no build/start      |

`.env.example` contém somente credenciais fictícias locais. `.env`, bancos, relatórios e caches estão ignorados pelo Git. Use HTTPS e credenciais próprias em produção. A aplicação não exige serviços de e-mail ou MFA nesta fase.

## Contas fictícias

O seed é idempotente: não sobrescreve contas existentes nem redefine suas senhas. É recusado com `NODE_ENV=production`.

| E-mail                        | Matrícula  | Perfil        | Categoria         |
| ----------------------------- | ---------- | ------------- | ----------------- |
| `direcao@cadflux.local`       | `DEMO-001` | Direção       | Coordenação       |
| `entrevistador@cadflux.local` | `DEMO-002` | Entrevistador | Entrevistador     |
| `encaminhador@cadflux.local`  | `DEMO-003` | Encaminhador  | Assistente Social |

Senha inicial de todas as contas: **`CadFlux!Dev2026`**. Troca obrigatória no primeiro acesso, com mínimo de 12 caracteres. São contas e credenciais **exclusivamente de desenvolvimento, impróprias para produção**. Unidade: `DEMO-01`, Unidade Demonstração. Categoria Visitador também é criada. Não há pessoas ou CPFs reais no seed.

Novos usuários recebem uma senha aleatória de 144 bits, exibida somente na resposta de criação/confirmação. A Direção deve entregá-la por canal seguro. Não há senha em CSV/XLSX, logs ou banco em texto puro. A troca encerra todas as sessões da conta.

## Autenticação, autorização e auditoria

- Senhas derivadas com scrypt, salt aleatório e comparação em tempo constante.
- Sessões opacas aleatórias de 256 bits, armazenadas no banco somente pelo hash SHA-256; expiração absoluta de 8 horas.
- Cookie HttpOnly, SameSite=Lax e Secure com prefixo `__Host-` em produção.
- Login por e-mail ou matrícula; mensagem genérica para credenciais inválidas e inativos. Limite de 10 tentativas por identificador a cada 15 minutos, persistido no banco; sucesso limpa a contagem.
- Perfil e status são consultados no servidor. As mutações administrativas revalidam a Direção na transação. Inativação ou mudança de perfil revoga sessões.
- Mutações exigem `Origin` correspondente a `APP_URL`; rejeitam requisições cross-site. APIs administrativas usam schemas estritos e seleção explícita de campos.
- A Direção não pode alterar o próprio perfil/status; tentativas são auditadas. A última Direção ativa não pode ser removida desse papel. Aprovação por segundo administrador é uma evolução futura, sem workflow implementado agora.
- Auditoria inclui login, criação, edição, mudanças de perfil/categoria/unidade, ativação/inativação, importação e alterações dos cadastros auxiliares. Mudança e log são transacionais.
- `AuditLog` rejeita UPDATE, DELETE e TRUNCATE por triggers PostgreSQL. Não existe API para editar/excluir logs. Usuários rejeitam DELETE no banco.
- Snapshots auditam os vínculos/perfil/status sem armazenar senhas, tokens, CPF ou nomes/e-mails anteriores. Histórico básico não é um arquivo completo de dados pessoais.

Em produção, use um papel de runtime sem privilégios de DDL/superusuário e um papel separado para migrations. Um administrador do próprio banco pode remover triggers; esse privilégio não deve pertencer ao processo web.

### Matriz de acesso

| Área/ação                              | Entrevistador                      | Encaminhador                       | Direção                      |
| -------------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------- |
| Dashboard do próprio perfil            | Sim                                | Sim                                | Sim                          |
| Meu perfil / troca de senha            | Próprio                            | Próprio                            | Próprio                      |
| Gestão, busca e importação de usuários | Não                                | Não                                | Global                       |
| Unidades / categorias                  | Não                                | Não                                | Global                       |
| Auditoria                              | Não                                | Não                                | Global                       |
| Módulos futuros                        | Placeholders autorizados pelo menu | Placeholders autorizados pelo menu | Placeholders administrativos |

Usuário inativo não acessa nenhuma área autenticada. Senha temporária restringe acesso à conta/troca de senha. Não há acesso individual a colegas nos perfis operacionais. As regras futuras de atendimentos/encaminhamentos não foram implementadas.

## Importação CSV / XLSX

Em Gestão de Usuários → Importar usuários:

1. Baixe o template CSV. É possível preenchê-lo em um editor de planilhas e salvar como CSV UTF-8 ou XLSX com uma única aba.
2. Envie até **2 MB e 500 usuários**. A ordem dos cabeçalhos deve ser exatamente:

```text
nome,cpf_ou_identificador,email,matricula,perfil,categoria,unidade,status
```

3. Revise Total, Válidos, Inválidos, Duplicados e erros por linha. Nenhum usuário é criado nessa etapa; uma prévia temporária é armazenada por até 30 minutos.
4. Corrija todos os erros. Não há importação parcial. Confirme para revalidar e criar todos os usuários atomicamente.
5. Entregue as senhas temporárias; são mostradas somente após a confirmação bem-sucedida.

Valores: perfil enum `INTERVIEWER`, `REFERRAL_OPERATOR`, `DIRECTION`; status `ACTIVE`/`INACTIVE`; categoria pelo nome exato; unidade pelo **código**. Identificador pode ser alfanumérico; valor numérico é tratado como CPF, com verificação estrutural dos dígitos, sem consulta oficial. CPF é normalizado para detectar duplicidade com/sem pontuação.

CSV aceita vírgula ou ponto e vírgula. Remova linhas vazias do arquivo antes do envio. SQL, colunas extras/senhas, XLSX falso, fórmulas, hyperlinks/células complexas, macros e vínculos externos são rejeitados. Conteúdo iniciando com marcadores de fórmula é rejeitado, evitando CSV injection; nenhum valor enviado vira expressão executável. XLSX possui limites de entradas e tamanho expandido. Não há armazenamento do arquivo original. Confirmação pertence ao administrador que criou a prévia, expira, é de uso único e verifica novamente duplicidades no banco.

## Interface e rotas

- `/login`, `/recover`: acesso institucional e orientação de recuperação.
- `/dashboard`: dashboard específico por perfil com estados vazios; somente a contagem de unidades ativas é real.
- `/profile`: dados da própria conta e troca de senha.
- `/users`: busca por nome, identificador ou matrícula, filtros de perfil/categoria/unidade/status, criação e detalhe com quatro abas, edição, ativação/inativação e histórico. Até 200 resultados por busca; refine os filtros para localizar outros registros.
- `/users/import`: upload, pré-validação, revisão e confirmação.
- `/workspace/units`, `/workspace/categories`: cadastros auxiliares funcionais para Direção.
- `/workspace/audit`: até 200 logs mais recentes, somente leitura; detalhe de usuário mostra os 100 mais recentes.
- Demais `/workspace/*`: páginas “Em desenvolvimento”, com autorização conforme menu.
- `/forbidden`: mensagem de acesso não permitido.

Sidebar aberta/recolhível, drawer acessível no mobile, topbar com usuário/matrícula/unidade e menu de conta. Tema Claro/Escuro/Sistema persiste no navegador. Componentes básicos em `src/components/ui.tsx`, primitives Radix para foco, teclado, menus, abas, tooltip e modal. Mensagens contextuais e toast nas mutações; tabelas com rolagem horizontal; transições leves com respeito a `prefers-reduced-motion`.

API Node: `/api/auth/{login,logout,me,password}`, `/api/users`, `/api/users/:id`, `/api/users/:id/history`, `/api/references`, `/api/units`, `/api/units/:id`, `/api/categories`, `/api/categories/:id`, `/api/audit`, `/api/imports/template`, `/api/imports/preview`, `/api/imports/:id/confirm`. Não há endpoints de exclusão física.

## Arquitetura e banco

```text
src/app/                         Rotas, layouts e fronteira HTTP
src/server/auth.ts               Identidade da sessão e proteção de páginas
src/modules/auth/                Hash, login, sessão, troca de senha, contratos futuros
src/modules/permissions/         Política central can/assertPermission
src/modules/users/               Schemas, serviços transacionais e interface
src/modules/imports/             Parser controlado, validação, prévia e confirmação
src/modules/units/               Schema e gestão dos cadastros auxiliares
src/modules/professional-categories/ Schema de categoria
src/modules/audit/               Escrita append-only e consulta
src/components/                  Marca, tema, UI e layout
src/lib/                         Prisma, erros e contratos seguros
prisma/                          Schema, migration e seed
scripts/                         Banco local, preparação e limpeza temporária
tests/                           Integração PostgreSQL e navegador
```

Migration `202610020001_foundation` cria User, Unit, ProfessionalCategory, UserUnitAccess, Session, LoginRateLimit, MfaCredential, PasswordResetToken, UserImportBatch e AuditLog, enums, índices, relações e triggers de preservação. Perfil não é categoria. `functionalIdentifier` corresponde ao CPF/identificador opcional. `UserUnitAccess` permite vínculos adicionais futuros, sem interface nesta fase.

## Verificações

Com o PostgreSQL rodando e `.env` configurado:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm format:check
pnpm build
pnpm start
```

`pnpm test` usa exclusivamente `DATABASE_URL_TEST`, aplica a migration e cria fixtures fictícias identificadas por execução. Testa autenticação, permissões, gestão, importação CSV/XLSX, atomicidade, IDOR, limites e auditoria append-only. Não usa mocks de banco.

Playwright também usa **somente o banco `_test`**, inicializa as contas fictícias, sobe servidor em `127.0.0.1:3000` e restaura as senhas de demonstração ao final. Não mantenha outro servidor nessa porta durante a suíte. Testa acesso direto por URL/API, CSRF, inativação, tema persistido, sidebar/drawer, logout, CRUD pela interface, importação, troca de senha e acessibilidade axe. Screenshots/traces ficam em `test-results/` (não versionados). Testes criam dados persistentes no banco de testes; não aponte essa URL para dados reais.

CI em `.github/workflows/ci.yml` provisiona PostgreSQL e executa as verificações. Para instalar bibliotecas de sistema do navegador em Linux mínimo: `pnpm exec playwright install --with-deps chromium`.

## Limitações e evolução preparada

- Recuperação automática por e-mail, convite e MFA **não estão ativos**. Há entidades para tokens/MFA e interfaces de adaptação; recuperação mostra orientação sem fingir que enviou e-mail. Direção terá MFA obrigatório em fase futura.
- Não há aprovação por segundo administrador nem UI para unidades adicionais.
- Não há integração de CPF oficial, atendimento real, pessoa/família, benefício operacional, fechamento, documento oficial, DOCX/PDF, encaminhamento funcional, indicadores reais, IA, WhatsApp ou BI.
- Sem publicação em produção nesta entrega. HTTPS, gestão de credenciais, backups e operação do banco pertencem à configuração do ambiente de implantação.
- Limites e consultas administrativas são deliberadamente simples nesta fundação; paginação avançada e exportação de auditoria ficam para evolução posterior.

A especificação da Fase 1 é o limite desta entrega. Nenhuma implementação da Fase 2 foi iniciada.
