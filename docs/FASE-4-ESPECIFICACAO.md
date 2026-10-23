# CadFlux V1.1 — Fase 4: indicadores e configuração operacional

Especificação preparada em 23/10/2026 (America/Sao_Paulo), após Roberto solicitar
“Prossiga” para a etapa de definição. Base examinada: main `832544c`.
Após esta especificação, Roberto autorizou a implementação com “Prossiga”.
Este documento define o contrato; o estado e as evidências atuais estão em
[FASE-4-VALIDACAO.md](FASE-4-VALIDACAO.md).

## 1. Objetivo e origem das decisões

Transformar os registros existentes em indicadores verificáveis e completar
benefícios, apresentação dos tipos e escolha do local de atendimento.
O CadFlux continua apoiando a gestão interna, sem substituir sistemas oficiais.

Decisões expressas de Roberto nesta rodada:
- Orientações entram no total de atendimentos e também são discriminadas.
  Cancelados ficam fora do total principal.
- A Direção pode alterar os nomes exibidos dos tipos, além de ativar/inativar.
  Códigos, regras e identificação histórica permanecem preservados.
- Cada conta tem local definido pela coordenação. O operador pode trocar de local;
  todo novo atendimento já apresenta um local pré-selecionado.

Detalhamento adotado nesta especificação:
- A última unidade escolhida persiste por usuário, inclusive após novo login,
  enquanto continuar autorizada e ativa; na ausência dela, usar a principal.
- Troca do padrão pela Direção restabelece esse novo padrão para a próxima sessão.
- Métricas usam a data do atendimento, com orientação separada dentro do total,
  semana civil segunda–domingo e calendário institucional America/Sao_Paulo.
Esses detalhes tornam as regras testáveis; não são apresentados como falas
literais de Roberto. O fechamento de sexta-feira continua sendo assunto da Fase 6.

## 2. Rastreabilidade e limites

| ID do roadmap | Entrega da Fase 4 |
| --- | --- |
| IND-01 | Hoje, semana, mês, resumo semanal e últimos atendimentos reais |
| IND-02 | Visões autorizadas da Direção e do Entrevistador |
| IND-03 | Consolidado mensal, pareceres e possíveis duplicidades |
| CFG-01 | Gestão de benefícios e seleção múltipla no atendimento |
| CFG-02 | Nomes e disponibilidade dos sete tipos existentes |
| CFG-03 | Unidade operacional pré-selecionada e validada no servidor |
| QUA-01 | Permissões, auditoria, acessibilidade, mobile e regressão |

IND-04 permanece na Fase 6 e IND-05 na Fase 8. Pendências, fechamentos e
encaminhamentos ainda indisponíveis devem ser identificados como indisponíveis,
sem números fictícios nem zero que sugira funcionalidade implementada.
Não entram CPF oficial, PDFs/DOCX, novos perfis, tipos arbitrários, integrações
externas, produção ou alteração da janela de correção da Fase 3.

## 3. Indicadores: definições reproduzíveis

### Períodos, escopo e consistência

Usar `Attendance.serviceDate`, que é uma data civil no PostgreSQL, e não
`createdAt`. Não converter essa data em outro dia por tratar meia-noite UTC
como horário local. “Hoje” e os limites correntes são calculados no servidor em
America/Sao_Paulo, explicitado na tela. Semana: segunda inclusive até a próxima
segunda exclusiva; mês: primeiro dia inclusive até o próximo mês exclusivo.
Filtros informados como datas inicial/final incluem ambos os dias.

Essa convenção vale para os painéis institucionais inclusive se uma unidade tiver
outro fuso configurado. A janela de edição e a validação de data do atendimento
continuam usando o fuso salvo no registro, conforme Fase 3.

Cada resposta usa a mesma referência de horário e uma visão consistente do banco
para contagens relacionadas. Exibir período, escopo e momento da atualização.
Reconsultar após criar, corrigir, classificar parecer ou cancelar; não misturar
respostas antigas com filtros novos. Cache, se houver, deve incluir usuário,
permissões e filtros; nunca compartilhar resposta individual entre contas.

| Indicador | Definição |
| --- | --- |
| Total de atendimentos | Quantidade de registros ativos no período e escopo; cada atendimento conta uma vez |
| Orientações | Subconjunto ativo com código GUIDANCE; incluído no total |
| Demais atendimentos | Total menos orientações |
| Cancelados | Quantidade cancelada pela data original do atendimento; exibida à parte, sem entrar no total |
| Com parecer / sem parecer / aguardando classificação | Partição dos ativos por WITH / WITHOUT / PENDING; a soma deve ser igual ao total |
| Unidades ativas | Quantidade administrativa de unidades ativas; não varia com o período dos atendimentos |
| Últimos atendimentos | Dez registros ativos visíveis, ordenados por serviceDate, createdAt e id decrescentes |
| Consolidado mensal | Mesmos critérios, agrupados pelo mês da data do atendimento; sem depender de fechamento |

Orientação e inclusão permanecem sem parecer. “Aguardando classificação” não é
sinônimo de pendência da gestão. Um atendimento com vários benefícios conta
uma vez; junções não podem multiplicar o total. Os números representam
atendimentos, não pessoas/famílias únicas, concessões de benefício ou RMA oficial.

### Possíveis duplicidades

Preservar a regra atual: grupo de registros ativos com mesmo dono, CPF e data,
dentro do período e escopo consultados, com tamanho maior que um.
Apresentar dois valores claramente rotulados: grupos e registros envolvidos.
Exemplo: três registros da mesma chave significam um grupo e três registros
envolvidos. Confirmação do operador permite registrar; não remove o grupo nem
declara fraude, erro ou necessidade de exclusão.

Não deduplicar o total principal. Não ampliar a chave para comparar CPFs entre
operadores. Direção pode consultar os registros desses grupos; entrevistador
somente os próprios. Ao filtrar uma unidade, recalcular sobre seus registros;
a contagem de grupos não é aditiva entre unidades e isso deve ser documentado.
Cancelamento ou correção pode dissolver um grupo sem apagar o histórico.

### Exemplo de reconciliação

Oito ativos: três orientações, dois com parecer, cinco sem parecer e um aguardando
classificação. Mais dois cancelados. Resultado: total 8, orientações 3, demais 5,
pareceres 2 + 5 + 1 = 8, cancelados 2. Se dois dos ativos formarem uma chave
repetida, mostrar um grupo e dois registros envolvidos; total continua 8.

## 4. Telas e acesso

| Operação | Entrevistador | Encaminhador | Direção |
| --- | --- | --- | --- |
| Indicadores individuais e últimos atendimentos | Somente próprios, inclusive histórico de outras unidades | Sem acesso | Consulta global e por operador |
| Total da unidade | Somente total agregado da unidade operacional autorizada | Sem acesso nesta fase | Todas as unidades e filtros combinados |
| Dados individuais de colegas | Bloqueados | Bloqueados | Consulta autorizada |
| Gestão de benefícios e tipos | Sem acesso administrativo | Sem acesso | Criar benefícios; editar/inativar benefícios e tipos |
| Seleção de benefícios no atendimento | Próprios registros dentro da janela vigente | Bloqueada | Correção global, sem criar em nome de terceiros |
| Escolher unidade operacional | Entre principal e adicionais autorizadas e ativas | Não concede acesso a atendimentos | Define padrão e vínculos pela gestão de usuários |

Dashboard do Entrevistador: cards próprios hoje/semana/mês, resumo da semana,
orientações, pareceres, últimos atendimentos e botão “Novo atendimento”.
O total da unidade deve estar separado e rotulado; não oferecer ranking,
identificação, lista ou detalhamento por colega nesse bloco.
Trocar a unidade operacional muda esse agregado e o padrão do novo atendimento,
mas não transfere propriedade nem apaga a consulta do histórico próprio.

Dashboard da Direção: totais globais e filtros por período, unidade e operador,
resumo por unidade/operador, distribuição por tipo/parecer e duplicidades.
Agrupar por IDs estáveis; alterações cadastrais não transferem registros antigos.
Detalhes históricos mostram os dados preservados na época do registro.
Filtros administrativos devem incluir referências inativas com histórico.
Resultados extensos devem ser paginados, sem corte silencioso de totais.

A API deve aplicar o escopo antes de consultar/agregar. Não carregar dados de
colegas no cliente para depois escondê-los. Filtros ou IDs forjados devem ser
recusados; o acesso ao próprio histórico não depende de ainda ter vínculo com
a unidade antiga. Acesso agregado a essa unidade antiga exige vínculo atual.

## 5. Benefícios — CFG-01

Direção pode criar, renomear, ativar/inativar e consultar histórico de benefícios.
Nome obrigatório, normalizado e único sem distinguir caixa; identificador
imutável, sem exclusão física. Mudanças exigem auditoria com autor/data e
valores anteriores/novos, na mesma transação.

Atendimento permite zero ou vários benefícios ativos, sem repetir IDs.
O campo representa benefícios informados no atendimento: não certifica
recebimento, elegibilidade, habilitação, concessão ou consulta governamental.
Lista vazia significa “não informado”, não “família sem benefícios”.
Não inferir benefícios pelo tipo (inclusive tipos BF/BPC), renda ou CPF.

Guardar identificação e nome histórico no vínculo com o atendimento.
Renomear/inativar um benefício não altera silenciosamente registros anteriores.
Benefício inativo já associado pode ser preservado ou removido numa correção
permitida, mas não adicionado a outro registro. O servidor revalida atividades,
vínculos e versão na gravação; conflito concorrente não produz atualização parcial.
Reaproveitar dados não seleciona automaticamente os benefícios de outro atendimento.

Para registros anteriores à Fase 4, manter lista vazia identificada como não
informada; não fazer atribuição retroativa por heurística.
O tratamento de CPF/RF/RL, parecer definitivo e cancelamento permanece intacto.

## 6. Tipos de atendimento — CFG-02

Preservar os sete códigos AttendanceKind e suas regras. Criar configuração de
nome exibido e ativo/inativo por código, inicializada com os nomes atuais.
Direção pode renomear e ativar/inativar; não pode criar/excluir códigos nem
editar requisitos de código familiar ou parecer pela interface.

Manter rótulos não vazios e únicos sem distinguir caixa. Explicar na gestão que
renomear altera a apresentação, não a regra do tipo; exibir sua regra junto ao nome.
Impedir a inativação do último tipo ativo e auditar alterações administrativas.

Novos atendimentos oferecem somente tipos ativos. Um tipo inativo já usado
continua legível no histórico e pode ser mantido ao corrigir outro campo;
não pode ser escolhido como novo tipo numa criação ou troca.
Mudança de tipo deve continuar respeitando a classificação definitiva do parecer.

Preservar o nome do tipo na época de cada registro. Renomear a configuração não
reescreve esse nome. Na mudança permitida de código de um atendimento, salvar o
nome corrente do novo código e auditar ambos os valores. Correção de outros
campos mantém o nome histórico. Filtros agregam pelo código, não pelo rótulo.
Migração dos registros anteriores usa o mapeamento conhecido dos sete tipos,
sem atribuir nomes que só passaram a existir depois.

## 7. Local de atendimento — CFG-03

A coordenação usa o perfil Direção existente, sem criar um quarto perfil.
Ela define unidade principal/padrão e vínculos adicionais na gestão de usuários.

Fluxo:
1. Primeiro acesso: a unidade principal ativa vem selecionada.
2. Operador pode escolher outra unidade ativa previamente autorizada.
3. Escolha fica persistida por usuário como preferência operacional; os próximos
   formulários e novos logins a reutilizam enquanto ela continuar válida.
4. A unidade aparece na topbar e no formulário antes de salvar.
5. Alterar a unidade principal pela Direção redefine a preferência para o novo
   padrão. Revogar vínculo/inativar unidade invalida sua seleção; usar a principal
   ativa, com aviso. Se não houver unidade permitida, impedir novo lançamento e
   orientar regularização pela Direção.

Unidade operacional não modifica o cadastro administrativo nem cria autorização.
Um formulário já aberto mantém a unidade que mostra. Troca em outra aba/dispositivo
não pode fazer o servidor salvar silenciosamente em outra unidade: enviar o ID
exibido e revalidá-lo transacionalmente, ou recusar contexto desatualizado.
Guardar operador autenticado, ID/nome/código/fuso da unidade realmente selecionada.
O cliente nunca define dono, perfil ou identificação institucional.

A alteração em relação à Fase 3 é aceitar uma unidade solicitada e autorizá-la
no servidor; não confiar livremente em IDs do cliente. Verificar principal ou
UserUnitAccess, unidade ativa e ator atual, inclusive se o vínculo for revogado
entre abrir e salvar. Não ampliar globalmente todas as ações de permissão para
todas as unidades: distinguir criação, agregado e histórico próprio.

Atendimentos salvos mantêm unidade/fuso originais, inclusive depois de troca de
preferência ou de lotação. Unidade não pode ser editada no registro existente.
Correção de local segue cancelamento e novo registro dentro das permissões vigentes.
Auditar mudança de preferência e atribuições administrativas, sem registrar tokens.

## 8. Implementação prevista e compatibilidade

Arquivos examinados: prisma/schema.prisma, módulos de atendimentos e permissões,
especificações anteriores, STATUS e ROADMAP. A base tem Attendance com data civil,
identificação histórica, versão e índices por dono/unidade/data, UserUnitAccess
administrativo e regras de autorização centralizadas.

Ordem sugerida para implementação:
1. Migrations aditivas de benefícios/vínculos, configuração dos sete tipos,
   nome histórico e preferência de unidade; seed idempotente e backfill explícito.
2. Serviços administrativos auditados e unidade operacional com revalidação.
3. Integração de benefícios/tipos/unidade no atendimento e preservação de histórico.
4. Consultas agregadas e dashboards usando o mesmo filtro da lista operacional.
5. Regressão, testes de concorrência/permissão, inspeção visual e documentação.

Nomes finais de entidades/endpoints são decisões de implementação. Não remover
constraints/triggers da Fase 3 para facilitar alterações. Fazer migração em base
limpa e em base já preenchida, demonstrando preservação de identificação,
pareceres, cancelamentos e auditoria. Atualizar também serializers/contracts,
formulários, opções e testes afetados; não confiar apenas no schema Prisma.

Agregações devem acontecer no banco, com consultas parametrizadas e filtros
indexáveis; não carregar toda a base no navegador. Usar cardinalidade de
Attendance para evitar duplicação por benefícios. Avaliar plano de execução e
volume sintético antes de adicionar índices. Não introduzir cache compartilhado,
serviço externo ou alteração da trava global sem medição que justifique.

## 9. Critérios de aceite e evidências

Os critérios abaixo exigem evidências próprias; os testes das Fases 1–3
não comprovam isoladamente o funcionamento da Fase 4.

| Critério | IDs | Evidência exigida |
| --- | --- | --- |
| Contagens reconciliam com registros ativos, orientação, cancelados e três estados de parecer | IND-01, IND-03 | Fixture com resultados exatos, incluindo o exemplo desta especificação |
| Datas civil/UTC, virada de dia, segunda-feira, mês e ano funcionam | IND-01, IND-03 | Relógio controlado e casos de fronteira no fuso institucional |
| Benefícios múltiplos não multiplicam contagens | CFG-01, IND-01 | Mesmo total antes/depois de associar múltiplos benefícios |
| Escopo próprio, agregado de unidade e filtros da Direção permanecem distintos | IND-02 | Testes com dois operadores, duas unidades e requisições forjadas |
| Duplicidades contam grupos/registros sem excluir atendimentos legítimos | IND-03 | Chaves iguais, operadores distintos, cancelamento e filtro por unidade |
| Benefícios são geridos somente pela Direção, sem apagar histórico | CFG-01 | Criar, renomear, inativar, conservar/remover vínculo antigo, bloquear novo vínculo inativo |
| Tipos mantêm códigos/regras após renomear ou inativar | CFG-02 | Histórico antigo, novos nomes, último ativo, parecer definitivo e orientação |
| Local padrão e última escolha aparecem em cada novo atendimento | CFG-03 | Primeiro acesso, troca autorizada, reload, novo login e redefinição pela Direção |
| Revogação e concorrência não permitem salvar em local indevido | CFG-03, QUA-01 | Duas abas e vínculo alterado entre abertura e envio; sem troca silenciosa |
| Histórico próprio sobrevive à mudança de lotação | CFG-03, IND-02 | Leitura própria permitida; agregado antigo e dados de colegas negados |
| Alterações são atômicas, auditadas e recusam versão antiga | CFG-01–03, QUA-01 | Integração PostgreSQL e conflitos concorrentes |
| Módulos futuros exibem indisponibilidade | IND-01, QUA-01 | Inspeção dos três dashboards, sem zeros simulados |
| Desktop/mobile, teclado, foco, temas e estados de erro funcionam | QUA-01 | Playwright e inspeção de capturas |
| Migração limpa e sobre base anterior preservam dados | CFG-01–03, QUA-01 | PostgreSQL real com dados fictícios e seed repetido |
| Fases 1–3 não regridem e check obrigatório aprova | QUA-01 | Lint, TypeScript, backend, supervisor, build e navegador no head entregue |

Ao entregar código: relacionar IDs ao PR, commit, run e evidências em STATUS;
atualizar a matriz do ROADMAP apenas com o que estiver efetivamente validado.
A documentação desta etapa não libera produção nem implementa Fases 5–9.


## 10. Decisão de compatibilidade da implementação

O backfill do nome histórico é lógico: `kindName = NULL` em registros anteriores
representa o rótulo original fixo de seu código, resolvido pelo contrato existente,
jamais o rótulo atual do catálogo. Novos registros salvam o nome corrente e uma
mudança de código salva o novo nome. Essa solução evita alterar linhas canceladas
imutáveis ou suspender seus triggers. O teste de migração compara integralmente
os campos anteriores e a auditoria antes/depois. Benefícios não são inferidos.
