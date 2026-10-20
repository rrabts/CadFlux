# CadFlux — validação da Fase 3

Base: main `1e7ccd8`. Branch `codex/phase-3-attendances-2026-10-19`.
A descrição do PR desta entrega registra o commit final e o run aprovado, após
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
