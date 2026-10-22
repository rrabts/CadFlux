# CadFlux V1.1 - validação da Fase 2

Entrega: [PR #6](https://github.com/rrabts/CadFlux/pull/6). A descrição desse PR
registra o commit final, o run aprovado, os resultados e a revisão visual. Os
resultados se aplicam ao commit executado. Os PRs #5 e #6 foram incorporados à
main em 19/10/2026, nessa ordem, preservando os commits. O merge `22f9cf6` tem
árvore idêntica ao commit `88dab75`, aprovado novamente na tentativa 2 do
[run 39317114075](https://github.com/rrabts/CadFlux/actions/runs/39317114075/attempts/2).
A validação pós-integração está no
[run 39319811057](https://github.com/rrabts/CadFlux/actions/runs/39319811057).
Consultar o resultado e o commit ao reutilizar a evidência. A base da Fase 2 é
`09491ee` da Fase 1 validada no PR #5.

## Ambiente e método

Validação em GitHub Actions: Ubuntu 24.04, Node 24.19.0, pnpm 10.28.2,
PostgreSQL 18 e Chromium. Bancos fictícios distintos de desenvolvimento e testes.
As migrations partem de schemas vazios; o seed é executado duas vezes e comparado
por resumo SHA-256 dos registros, antes dos testes de integração.

O executor remoto restrito do chat é usado para revisão, lint, TypeScript e testes
unitários. O build, o banco e o navegador são verificados no runner do GitHub.
Não se usa Windows como substituto nem mocks de banco para declarar aprovação.

## Cobertura da entrega

| Área                  | Evidência exigida                                                                   |
| --------------------- | ----------------------------------------------------------------------------------- |
| Permissões            | Sem sessão: 401; os dois operadores: 403 nas APIs administrativas                   |
| Integridade de acesso | Ator relido no banco; perfil forjado e origem externa recusados                     |
| Cadastros             | Criar, editar, inativar/reativar unidades e categorias; histórico com autor         |
| Validação             | Código, nome e fuso; unicidade por caixa também no PostgreSQL                       |
| Vínculos              | Adicionar/remover; rejeitar IDs ausentes, inativos, repetidos ou iguais à principal |
| Histórico inativo     | Preservar referências antigas; impedir reativação até regularização                 |
| Sessões               | Alterar vínculo adicional revoga sessão anterior                                    |
| Concorrência          | Atribuir unidade e inativá-la simultaneamente não viola a regra de usuário ativo    |
| Paginação             | Filtro e segunda página de conjunto com mais de 50 unidades                         |
| Navegador             | Manutenção de unidade, vínculo adicional com bloqueio e categoria no mobile         |
| Regressão             | Autenticação, gestão, importação, auditoria, temas e teclado da Fase 1              |
| Encerramento          | Servidor de teste encerra sem intervenção; porta 3100 livre                         |

São 94 testes de backend (os 85 anteriores e nove novos de integração) e 13
cenários de navegador (os dez anteriores e três novos). O número executado e a
aprovação devem ser conferidos no run final referenciado no PR.

## Histórico de verificação e correções

O [run inicial 39315390659](https://github.com/rrabts/CadFlux/actions/runs/39315390659),
commit `75841e3`, aprovou migration, seed idempotente, lint, TypeScript, 94 testes e
build. Os dez cenários de navegador anteriores passaram, mas os três novos
expiraram ao localizar `Nome` por texto exato: o rótulo contém também o marcador
de campo obrigatório. Os seletores foram corrigidos para considerar esse rótulo;
os campos obrigatórios e as verificações de resultado foram mantidos.

Na segunda execução, a manutenção completa de unidades passou. O teste de vínculo
alcançou o bloqueio esperado, mas seu seletor genérico de alerta encontrou também
o anunciador de navegação do framework. A verificação foi direcionada à mensagem
específica do bloqueio, preservando a exigência de erro textual ao usuário.

A revisão também limitou a altura da lista de unidades adicionais com rolagem,
preservando o acesso por teclado; ajustou o pattern do código para o formato HTML;
e fez a listagem voltar à última página válida quando a página atual fica vazia.
O runner interrompe a suíte de navegador na primeira falha para fornecer um
diagnóstico mais rápido. Em uma execução aprovada, todos os 13 cenários rodam.

## Evidências visuais

O artifact `cadflux-browser-evidence` de cada run guarda relatório e capturas,
incluindo `phase-2-units.png`, `phase-2-user-units.png` e
`phase-2-categories-mobile.png`. Retenção de sete dias. A revisão da execução final
é registrada no PR, junto ao endereço do artifact correspondente.

## Limites

Sem atendimentos, encaminhamentos, fechamento, documentos oficiais, consulta CPF
ou publicação de produção. Os três perfis permanecem iguais. Vínculos adicionais
são administrativos, sem seletor de unidade de operação nesta etapa. MFA e
recuperação externa permanecem para integração posterior.

A migration de unicidade não mescla dados; bases existentes com nomes de categoria
ou códigos de unidade duplicados por caixa precisam de correção antes de aplicá-la.
Não houve uso de dados reais nem alteração de visibilidade do repositório.
