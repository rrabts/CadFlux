# CadFlux V1.1 - Fase 2: usuários e unidades refinados

Autorização: Roberto solicitou avançar para a Fase 2 em 19/10/2026. A referência
de produto é a etapa "Usuários e unidades refinados" da especificação original.
Esta entrega parte do commit `09491ee` do PR #5, cuja Fase 1 foi validada na nuvem.
O PR #5 ainda estava aberto no início desta etapa.

## Escopo da entrega

1. Direção cria, consulta, pesquisa, pagina, edita, ativa e inativa unidades e
   categorias profissionais. Não há exclusão física.
2. Unidades têm nome, código único normalizado, fuso horário válido e status.
   Categorias têm nome único e status; continuam independentes dos três perfis.
3. Alterações mantêm histórico somente de leitura, com responsável, data e valores.
4. Direção atribui/remove até 20 unidades adicionais de um usuário. A unidade
   principal não pode constar também como adicional. Vínculos repetidos, ausentes
   ou novos vínculos a unidades inativas são rejeitados no servidor.
5. Unidade/categoria com usuário ativo vinculado não pode ser inativada.
   Unidades adicionais também contam para esse bloqueio. Usuários inativos
   preservam vínculos históricos, mas precisam de referências ativas para reativar.
6. Mudanças de perfil, status, unidade principal ou adicionais revogam sessões.
   Clientes que não enviam o campo de unidades adicionais preservam esses vínculos.
7. Mutações administrativas revalidam o ator no banco e compartilham lock e
   transação serializável, protegendo as invariantes sob concorrência.
8. Somente Direção mantém esses cadastros; operadores recebem bloqueio nas páginas
   e APIs. Não existe novo perfil de usuário.

As unidades adicionais são vínculos administrativos nesta fase. Não há troca da
unidade de operação nem ampliação da visibilidade individual dos operadores;
regras operacionais continuam para os módulos posteriores. Importação CSV/XLSX
mantém suas oito colunas e não inclui unidades adicionais ou senhas.

## Critérios de aceite

- Fluxos de criação/edição e ativação/inativação funcionam no navegador.
- Permissões e validações são aplicadas nas APIs e serviços transacionais.
- Duplicidades por caixa são impedidas no banco e recebem erro textual na API.
- Fuso inválido, vínculo inválido, autoelevação e inativação indevida são recusados.
- Auditoria acompanha alterações e não pode ser editada/excluída.
- Vínculos adicionais persistem, podem ser removidos e revogam sessões.
- Banco limpo recebe as duas migrations e o seed permanece idempotente.
- Lint, TypeScript, testes existentes e novos, build e navegador passam na nuvem.
- Revisão visual de unidades, vínculos e categoria mobile não apresenta defeitos.

## Fora do escopo

Atendimentos reais, CPF oficial, famílias, encaminhamentos, fechamento, documentos
oficiais e indicadores. MFA e recuperação externa permanecem preparados para
integração futura. Não publicar produção nem usar dados reais nesta entrega.

## Migration

`20261019170000_reference_integrity` adiciona índices únicos por nome de categoria
e código de unidade, ignorando caixa e espaços nas bordas. A migration não apaga
nem mescla registros; uma base com duplicidades precisa ser corrigida antes de
aplicá-la. `UserUnitAccess` já existe desde a fundação, sem mudança de modelagem.
