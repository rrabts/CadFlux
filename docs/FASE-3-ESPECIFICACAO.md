# CadFlux V1.1 — Fase 3: atendimentos

Autorizada por Roberto com “Vamos”, em 19/10/2026 (America/Sao_Paulo), após a
proposta de registro, consulta, correção, validação e auditoria de atendimentos.
Base: main `1e7ccd8`, Fases 1 e 2 integradas. As restrições das especificações
anteriores referem-se à autorização de suas respectivas entregas.

## Escopo e regras

- Exatamente três perfis. Entrevistador cria e consulta apenas seus registros.
  Direção consulta, corrige e cancela globalmente; não lança em nome de terceiros.
  Encaminhador não acessa o módulo, suas APIs, CPF anterior ou histórico.
- Registro de atendimento realizado: data, nome RF/RL, CPF estruturalmente válido,
  identificação RF/RL, código familiar, telefone opcional, tipo, parecer e marcação
  de multidão. Nome, CPF, data e tipo são obrigatórios. Orientação não exige nem
  guarda código familiar; nos demais tipos é obrigatório, numérico, até 20 dígitos.
- Tipos: Atualização Unipessoal/Familiar; Inclusão Familiar; Inclusão Unipessoal
  Bolsa Família/BPC; Averiguação Cadastral; Orientação.
- Inclusão e orientação ficam sem parecer. Atualizações e averiguação podem ficar
  aguardando classificação pós-atendimento; uma decisão com/sem parecer é imutável,
  inclusive para Direção. O banco também protege essa regra. Não há parecer textual.
- CPF e condição RF/RL não podem ser trocados após salvar. Nome pode ser corrigido
  com auditoria. Para outro responsável deve-se cancelar e criar outro registro.
- O servidor atribui operador e unidade principal ativa; não aceita IDs de dono,
  unidade, perfil ou status do cliente. Guarda identificação institucional e fuso
  da época do lançamento. Vínculos adicionais não mudam a unidade de operação.
- Data nunca é futura. Operador lança/corrige/cancela na semana corrente, de segunda
  a domingo, no fuso do registro. Direção pode corrigir ou registrar cancelamento
  de semanas anteriores. Não se implementa ainda janela pós-fechamento/reabertura.
- Cancelamento exige motivo, é definitivo e preserva registro e histórico; não há
  DELETE. Histórico inclui autor, horário e valores anteriores/novos. Não há faltas
  ou agenda: só atendimentos realizados. A lista distingue cancelados e ativos.
- Possível duplicidade: mesmo CPF e data entre registros ativos do próprio operador
  (na correção administrativa, do dono original). Aviso exige confirmação explícita
  para salvar; não bloqueia definitivamente. Não revela existência de dados alheios.
- Reaproveitamento opcional dos dados do registro ativo mais recente do próprio
  entrevistador para o CPF, após confirmação. Campos reaproveitados ficam bloqueados
  até “Editar dados”. Não há consulta oficial, substituição por nome oficial, cadastro
  separado de pessoa/família ou alteração de atendimentos anteriores.
- Lista paginada (50), busca nome/CPF, filtros de data, tipo, parecer e cancelamento;
  Direção também filtra unidade/operador. Histórico anterior à troca de unidade
  continua visível ao dono; o acesso nunca se amplia a registros de colegas.
- Versão otimista impede sobrescrever alteração concorrente. Mutações revalidam
  ator, status, perfil e vínculo no banco e compartilham lock com a administração.

## Critérios de aceite

1. Criar, listar, filtrar e abrir atendimentos no desktop e mobile.
2. Rotas/APIs negam Encaminhador e usuários sem sessão/senha regularizada.
3. Dois entrevistadores, mesmo na mesma unidade, não leem/alteram/reaproveitam
   registros um do outro nem veem seus alertas de duplicidade.
4. Unidade e operador são definidos no servidor e sua identificação é preservada.
5. CPF inválido, data futura, campos ausentes e combinações de parecer são recusados.
6. Orientação dispensa código; inclusão não admite parecer; classificação definitiva
   não muda e não se troca CPF/RF/RL após salvar, inclusive por SQL direto.
7. Duplicidade avisa e admite confirmação; reaproveitar exige decisão do operador.
8. Edição/cancelamento respeitam semana local, motivo, versão e auditoria atômica.
9. Cancelados permanecem consultáveis, sem reativação/exclusão física.
10. Migration funciona em bancos limpos, seed idempotente, regressão das Fases 1 e 2,
    lint, TypeScript, testes de integração, build e navegador passam na nuvem.

## Limites

Somente dados fictícios. Sem hospedagem de produção, indicadores agregados, benefícios
configuráveis, consulta oficial de CPF, fechamento, PDFs/Word e encaminhamentos.
Pendências nesta fase são mensagens de validação e classificação aguardada; o módulo
completo de pendências da gestão não faz parte desta entrega. Fase 4 requer autorização.
