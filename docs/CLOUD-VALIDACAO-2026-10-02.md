# Revalidação Linux da Fase 1 — 02/10/2026

## Resultado

**Validação parcial; execução completa em nuvem ainda não comprovada.** A main foi clonada e as dependências instaladas com sucesso. Lint, TypeScript, schema Prisma e 62 testes unitários passaram neste executor. PostgreSQL, migrations/seed, integração, build de produção e navegação completa não puderam ser validados aqui.

Os 85 testes e dez cenários registrados anteriormente em STATUS.md são evidências do Windows; não foram reproduzidos integralmente neste Linux. Não há implantação de produção ou avanço para a Fase 2.

## Origem e ambiente

- Base: main, commit `5bc35d727dcde44724bfaa6b7d0f43479a0dba92`, contendo o merge do PR #2.
- Branch de proposta: `codex/cloud-validation-2026-10-02`.
- Clone Git HTTPS realizado com sucesso; o repositório está público no GitHub. Clone não comprova autenticação ou escrita do shell. A proposta é enviada pelo conector GitHub.
- Executor remoto Linux x86_64, kernel 6.18.44, usuário root; diretório `/workspace/scratch/f3a77e6195df/CadFlux`. Nenhum comando executado no Windows do usuário.
- Node 24.19.0; pnpm 10.28.2 via npm exec; Prisma 6.19.3; Next.js 16.3.8; Vitest 4.1.11, conforme lockfile preservado.
- Leitura de AGENTS.md, especificação da Fase 1, STATUS.md, NUVEM.md, README e scripts de preparação antes de alterações.
- Nenhum PostgreSQL disponível no PATH e nenhum URL de banco fornecido pelo ambiente. O db:local criou .env com os exemplos fictícios do projeto; não iniciou banco. .env, dependências e resultados intermediários continuam ignorados.

## Evidências

| Verificação                                                                                                                             | Resultado observado                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `git clone https://github.com/rrabts/CadFlux.git CadFlux`                                                                               | Saída 0; HEAD igual à base acima                                                                                         |
| `CI=true npm exec --yes --package=pnpm@10.28.2 -- pnpm install --frozen-lockfile`                                                       | Saída 0; 566 pacotes e Prisma Client gerado; aviso de build ignorado para unrs-resolver, sem impedir lint                |
| `node node_modules/eslint/bin/eslint.js . --max-warnings=0`                                                                             | Saída 0; lint completo antes da correção                                                                                 |
| `node node_modules/typescript/bin/tsc --noEmit`                                                                                         | Saída 0; fontes existentes verificadas, sem build/rotas geradas concluídos                                               |
| `TMPDIR=<diretório gravável do checkout> node --env-file-if-exists=.env node_modules/prisma/build/index.js validate`                    | Saída 0; schema válido. Tentativa sem TMPDIR falhou por `/tmp` não acessível; temporário usado: `.local/tmp`             |
| `node node_modules/vitest/vitest.mjs run tests/auth-permissions.test.ts tests/imports.test.ts tests/database-identity.test.ts`          | Saída 0; 62 testes em três arquivos, 1,87 s                                                                              |
| `node scripts/local-postgres.mjs`, antes da correção                                                                                    | Recusou root e não iniciou banco, mas retornou saída 0 indevidamente                                                     |
| `node scripts/local-postgres.mjs`, após a correção                                                                                      | Mesma recusa de root; saída 1 correta                                                                                    |
| `setpriv --reuid=65534 --regid=65534 --clear-groups id`                                                                                 | Saída 127; setresuid failed: Invalid argument; troca de usuário indisponível neste executor                              |
| `node --env-file-if-exists=.env scripts/setup-database.mjs --all`                                                                       | Saída 1; PostgreSQL indisponível; migrations e seed não executados                                                       |
| `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run tests/backend.integration.test.ts tests/imports.integration.test.ts` | Saída 1; duas suítes falharam no beforeAll por banco inacessível em 127.0.0.1:54329; 23 casos não executados             |
| `npm exec --yes --package=pnpm@10.28.2 -- pnpm build`                                                                                   | Saída 1; Prisma Client gerado, Next build bloqueado por ENOENT / uv_resident_set_memory                                  |
| `node --env-file-if-exists=.env node_modules/@playwright/test/cli.js test`                                                              | Saída 1 antes dos casos: servidor não iniciou porque não existe build de produção; nenhum cenário de navegador executado |
| `bash -n scripts/cloud-setup.sh` e `node --check` nos três scripts de banco                                                             | Saída 0                                                                                                                  |
| Lint e sintaxe do local-postgres.mjs corrigido                                                                                          | Saída 0                                                                                                                  |

A chamada isolada `process.memoryUsage()` também falha com ENOENT / uv_resident_set_memory, sem carregar o aplicativo. Isso sustenta o diagnóstico de limitação do executor para o build, sem comprovar que o aplicativo passará em outro ambiente. Não foram usados mocks de banco, substituição de chamadas de memória ou execução privilegiada para apresentar aprovação.

As suítes unitárias verificaram hash/segredos, permissões, sanitização de auditoria, validação/parsing CSV e XLSX, limites de upload e identidade de bancos. Isso não valida login HTTP real, persistência de sessões, transações, triggers, gestão e importação no PostgreSQL, temas ou responsividade no navegador.

Aviso do Vitest: import sem extensão no config é incompatível com uma futura mudança do carregador do Vite. Não impede a execução atual e não foi alterado nesta validação.

## Correção verificada

No caminho de falha de scripts/local-postgres.mjs, `process.exitCode = 1` era sobrescrito na saída natural pelo hook de encerramento registrado por embedded-postgres. A falha de inicialização retornava 0. Após aguardar a parada do cluster e emitir o erro, o script passa a chamar `process.exit(1)`, preservando o código de falha no hook.

Reprodução real neste Linux: mesma recusa de root antes/depois; retorno mudou de 0 para 1. Nenhum privilégio ou regra do PostgreSQL foi alterado. O caminho de inicialização bem-sucedida e encerramento normal permanece sem revalidação neste ambiente.

## Pendências para validação completa

1. Usar um executor Linux que suporte as chamadas de sistema usadas pelo Node/Next.
2. Disponibilizar PostgreSQL real sob usuário sem privilégios, ou dois bancos externos fictícios distintos configurados fora do código.
3. Executar db:setup --all em bancos inicialmente vazios, conferir migration e seed e repetir para idempotência.
4. Executar os 85 testes completos, build e os dez cenários de navegador; inspecionar as capturas e verificar encerramento automático do servidor de teste.

Não selecionar ambiente, contratar serviços, publicar produção ou avançar de fase nesta proposta. Os 20 critérios anteriores permanecem como histórico do Windows; este relatório não os declara novamente aprovados em nuvem.
