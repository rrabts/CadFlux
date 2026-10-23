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
