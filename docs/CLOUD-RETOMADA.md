# Codex Cloud Linux: instalação e retomada

Ambiente de desenvolvimento de rrabts/CadFlux, com dados fictícios. Sem deploy.
A implementação está na branch `codex/cloud-linux-setup`, baseada na main.
Os scripts devem estar presentes na branch selecionada ao salvar o ambiente.

## Campos da configuração Cloud

| Campo         | Configuração                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Repositório   | `rrabts/CadFlux`, conexão GitHub autorizada para leitura/escrita                               |
| Base          | `main`, depois de incorporar os scripts desta branch                                           |
| Usuário Linux | Sem root; o binário PostgreSQL está nas dependências do projeto                                |
| Node          | 22.12 ou superior (verificado com 24.19.0)                                                     |
| pnpm          | 10.28.2; o setup usa `npm exec` quando a versão global difere                                  |
| Preparação    | `bash scripts/cloud-setup.sh`, a partir da raiz do checkout                                    |
| Retomada      | `node scripts/cloud-runtime.mjs start`, a partir da raiz do checkout                           |
| Rede          | preset `package_managers` e `binaries.prisma.sh`                                               |
| URLs          | `DATABASE_URL` e `DATABASE_URL_TEST` nas variáveis/secrets Cloud, bancos distintos e fictícios |
| APP_URL       | `http://127.0.0.1:3000`                                                                        |
| NODE_ENV      | `development`                                                                                  |

Se a interface não oferecer um campo de retomada, executar `cloud:start` no começo
da tarefa. O supervisor não sobrevive à destruição da máquina. O setup pode ser
reexecutado para reconstruir dependências e serviços; não apaga os bancos.
Não presuma que `.local` ou `.env` sobrevivem à recriação do ambiente.

Para o PostgreSQL gerenciado pelo script, os URLs devem apontar a `127.0.0.1`
com mesma porta e credenciais, e nomes de bancos diferentes. As configurações
fictícias iniciais estão em `.env.example`. Se os dois URLs forem injetados pelo
Cloud, os scripts usam esses valores sem criar `.env`. Se nenhum for fornecido,
o setup cria `.env` ignorado com permissão 0600 e valores fictícios de exemplo.
Não colocar secrets em scripts ou commits.

Para bancos externos de desenvolvimento, definir também
`CADFLUX_SKIP_LOCAL_POSTGRES=1`. O supervisor não cria, encerra nem reinicia
PostgreSQL externo; valida conexão e executa migrations/seed em ambos os bancos.
Ele continua responsável pelo Next.js local.

A interface deve salvar/publicar apenas a configuração do ambiente de
**desenvolvimento**. Não há API de escrita dessa configuração disponível neste
chat. Portanto, secrets e publicação precisam ser feitos na interface do Codex;
essa etapa não foi executada pelo agente.

## Operação

```bash
bash scripts/cloud-setup.sh
# Retomada sem reinstalar:
node scripts/cloud-runtime.mjs start
node scripts/cloud-runtime.mjs status
node scripts/cloud-runtime.mjs stop
```

Também disponíveis como `pnpm cloud:start`, `pnpm cloud:status`, `pnpm cloud:stop`
quando pnpm 10.28.2 está selecionado. Para fixar sem instalar globalmente:
`npm exec --yes --package=pnpm@10.28.2 -- pnpm cloud:status`.

O supervisor inicia PostgreSQL, aguarda SELECT 1 nos dois bancos, aplica migrations
e seed e inicia Next.js de desenvolvimento em loopback na porta 3000.
Confirma `/login` com HTTP 200 antes de anunciar prontidão. Processos encerrados
são reiniciados após 2 segundos, no máximo cinco vezes por serviço/supervisor.
Limite excedido encerra os serviços e retorna falha; a próxima chamada start
permite nova tentativa. `status` verifica processos, SQL e HTTP; não basta um PID.

Logs, PID e prontidão ficam em `.local/cloud`, ignorados e protegidos por umask 077. Dados ficam em `.local/postgres`. `stop` sinaliza somente o supervisor
identificado e encerra os filhos que ele criou. Portas já ocupadas são recusadas;
encerre os serviços manuais anteriores antes de migrar para o supervisor.
Após alterar URLs/variáveis, use stop/start para atualizar o ambiente dos filhos.

O sandbox padrão desta sessão não alcança proxy/loopback. Executar estes comandos
com a permissão ampliada do executor Cloud, como foi feito nas verificações.
Isso depende da plataforma; modificar `/etc/codex/network-policy.json` não libera
rede. Não desabilitar proxy ou TLS.

## Navegador e testes

Os E2E usam exclusivamente o banco de testes e um servidor na porta 3100.
Não executar integração e E2E simultaneamente. Para preparar o build, interromper
o supervisor (Next dev e build compartilham `.next`) e manter somente o banco:

```bash
node scripts/cloud-runtime.mjs stop
# Terminal separado, enquanto durarem os testes:
node scripts/local-postgres.mjs
# Terminal de testes:
npm exec --yes --package=pnpm@10.28.2 -- pnpm build
PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium npm exec --yes --package=pnpm@10.28.2 -- pnpm test:e2e
```

Ao terminar, encerrar o terminal PostgreSQL com Ctrl+C e executar cloud:start.
Se Chromium não estiver instalado, a configuração padrão do Playwright continua
válida; instalar o navegador com sua rede autorizada. Nesta sessão, o download
em `cdn.playwright.dev` recebeu 403 de política. O Chromium já instalado foi
usado sem contornar essa restrição. Se for necessário baixar em um ambiente novo,
liberar os hosts oficiais indicados pelo instalador na configuração Cloud.

## Evidências desta sessão

- Setup completo sem apt/sudo: saída 0.
- Start repetido: idempotente; SQL e HTTP passaram.
- Encerramento dos filhos PostgreSQL e Next: reinício automático observado.
- Stop/start: SQL, migrations/seed e HTTP passaram; dados preservados.
- Porta de banco já ocupada: supervisor recusou a inicialização, sem assumir o processo.
- Lint e typecheck: saída 0; build: saída 0, sem uv_resident_set_memory.
- Vitest: 85 testes em 5 arquivos, saída 0.
- E2E com Chromium Linux: 10 passaram em 21,3s, saída 0; teardown automático.

Essas evidências verificam reinício de processos na mesma máquina. Uma tarefa em
uma instância Cloud nova ainda depende de salvar a configuração pela interface,
incorporar os scripts na branch usada e executar a validação nela.

## Verificação em checkout limpo

Após enviar a branch, foi feito clone Git autenticado em
`/workspace/CadFlux-clean-validation`, sem `.env`, `.local` ou `node_modules`.
O setup criou dependências, dois bancos novos, migration e seed, e iniciou os
serviços com SQL/HTTP aprovados. O cache de pacotes da máquina foi reutilizado;
não houve reutilização dos bancos ou configuração do checkout original.

Nesse checkout, lint, typecheck, build, 85 testes e 10 E2E passaram novamente
(E2E: 24,9s, saída 0, teardown automático). Também foi verificada inicialização
com DATABASE_URL e DATABASE_URL_TEST herdados do processo, sem `.env`: SQL/HTTP
passaram e nenhum `.env` foi criado. Os serviços desse clone foram encerrados
após a validação; o supervisor do checkout original foi retomado.

Isso comprova a instalação do zero e a configuração por variáveis na máquina
atual. Não substitui salvar os secrets/configuração na plataforma e validar uma
instância Cloud nova. A branch remota permite revisar e incorporar os scripts
antes dessa etapa.
