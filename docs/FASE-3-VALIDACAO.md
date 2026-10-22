# CadFlux — validação da Fase 3

Base: main `1e7ccd8`. Branch `codex/phase-3-attendances-2026-10-19`.
A descrição do [PR #7](https://github.com/rrabts/CadFlux/pull/7) registra o commit final e o run aprovado, após
executar o workflow. Não confundir implementação ou abertura de PR com aprovação.

## Método

Execução completa no GitHub Actions: Ubuntu 24.04, Node 24.19.0, pnpm 10.28.2,
PostgreSQL 18 e Chromium. Dois bancos fictícios inicialmente vazios, três migrations,
seed repetido e comparado por SHA-256, lint, TypeScript, testes, build e navegador.
Servidor de testes deve encerrar automaticamente e liberar a porta 3100.

O executor restrito do chat executa revisão, geração do cliente Prisma, lint,
TypeScript e testes unitários. Ele não substitui o runner para integração/build.
As restrições de /tmp são contornadas com TMPDIR dentro de .local (ignorado), sem
alterar o comportamento da aplicação ou simular resultado do Node.

## Cobertura

- Regressão integral das Fases 1 e 2.
- Datas inválidas/futuras, semana civil no fuso da unidade, virada domingo/segunda.
- CPF estrutural e normalização, campos obrigatórios, orientação e inclusão.
- APIs sem sessão, Encaminhador, Direção sem permissão para criar, origem externa,
  JSON inválido e limite de corpo.
- Isolamento entre dois entrevistadores da mesma unidade: lista, detalhe, histórico,
  alteração, cancelamento, CPF anterior e filtros administrativos.
- Identidade institucional atribuída pelo servidor e preservada após transferência.
- Classificação definitiva de parecer, CPF/RF/RL imutáveis também por SQL direto.
- Duplicidade confirmável sem vazamento de existência de dados de colegas.
- Reaproveitamento de dados sem gravação automática.
- Cancelamento com motivo e histórico; recusa de reativação/delete e alteração de auditoria.
- Correção de semana antiga exclusiva da Direção.
- Concorrência com versão e dupla criação sem confirmação.
- Paginação com 51 registros, filtros e opções administrativas.
- Navegador: registro/classificação/correção/cancelamento; reaproveitamento e
  duplicidade; orientação/inclusão no mobile; consulta da Direção e bloqueio do Encaminhador.

## Evidências e limites

Relatório e capturas ficam no artifact `cadflux-browser-evidence` por sete dias:
`phase-3-attendance-detail.png`, `phase-3-attendance-list.png` e
`phase-3-attendance-mobile.png`, além das capturas de regressão.
O PR identifica a execução realmente aprovada e a inspeção visual correspondente.

Somente registros sintéticos no banco de teste. Seed de demonstração não cria
atendimentos. Sem consulta oficial, indicadores agregados, fechamento, documentos,
encaminhamentos ou publicação de produção. Ver decisões da especificação da Fase 3.

## Primeira execução e correções

O run [39355679335](https://github.com/rrabts/CadFlux/actions/runs/39355679335),
commit `bdab4c5`, aprovou as três migrations, seed idempotente, lint e TypeScript.
Dos 122 testes, 119 passaram. Três casos de rejeição receberam a validação Zod
como exceção síncrona antes de existir uma Promise. Os serviços foram declarados
assíncronos para manter o contrato de rejeição; os dados continuam recusados e
nenhuma verificação foi removida. Build/navegador não foram executados nesse run.

A revisão dos testes de navegador também passou a aguardar o título da página
de detalhe e um ID real, evitando que `/attendances/new` fosse confundido com
sucesso de gravação. Seletores de rótulos obrigatórios consideram o marcador de
obrigatoriedade, mantendo as verificações do campo e dos resultados.

Na segunda execução, [39355875125](https://github.com/rrabts/CadFlux/actions/runs/39355875125),
os 122 testes de backend, migrations, seed, lint, TypeScript e build passaram.
Dezessete cenários de navegador foram iniciados; dezesseis passaram. O último
confirmou o bloqueio da página, mas consultou a API com o cliente HTTP do Playwright,
que não reproduz o cookie Secure do Chromium no HTTP de loopback. A consulta passou
para fetch no próprio navegador autenticado, mantendo a exigência de 403 e a
configuração Secure da aplicação. O comportamento sem sessão (401) tem teste próprio.

A revisão também permite reaplicar os mesmos filtros após erro transitório e limpa
resultados antigos quando a busca falha; mensagens do dashboard distinguem os módulos
disponíveis dos painéis futuros. Nenhum resultado da execução anterior foi reutilizado
como aprovação desses ajustes.

A inspeção das capturas identificou que o full-page do navegador preservava a
posição de elementos fixos no ponto de rolagem atual, deslocando visualmente a
sidebar e o link de pular conteúdo na imagem. As capturas da Fase 3 agora voltam
ao topo antes de fotografar; a aplicação e sua navegação por teclado são preservadas.

O run [39356310647](https://github.com/rrabts/CadFlux/actions/runs/39356310647)
aprovou novamente 122 testes e build, mas o cenário da Direção encontrou registros
extras ao pesquisar um nome com números. A busca indevidamente extraía os dígitos
de qualquer texto para procurar CPF. A condição foi corrigida: CPF só é pesquisado
quando a entrada inteira é numérica ou uma máscara numérica. Foi acrescentado um
teste de regressão para nomes com números, sem reduzir a exigência do navegador.
