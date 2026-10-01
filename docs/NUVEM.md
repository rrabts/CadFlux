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
