# Validação da Fase 1 em nuvem - 19/10/2026

## Resultado

O primeiro run completo no GitHub Actions passou: PostgreSQL real, schemas
inicialmente vazios, migrations e seed em dois bancos separados, repetição
idempotente, lint, TypeScript, 85 testes, build e dez cenários de navegador.
O servidor de teste encerrou automaticamente, com a porta 3100 livre no final.

- PR de retomada: <https://github.com/rrabts/CadFlux/pull/5>.
- Run inicial aprovado: <https://github.com/rrabts/CadFlux/actions/runs/39302409739>.
- Commit desse run: `35557320fb8dfc1f0ad3a9fef7eda4a38a82bb06`.
- Base da main: `507ace8ff727da5d83b50d4eec2dc132cc680a8b`.
- Branch: `codex/phase-1-cloud-2026-10-19`.
- O PR registra também o resultado da execução mais recente após o refinamento
  das capturas. As mudanças desta retomada ainda dependem da incorporação do PR.

Não houve implantação de produção, contratação de serviço, uso de dados reais ou
implementação de módulos operacionais de fases posteriores.

## Ambiente e separação dos executores

A aplicação foi testada no runner GitHub-hosted Ubuntu 24.04, com Node 24.19.0,
pnpm 10.28.2, PostgreSQL 18 (18.6 no log do primeiro run), Prisma 6.19.3 e Chromium.
O lockfile foi preservado. A conexão e os bancos são descartáveis e fictícios.

O checkout e a revisão de arquivos aconteceram no Linux remoto deste chat, em
`/workspace/scratch/5da3d277ba04/CadFlux`. Nesse executor restrito,
`process.memoryUsage()` ainda falhou com `uv_resident_set_memory`, sem carregar a
aplicação. Não há PostgreSQL/Docker no PATH nem URLs externas de banco configuradas.
Portanto, a execução completa foi feita no runner do GitHub, não no Windows nem
no executor restrito. Nenhuma chamada do Node foi substituída para simular aprovação.

A instalação com `CI=true npm exec --yes --package=pnpm@10.28.2 -- pnpm install
--frozen-lockfile` também concluiu no executor restrito, onde lint, TypeScript,
schema Prisma e 62 testes unitários passaram. Essas verificações adicionais não
substituem nem se somam às contagens do run completo.

## Evidências do primeiro run

| Etapa          | Resultado                                                                       |
| -------------- | ------------------------------------------------------------------------------- |
| Runtime        | Node iniciou e `process.memoryUsage()` funcionou no runner                      |
| Instalação     | `pnpm install --frozen-lockfile` aprovado                                       |
| Bancos limpos  | Zero tabelas no schema public de cadflux e cadflux_test                         |
| Schema         | `pnpm exec prisma validate` aprovado                                            |
| Migration/seed | `pnpm db:setup --all` aprovado nos dois bancos                                  |
| Conferência    | 11 tabelas, migration concluída, 3 usuários, 2 unidades, 4 categorias por banco |
| Idempotência   | Setup repetido; resumos SHA-256 dos registros preservados integralmente         |
| Lint           | `pnpm lint` aprovado, sem avisos de lint                                        |
| TypeScript     | `pnpm typecheck` aprovado                                                       |
| Backend        | `pnpm test`: 85 testes aprovados em cinco arquivos                              |
| Build          | `pnpm build` aprovado; rotas geradas                                            |
| Navegador      | `pnpm test:e2e`: 10 cenários aprovados em 16,8 s                                |
| Encerramento   | Porta 3100 livre sem encerrar processo manualmente                              |
| Evidências     | Relatório e seis capturas publicados como artifact do run                       |

Os testes cobrem autenticação, autorização de APIs, três perfis, usuários,
importação CSV/XLSX, concorrência e confirmação única, auditoria e isolamento dos
bancos. Erros de unicidade, serialização e imutabilidade aparecem no log do banco
durante cenários negativos esperados; as suítes terminaram aprovadas.

## Capturas e revisão visual

O artifact `phase-1-browser-evidence` contém dashboards claro/escuro, navegação
desktop e mobile e listagem paginada. Retenção: sete dias; os logs do run registram
os resultados e as identidades de execução.

A primeira revisão encontrou capturas feitas durante a transição da sidebar,
mostrando menus parcialmente abertos. A captura em `tests/ui.spec.ts` passou a usar
`animations: "disabled"`, que conclui transições finitas antes de fotografar a
tela. O comportamento de animação da aplicação permanece igual. A execução mais
recente e a revisão das capturas finais são registradas no PR #5.

## Matriz dos 20 critérios no ambiente de nuvem

| Critério                      | Evidência no runner                                           |
| ----------------------------- | ------------------------------------------------------------- |
| 1. Aplicação executa          | Build e servidor de produção acessado pelo Playwright         |
| 2. Banco configurado          | PostgreSQL real, dois bancos separados                        |
| 3. Migrations funcionam       | Aplicadas aos dois schemas inicialmente vazios                |
| 4. Seed funciona              | Contagens e comparação integral antes/depois do segundo setup |
| 5. Login funciona             | Integração e cenários de navegador                            |
| 6. Logout funciona            | Integração e cenários por perfil                              |
| 7. Rotas protegidas           | API sem sessão, páginas privadas e perfis sem permissão       |
| 8. Três perfis existem        | Seed conferido e login dos três perfis                        |
| 9. Menus por perfil           | Cenários de Direção, Entrevistador e Encaminhador             |
| 10. Autorização no backend    | Suítes de permissões, usuários e importação                   |
| 11. Claro/escuro              | Cenário de tema e capturas do dashboard                       |
| 12. Tema persiste             | Reload e preferência Sistema verificados                      |
| 13. Responsividade            | Viewport 390x844, largura e teclado; capturas mobile          |
| 14. Direção gerencia usuários | Criação, edição e alteração de vínculos no navegador/backend  |
| 15. Inativação funciona       | Login/sessão de inativo e fluxo administrativo                |
| 16. Histórico básico          | Consulta ao histórico após alterações                         |
| 17. Importação e prévia       | CSV/XLSX no backend e confirmação CSV no navegador            |
| 18. Auditoria registra ações  | Logs transacionais e triggers testados no PostgreSQL          |
| 19. Testes críticos passam    | 85 testes e 10 cenários, lint/TypeScript/build aprovados      |
| 20. README explica execução   | Documentação de instalação, contas, bancos e validação cloud  |

## Mudanças entregues e limites

- Workflow reprodutível de validação, com permissões somente de leitura do código.
- Verificação SQL de bancos vazios, migration, seed e idempotência, sem reset.
- Capturas determinísticas após as transições de interface.
- README, STATUS e NUVEM atualizados, preservando os diagnósticos anteriores.

Avisos não bloqueantes observados: build ignorado de unrs-resolver, futura mudança
do carregador de configuração do Vite e depreciação do runtime Node 20 das actions
v4, executadas pelo runner em Node 24. Não impediram a validação; não foram usados
como justificativa para atualizar dependências fora do escopo.

MFA completo e recuperação externa de senha permanecem preparados, sem integração
final. Atendimentos, encaminhamentos, fechamento e documentos oficiais continuam
em estado vazio ou em desenvolvimento. A aprovação técnica da Fase 1 não é uma
publicação para uso de rotina. O avanço de fase exige autorização explícita.
