# CadFlux V1.1 — fases e requisitos pendentes

Atualizado em 23/10/2026 (America/Sao_Paulo), por solicitação de Roberto para
vincular os requisitos pendentes a uma fase. Este documento organiza o backlog;
não declara módulos futuros implementados nem autoriza seu desenvolvimento.

## Referências e estado atual

- [Especificação original](FASE-1-ESPECIFICACAO.txt), especialmente itens 5,
  12, 17, 30–34, 45 e 46.
- [Fase 2](FASE-2-ESPECIFICACAO.md), [Fase 3](FASE-3-ESPECIFICACAO.md) e
  [estado e evidências](STATUS.md).
- Decisões de produto fornecidas por Roberto: quatro frentes da V1.1,
  pendências automáticas e da gestão, benefícios selecionáveis, fechamento e
  reabertura, documentos padronizados e encaminhamentos com relatório próprio.
- As alocações abaixo são a consolidação de planejamento feita em 23/10.
  Detalhes ainda contraditórios ou sem especificação estão identificados como
  decisões de aceite, em vez de se tornarem regras silenciosas no código.

As Fases 1–3 estão integradas à main; a Fase 4 está validada no PR #11.
A base da revisão inicial deste roadmap foi `35aab49`, com
[validação em nuvem aprovada](https://github.com/rrabts/CadFlux/actions/runs/39780049860).
Existem exatamente Entrevistador, Encaminhador e Direção. O CadFlux apoia a
gestão interna e não substitui aplicações oficiais governamentais.

## Sequência preservada

| Fase | Entrega | Situação |
| --- | --- | --- |
| 1 | Fundação, acesso, usuários, importação e auditoria | Integrada; preservar regressão |
| 2 | Unidades, categorias e vínculos administrativos | Integrada; preservar regressão |
| 3 | Registro, consulta e correção de atendimentos | Integrada; preservar regressão |
| 4 | Indicadores e complementos de configuração operacional | Implementada e validada; [PR #11](https://github.com/rrabts/CadFlux/pull/11) e [evidências](FASE-4-VALIDACAO.md) |
| 5 | Consulta oficial de CPF | Planejada; depende de acesso oficial autorizado |
| 6 | Pendências e fechamento semanal | Planejada; pendências precedem o fechamento |
| 7 | Documentos oficiais | Planejada; depende do fechamento e do modelo aprovado |
| 8 | Encaminhamentos e seus relatórios | Planejada; indicadores próprios completados nesta fase |
| 9 | Segurança operacional, backup, monitoramento e preparação para produção | Planejada; publicação exige autorização específica |

Não se renumeram as fases. A consulta oficial de CPF não é dependência técnica
dos fechamentos e documentos: preservar o registro com validação estrutural
existente. Se a integração externa estiver indisponível, registrar o bloqueio e
obter autorização de sequência antes de avançar às fases seguintes. Nunca simular
uma consulta oficial. Segurança, permissões e auditoria continuam obrigatórias
em todas as fases; a Fase 9 complementa essas proteções.

## Matriz de requisitos pendentes

IND-01–03 e CFG-01–03 estão implementados e validados; QUA-01 acompanha esta
entrega e continua transversal. Os demais itens abaixo permanecem planejados. Cada ID deve constar na futura especificação, no PR e na
evidência de validação correspondente.

| ID | Requisito e situação atual | Fase responsável | Critério de conclusão |
| --- | --- | --- | --- |
| IND-01 | Cards hoje/semana/mês, resumo da semana e últimos atendimentos; implementados e validados | 4 | Contagens reproduzíveis a partir dos registros, com fuso e definição documentada de ativos/cancelados, orientação e parecer pendente |
| IND-02 | Direção: visão geral, por unidade e por operador; entrevistador: próprios números e total agregado permitido da unidade | 4 | Filtros e totais conferidos; nenhum dado individual de colegas exposto ao operador |
| IND-03 | Consolidado mensal, pareceres e duplicidades | 4 | Fórmulas, períodos e definição de duplicidade documentados; totais reconciliados com a lista operacional |
| IND-04 | Cards e filtros de pendências, semanas abertas e correções pós-fechamento | 6 | Indicadores passam a usar entidades reais da Fase 6; antes disso mostrar indisponibilidade, sem simular zero |
| IND-05 | Números e últimos encaminhamentos | 8 | Painel do Encaminhador usa somente seus registros; Direção tem consulta autorizada; não mistura balanço de atendimentos |
| CFG-01 | Cadastro de benefícios pela Direção e seleção múltipla no atendimento | 4 | Criar/inativar benefícios sem perder histórico; vínculos auditados; guardar seleção sem inferir concessão ou habilitação oficial |
| CFG-02 | Área de tipos de atendimento; sete códigos fixos com nomes/disponibilidade configuráveis | 4 | Definir edição permitida antes de implementar; preservar códigos históricos e regras de código familiar/parecer; não admitir tipo novo sem regras explícitas |
| CFG-03 | Operação em unidades adicionais; seleção persistida implementada e validada | 4 | Seleção apenas entre unidades autorizadas e ativas, validada no servidor; preservar unidade de cada registro e isolamento entre operadores |
| CPF-01 | Integração oficial para verificar CPF | 5 | Provedor, autorização de acesso, finalidade, custos e limites definidos; testes de sucesso, indisponibilidade e resposta inválida; sem credenciais no Git |
| CPF-02 | Nome oficial divergente e origem da consulta | 5 | Aplicar nome oficial ao formulário conforme decisão do produto, com aviso e auditoria; não reescrever atendimentos anteriores silenciosamente |
| CPF-03 | CPF aguardando verificação ou conflito documental | 5, integração na 6 | Representar indisponibilidade sem falso sucesso; vincular ao fluxo de pendências quando existir; critério de bloqueio explicitado |
| PEN-01 | Pendências automáticas; hoje existem validações e parecer aguardando classificação | 6, antes do fechamento | Detectar inconsistências persistentes sem criar registros inválidos que o servidor já rejeita; critérios de abertura/resolução e duplicidade documentados |
| PEN-02 | Pendências manuais da gestão | 6, antes do fechamento | Direção registra motivo, descrição e correção; operador responsável corrige; Direção confirma resolução das pendências que criou |
| PEN-03 | Estados Aberta → Em correção → Enviada para revisão → Resolvida e níveis informativa/correção/bloqueante | 6 | Transições e permissões testadas; níveis afetam fechamento conforme regra expressa; orientação sem código permanece válida |
| PEN-04 | Minhas pendências, visão da Direção e histórico | 6 | Filtros por operador/unidade/período; autor, data, valores anteriores/novos; isolamento de acesso e auditoria preservados |
| FEC-01 | Semana atual, conferência e identificação de dias sem atendimento | 6 | Período e fuso explícitos; permitir dia vazio com indicação; somente atendidos entram no balanço |
| FEC-02 | Impedir fechamento inconsistente | 6 | Mensagens identificam registros impeditivos; parecer aguardando decisão recebe tratamento definido; duplicidade confirmada não vira bloqueio automático sem regra |
| FEC-03 | Fechamento definitivo e histórico | 6 | Consolidação atômica, sem fechamento duplicado sob concorrência; registros e versão do fechamento rastreáveis |
| FEC-04 | Janela de correção e reabertura pela Direção | 6 | Prazo aprovado/configurado, motivo e auditoria; novo fechamento substitui o vigente mantendo rastreabilidade da versão anterior |
| FEC-05 | Duplicidades entre listas com/sem parecer | 6 | Regra de consolidação aprovada e testada; prioridade à lista com parecer quando aplicável, sem apagar atendimentos legítimos |
| FEC-06 | Semana atravessando mês e consolidado mensal | 6 | Regra de competência definida; totais mensais reconciliados sem duplicar registros entre fechamentos |
| DOC-01 | Modelo institucional e campos de identificação | 7 | Modelo anexado/aprovado pela coordenação; timbre e campos data, RF/RL, CPF, código familiar, CRAS, entrevistador e matrícula conferidos |
| DOC-02 | CADASTROS ONLINE sem parecer e com parecer, PDF/DOCX | 7 | Arquivos reproduzem o fechamento vigente e a ordem aprovada; layout inspecionado; política de excesso de linhas definida sem cortar nomes ou dados |
| DOC-03 | Documentos gerados, regeneração e vínculo ao fechamento | 7 | Download autorizado, versão identificável e documento antigo distinguível após reabertura; somente o fechamento vigente alimenta a entrega atual |
| ENC-01 | Registro e consulta de encaminhamentos | 8 | Nome, NIS, CPF, endereço, tipo, número de pessoas, renda per capita, data e responsável, com obrigatoriedade definida na especificação |
| ENC-02 | Canhoto físico e relatório próprio | 8 | Processo de conferência com canhoto documentado; encaminhamentos não entram no balanço semanal/mensal de atendimentos |
| ENC-03 | Permissões, correção, cancelamento e pendências de encaminhamentos | 8 | Encaminhador restrito aos próprios registros; Direção conforme matriz; histórico preservado; participação do Entrevistador explicitada antes da implementação |
| SEG-01 | MFA completo e obrigatório para Direção | 9, antes de produção | Ativação, verificação e recuperação testadas; estrutura preparada hoje não conta como MFA funcional |
| SEG-02 | Recuperação de senha e entrega externa segura | 9, antes de produção | Envio pelo canal aprovado, tokens de uso único com expiração, revogação e testes; sem divulgação de contas existentes |
| SEG-03 | Credenciais de produção e proteção de dados | 9, antes de produção | Remover dependência de contas demo; HTTPS, segredos externos, acesso mínimo ao banco e revisão de dados em logs/auditoria |
| OPS-01 | Backup e restauração | 9, antes de produção | Frequência, retenção, responsáveis e objetivos de recuperação definidos; restauração efetivamente testada |
| OPS-02 | Monitoramento, tratamento de incidentes e manutenção | 9 | Alertas operacionais, procedimento de resposta e retenção/limpeza de sessões e lotes temporários; sem apagar histórico obrigatório |
| OPS-03 | Capacidade e concorrência | 9, antecipar medição antes de piloto | Medir importação junto a gravações concorrentes; avaliar a trava global; registrar volume, latência e erros antes de alterar a estratégia de bloqueio |
| OPS-04 | Hospedagem, piloto e liberação para uso real | 9 | Ambiente definido, homologação do fluxo completo, responsáveis e autorização específica de publicação; testes em nuvem não equivalem a aplicação hospedada |
| QUA-01 | Acessibilidade, mobile, autorização, auditoria e regressão | 4–9, em cada entrega | Manter cenários das fases anteriores e incluir evidência funcional/visual do módulo entregue; requisito transversal, não adiado para o final |

## Decisões que a especificação da fase deve resolver

1. **Fase 4:** decisões de orientação incluída/discriminada, tipos renomeáveis e
   local pré-selecionado foram fornecidas por Roberto em 23/10. Fórmulas,
   histórico, unidade autorizada e critérios estão em
   [FASE-4-ESPECIFICACAO.md](FASE-4-ESPECIFICACAO.md).
   IND-01–03, CFG-01–03 e a cobertura da fase de QUA-01 estão implementados e
   validados; não abrangem entregas futuras.
2. **Fase 5:** confirmar provedor e acesso oficial. O projeto não possui acesso
   SERPRO/Receita pelo simples fato de prever a integração.
3. **Fase 6:** conciliar a semana civil segunda–domingo da Fase 3 com a rotina
   de fechamento na sexta; definir corte, feriados e competência mensal.
4. **Fase 6:** consolidar a janela de ajustes: há referência de 24 horas e
   configuração de prazo pela coordenação. A especificação deve fixar o padrão,
   limites e permissões antes de programar. Não escolher silenciosamente um prazo.
5. **Fase 6:** definir a chave de deduplicação das listas e tratamento de
   atendimentos legítimos repetidos; substituição do fechamento vigente deve
   preservar auditoria, sem exclusão silenciosa do histórico.
6. **Fase 7:** obter o arquivo oficial do modelo e aprovar ordem, timbres,
   assinatura e paginação. A meta de uma página não autoriza truncar registros.
7. **Fase 8:** definir acesso do Entrevistador a encaminhamentos, obrigatoriedade
   dos campos e estados de acompanhamento. A Fase 3 não concede esse acesso.
8. **Fase 9:** aprovar hospedagem, custos, operação e responsabilidades antes do
   uso real. Esse marco não é uma autorização de contratação ou publicação.

## Itens fora da V1.1 operacional atual

Agenda completa/controle de faltas, cadastro separado de pessoas/famílias,
BI avançado, IA, WhatsApp, notificações externas gerais e aplicativo mobile
não são entregas autorizadas das Fases 4–9. A referência de 10 agendados e dois
encaminhamentos é contexto de rotina, não limite rígido já implementado.
Inclusão desses recursos exige decisão de escopo própria. A entrega externa
de recuperação de senha (SEG-02) é uma necessidade específica de autenticação.

## Controle de conclusão

Antes de cada fase: escrever especificação com IDs desta matriz, dependências,
decisões resolvidas e critérios testáveis. Ao entregar: registrar PR, commit,
execução aprovada e limitações em STATUS; atualizar o estado dos IDs. Não marcar
fase como concluída apenas pela existência de menus, tabelas ou testes antigos.

As pendências de governança de 23/10 (proteção da main e automação inválida)
são manutenção das Fases 1–3, descrita em [GOVERNANCA.md](GOVERNANCA.md), e não
devem aguardar a Fase 9.
