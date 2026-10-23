# Fase 4 — validação da implementação

Base: `cd0b31a` (especificação integrada no PR #10). Implementação autorizada por
Roberto com “Prossiga”. Estado inicial: aguardando execução integrada do head.

| Requisito | Implementação e evidência própria |
| --- | --- |
| IND-01, IND-03 | Agregações PostgreSQL com snapshot consistente; fixture exata 8 ativos/3 orientações/2 cancelados e partição 2+5+1; duplicidades sem deduplicar total |
| IND-01, IND-03 | Datas civis, viradas UTC/dia/semana/mês/ano e fevereiro bissexto; consolidado por mês da data de atendimento |
| IND-02 | Dois operadores, IDs forjados, agregado sem colegas identificados, Direção paginada com 51 grupos incluindo unidades históricas inativas |
| CFG-01 | Criação, rename, inativação, preservação/remoção de vínculo, novo vínculo inativo negado, auditoria e conflito concorrente |
| CFG-02 | Renomear/inativar sem alterar códigos/regras, histórico anterior, último tipo ativo protegido; regressão de parecer definitivo |
| CFG-03 | Preferência persistida, novo login, revogação entre abertura/envio, formulário de outra aba com unidade explícita, troca da principal e histórico próprio |
| QUA-01 | Rotas anônimas/Encaminhador/origem externa negadas; migration de base anterior com cancelado e auditoria preservados; regressão completa |

Testes: `tests/phase4.integration.test.ts`,
`tests/phase4-migration.integration.test.ts` e três cenários novos em `tests/ui.spec.ts`.
As suítes anteriores continuam obrigatórias. A migração da base preenchida acontece
num schema temporário transacional, integralmente revertido ao final, sem reset.

Capturas previstas no artefato do CI:
- `phase-4-benefits.png` e `phase-4-types.png`: gestão pela Direção.
- `phase-4-attendance.png`: unidade adicional e benefício no atendimento.
- `phase-4-dashboard-direction.png`: indicadores globais.
- `phase-4-dashboard-mobile.png`: indicadores próprios em viewport mobile.

TypeScript e lint passaram no executor local. O PostgreSQL exige usuário sem
privilégios e não iniciou aqui (executor root); banco/build/navegador dependem do
run do GitHub Actions. Não reutilizar evidência anterior para concluir esta fase.

Limites: dados fictícios, sem produção, concessão de benefício, CPF oficial,
fechamento, pendências da gestão ou encaminhamentos. `kindName` histórico nulo usa
mapa original fixo, sem reescrever registros cancelados. O benchmark sintético é
uma observação de consulta, não valida capacidade de produção ou carga concorrente.


## Execução inicial e ajustes

[Run 39965201444](https://github.com/rrabts/CadFlux/actions/runs/39965201444),
head `fe6e11c`: migrations/seed/idempotência, lint, TypeScript, 135 testes em dez
arquivos, três testes do supervisor e build aprovados. Os 17 cenários anteriores
passaram. O primeiro cenário novo parou no seletor exato “Nome”, que não considera
o marcador de campo obrigatório; corrigido para selecionar o rótulo completo.
Os dois cenários seguintes não rodaram devido à política de parar na primeira falha.
Essa execução não conclui a Fase 4; uma nova execução completa é necessária.

O plano sintético, em PostgreSQL 18.6, usou 8.002 registros distribuídos pelo ano,
684 no intervalo de outubro (683 ativos). Consultas de contagem global, por dono e
duplicidades levaram, respectivamente, 0,245 / 0,194 / 0,529 ms nesse runner e
usaram os índices existentes, sem escrita temporária em disco. Amostra única com
cache aquecido; não é latência de API nem demonstra capacidade de produção.
Não se adicionaram índices ou cache sem necessidade medida. Plano completo no
artefato `phase-4-query-plans.json`; evidências do workflow têm retenção de sete dias.


[Run 39966167373](https://github.com/rrabts/CadFlux/actions/runs/39966167373),
head `7ce32b3`: backend/build novamente aprovados; 19 cenários de navegador passaram,
incluindo catálogos, benefícios e troca de unidade entre abas. O último cenário
usou o cliente HTTP do Playwright e recebeu 401, enquanto o dashboard já estava
autenticado no navegador. A conferência passou a usar fetch no próprio navegador,
como os testes de autorização anteriores, preservando a política de cookies.
Não se alterou autenticação ou resposta esperada (200 para Direção, 403 para perfis
sem acesso). Nova execução completa necessária.


O run `39966900975` foi cancelado automaticamente ao receber os ajustes de layout
e de contexto legado de unidade, enquanto preparava o Chromium.
[Run 39968057689](https://github.com/rrabts/CadFlux/actions/runs/39968057689),
head `c9f365c`: 135 testes e 19 cenários aprovados; reconciliação da API concluída.
A verificação mobile ocorreu durante a transição de 180 ms da sidebar ao mudar
viewport. O teste agora aguarda a geometria estabilizar com expect.poll, mantendo
a exigência de largura sem transbordo. Capturas desativam animações transitórias.
Também se ajustaram padding dos cards, ações compactas do catálogo com nomes
acessíveis e bloqueio de formulário legado sem ID quando a preferência é adicional.
