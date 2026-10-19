# CadFlux - execução e validação em nuvem

## Ponto de partida

O repositório oficial é `rrabts/CadFlux`. A Fase 1 já possui implementação e
validação documentada no Windows. A validação Linux de 02/10 foi parcial; consulte
`STATUS.md` e `CLOUD-VALIDACAO-2026-10-02.md` antes de declarar novos resultados.
O diagnóstico de 01/10 em `CLOUD-EXECUCAO.md` é histórico, anterior à implementação.

Na consulta de 19/10/2026, o repositório estava público. A visibilidade deve ser
confirmada no GitHub quando necessário; não presumir que o código está privado.
Isso não publica o aplicativo nem disponibiliza um banco de produção.

## Validação automatizada no GitHub Actions

O workflow `.github/workflows/phase-1-cloud.yml` prepara um runner Ubuntu 24.04,
Node 24.19.0, pnpm 10.28.2 e PostgreSQL 18. Usa somente dados fictícios, com bancos
descartáveis separados de desenvolvimento e testes, sem segredos de produção.

O fluxo é disparado em pull requests para `main`, em pushes para `main` ou por
`workflow_dispatch` depois que o workflow estiver disponível na branch padrão.

1. Confere o runtime e instala dependências com o lockfile preservado.
2. Cria o banco de testes e confirma que ambos os schemas estão vazios.
3. Valida o schema Prisma, aplica migrations e executa o seed nos dois bancos.
4. Confere a migration e o seed: três usuários, duas unidades, quatro categorias.
5. Repete o setup e compara resumos criptográficos dos registros para comprovar
   que o seed preservou usuários, unidades e categorias integralmente.
6. Executa lint, TypeScript, testes unitários e integração PostgreSQL, em sequência.
7. Gera o build de produção e executa o Playwright com Chromium no banco de testes.
8. Confere que a porta 3100 ficou livre depois do encerramento do servidor de teste.
9. Preserva relatório, capturas e traces do navegador por sete dias quando existirem.

`scripts/verify-cloud-database.mjs` executa somente consultas SQL e grava apenas
resumos criptográficos em `.local/`, ignorado pelo Git. Ele não limpa nem recria
bancos. As fases `empty`, `seeded` e `unchanged` devem ocorrer antes das suítes,
pois os testes acrescentam seus próprios registros fictícios.

Os resultados são os do run e commit indicados no relatório de execução. Criar um
workflow não significa que a validação passou. Conferir cada etapa, os logs e as
capturas antes de atualizar a matriz dos 20 critérios da Fase 1.

## Ambiente interativo de desenvolvimento em nuvem

Para editar e executar a aplicação em um ambiente Cloud interativo:

- selecionar o repositório autorizado e confirmar checkout, commit e branch;
- usar Node 22.12+ e pnpm 10.28.2;
- disponibilizar PostgreSQL real, sob usuário adequado ou como serviço do ambiente;
- manter bancos fictícios separados em `DATABASE_URL` e `DATABASE_URL_TEST`;
- configurar URLs fora do repositório e permitir os registros de pacotes e os
  downloads oficiais do Prisma e do navegador de teste;
- verificar que `node -e 'console.log(process.memoryUsage())'` funciona antes de
  instalar dependências ou tentar o build.

Usar `scripts/cloud-setup.sh` como referência de preparação, revisando sua
compatibilidade com o ambiente. Se o PostgreSQL já for fornecido externamente ao
processo, configurar `CADFLUX_SKIP_LOCAL_POSTGRES=1`. O setup não publica o aplicativo.
Depois de preparar os dois bancos, executar:

```sh
pnpm db:setup --all
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

Em 19/10, o executor restrito deste chat ainda falhou em `process.memoryUsage()`
com `uv_resident_set_memory`, antes de carregar o projeto. Não usar Windows como
substituto para essa validação nem alterar chamadas do Node para simular aprovação.
O runner do GitHub Actions é outro ambiente e precisa produzir suas próprias evidências.

## Segurança e escopo

Não enviar `.env`, banco, caches, tokens ou senhas reais ao GitHub. Credenciais do
workflow são fictícias e exclusivas dos containers descartáveis da tarefa.
Não contratar serviços ou publicar produção nesta etapa.

Continuar exclusivamente na Fase 1. Os módulos reais de atendimentos, CPF oficial,
fechamentos, documentos e encaminhamentos dependem de autorização posterior.

## Pedido de continuidade

> Continue o CadFlux V1.1 exclusivamente na Fase 1. Leia AGENTS.md, a especificação
> integral, STATUS.md e NUVEM.md. Preserve a implementação existente. Consulte os
> resultados atuais do workflow Phase 1 - Cloud validation e corrija falhas com
> evidências. Confirme PostgreSQL real, bancos separados, migrations, seed
> idempotente, lint, TypeScript, testes, build e cenários de navegador. Atualize a
> documentação com ambiente, commit, comandos e limitações. Não use a validação
> anterior do Windows como comprovação de execução em nuvem. Não publique produção
> nem avance para a Fase 2.
