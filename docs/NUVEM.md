# Continuar CadFlux no Codex Cloud

## Pré-requisitos

- Repositório privado no GitHub contendo estes arquivos.
- Repositório autorizado na conexão GitHub do Codex.
- Ambiente Codex Cloud com Node.js 22.12+ e PostgreSQL para desenvolvimento/testes.
- Rede liberada para os registros de pacotes e downloads oficiais do Prisma.

O ambiente de execução do agente é separado de uma futura hospedagem do aplicativo.
Não contratar serviços ou publicar uma instância de produção nesta etapa.

## Configuração

1. No Codex/ChatGPT, criar um ambiente Cloud e selecionar o repositório CadFlux.
2. Na preparação Linux, usar `bash scripts/cloud-setup.sh` como referência.
3. Se o ambiente já fornecer PostgreSQL, configurar DATABASE_URL no ambiente e
   usar CADFLUX_SKIP_LOCAL_POSTGRES=1; o script não substituirá essas credenciais.
4. Instalar dependências, revisar os resultados e publicar a configuração do ambiente.
5. Iniciar uma tarefa com o texto abaixo e conferir que a execução está em Cloud.

## Texto de retomada

> Continue o CadFlux V1.1 exclusivamente na Fase 1. Leia AGENTS.md,
> docs/FASE-1-ESPECIFICACAO.txt e docs/STATUS.md. Preserve os arquivos corretos e
> conclua todos os requisitos autorizados. O projeto está parcial e nunca foi
> validado. Configure PostgreSQL real, migrations e seed; implemente autenticação,
> autorização de backend, gestão de usuários, importação CSV/XLSX segura com prévia
> e confirmação, auditoria, tema e UI acessível. Rode migrations, seed, lint,
> typecheck, testes críticos e build, corrija problemas e documente resultados.
> Não avance para módulos reais de atendimentos/CPF/fechamentos/documentos ou
> encaminhamentos. Entregue a evidência dos critérios da Fase 1 e pare ao terminar.

## Dados e segurança

Não enviar .env, banco local, caches ou senhas reais ao repositório. O .env.example
contém exclusivamente credenciais fictícias de desenvolvimento. As credenciais do
ambiente de nuvem devem ser configuradas fora do código. O setup não faz deploy.

## Selecionar um ambiente adequado após o diagnóstico de 01/10

O executor restrito deste chat não conseguiu executar PostgreSQL e o build Next.js.
Veja [CLOUD-EXECUCAO.md](CLOUD-EXECUCAO.md). Não usar pasta Windows como substituto.

Conforme a documentação oficial vigente:
https://learn.chatgpt.com/docs/environments/cloud-environments

1. Em uma nova tarefa, selecionar **Work in > Cloud > Select environment > Create environment**,
   ou **Settings > Codex Cloud > Environments > Create environment**.
2. Selecionar exclusivamente o repositório privado **rrabts/CadFlux** na conexão
   GitHub rrabts. Confirmar checkout autenticado e acesso de escrita no executor;
   acesso pelo conector do chat, isoladamente, não comprova acesso Git do shell.
3. Em Get started, solicitar Node 22.12+ e pnpm **10.28.2**, além de PostgreSQL real
   de desenvolvimento/testes. Usar scripts/cloud-setup.sh como base, revisando-o
   para o ambiente escolhido. Se já existir banco acessível, configurar DATABASE_URL
   e DATABASE_URL_TEST fora do repositório e CADFLUX_SKIP_LOCAL_POSTGRES=1.
   Os dois URLs devem apontar para bancos fictícios separados, nunca produção.
4. Habilitar a rede necessária aos gerenciadores de pacotes, GitHub e downloads
   oficiais do Prisma (incluindo binaries.prisma.sh quando necessário).
5. Pedir verificação efetiva de: conexão SQL; execução sob usuário adequado para
   PostgreSQL; serviços persistentes durante a tarefa; recursos de sistema para
   Node/Next (incluindo leitura de memória do processo); checkout e branch corretos.
6. Revisar o relatório de setup e selecionar Publish somente para salvar o
   **ambiente de desenvolvimento**. Isso não publica o aplicativo em produção.
7. Selecionar Start a new task e usar o pedido original de continuação da Fase 1.
   Trabalhar na branch codex/phase-1-cloud e preservar o diagnóstico sem transformar
   as verificações parciais em funcionalidades concluídas.

Texto para preparação do ambiente:

> Prepare um ambiente Codex Cloud para rrabts/CadFlux, independente do Windows.
> Leia AGENTS.md, docs/NUVEM.md e docs/CLOUD-EXECUCAO.md. Configure checkout Git
> autenticado, Node 22.12+, pnpm 10.28.2 e PostgreSQL real de desenvolvimento e
> testes em bancos separados. Revise scripts/cloud-setup.sh e execute a instalação.
> Confirme que o executor consegue iniciar serviços e executar Next.js sem o erro
> uv_resident_set_memory. Não contratar hospedagem, publicar produção ou usar dados
> reais. Relate o setup e suas verificações; a aplicação permanece parcial e a
> implementação posterior deve ficar exclusivamente na Fase 1.

Não há ferramenta disponível neste chat para selecionar ou publicar esse ambiente
Codex Cloud pela API. A seleção precisa ocorrer na interface acima. Não enviar
senhas reais no texto da tarefa ou commit.
