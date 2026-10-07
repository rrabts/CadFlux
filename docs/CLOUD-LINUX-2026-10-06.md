# Preparação Codex Cloud Linux — 06/10/2026

Ambiente `/workspace/CadFlux`, independente do Windows. Base `main` confirmada
por `git ls-remote`: `507ace8ff727da5d83b50d4eec2dc132cc680a8b`.
Branch de trabalho: `codex/cloud-linux-setup`. Leitura de AGENTS, especificação,
STATUS, NUVEM e CLOUD-EXECUCAO realizada antes das alterações.

## Verificações

- Git HTTPS: leitura remota e `git push --dry-run` passaram. O dry-run confirmou
  acesso de escrita sem enviar branch. Credenciais da integração não foram copiadas.
- Node 24.19.0 atende a 22.12+; pnpm 10.28.2 via
  `npm exec --yes --package=pnpm@10.28.2 -- pnpm`.
- `CADFLUX_SKIP_LOCAL_POSTGRES=1 bash scripts/cloud-setup.sh`: saída 0;
  instalação frozen-lockfile, geração Prisma 6.19.3, migrations e seed em ambos.
- PostgreSQL 18.4 real, binário Linux de embedded-postgres, executado como `agent`,
  sem root. `node scripts/local-postgres.mjs` permanece em sessão supervisionada.
  Dados persistentes em `.local/postgres`, acesso somente em `127.0.0.1:54329`.
- DATABASE_URL e DATABASE_URL_TEST estão no `.env` ignorado, permissão 0600,
  com credenciais fictícias. Bancos `cadflux` e `cadflux_test` separados.
- SQL confirmou versão, identidade e migration `20261002140000_foundation`.
  Após seed, cada banco tinha 3 usuários, 2 unidades, 4 categorias e uma migration
  concluída. Testes posteriores adicionam fixtures somente ao banco de testes.
- A primeira tentativa de seed falhou com cliente Prisma pré-instalado incompleto;
  reinstalação e geração resolveram. Setup final passou e preservou a migration
  já aplicada ao desenvolvimento, sem apagar bancos.
- Lint e typecheck passaram. Vitest: 85 testes em 5 arquivos passaram.
- Build Next.js 16.3.8 passou. `pnpm dev` ficou ativo em loopback na porta 3000:
  `/login` respondeu 200 e `/dashboard` sem sessão respondeu 307.
  Leitura de RSS e Next funcionaram sem `uv_resident_set_memory`.
- PostgreSQL e Next permaneceram ativos entre comandos independentes da tarefa.
  Não são serviços systemd nem há garantia de sobreviver ao encerramento do Cloud.

## Rede, limites e retomada

A configuração selecionada inclui o preset package_managers (GitHub, npm e
outros registros) e `binaries.prisma.sh`. Git e downloads funcionaram pelo proxy
herdado com permissões ampliadas aprovadas. No sandbox padrão, o proxy e as portas
locais não são acessíveis. Não houve desativação de proxy ou TLS.
O status da plataforma ainda informa network_policy.state=unknown; sucesso dos
comandos comprova esses acessos, não a aplicação global de toda a política.

Não há sudo/psql de sistema; usamos PostgreSQL real fornecido pelo projeto.
Para retomar após encerrar as sessões:

```bash
npm exec --yes --package=pnpm@10.28.2 -- pnpm db:local
# Em outro terminal, com acesso a rede/loopback do ambiente:
CADFLUX_SKIP_LOCAL_POSTGRES=1 bash scripts/cloud-setup.sh
npm exec --yes --package=pnpm@10.28.2 -- pnpm dev
```

O setup foi revisado para usar `db:setup --all`, que verifica os dois URLs,
recusa produção/bancos idênticos e executa SQL, migrations e seed em ambos.
Não foi instalado pnpm global. Instalação avisou sobre build ignorado de
unrs-resolver; lint passou. Vitest avisou sobre futura configuração native do
Vite; os testes passaram. E2E em navegador não foi executado nesta preparação.

Salvar/publicar uma configuração reutilizável de ambiente Cloud não foi feito:
não há ferramenta de edição/publicação desse ambiente nesta sessão. URLs não
foram cadastrados como secrets da plataforma. O `.env` é local e ignorado.
Nenhuma publicação de aplicativo, contratação ou dado real foi utilizada.
O diagnóstico histórico e a matriz de aceite anterior não foram reescritos
como validação completa de interface em Cloud.


## Complemento: correção da retomada

O setup passou a iniciar o supervisor cloud-runtime, sem apt/sudo, validar ambos
os bancos, aplicar migrations/seed e iniciar Next.js. Start repetido, reinício
automático dos filhos e stop/start passaram. O status atual da plataforma informa
rede enforced. E2E foi executado com Chromium instalado: 10 passaram em 21,3s,
saída 0, com teardown automático. Vitest foi repetido: 85 passaram. Build, lint
e typecheck passaram. A preparação completa e as limitações atuais estão em
[CLOUD-RETOMADA.md](CLOUD-RETOMADA.md). As instruções manuais e a ausência de E2E
registradas acima descrevem a etapa anterior, agora substituída pelo supervisor.
Salvar a configuração Cloud/secrets e validar uma instância nova continuam
pendentes por falta de ferramenta de escrita do ambiente nesta sessão.

## Continuação: branch remota e clone independente

Branch `codex/cloud-linux-setup` enviada ao GitHub. Clone autenticado independente
em `/workspace/CadFlux-clean-validation` confirmou instalação sem `.env`, bancos
ou dependências anteriores: setup, migrations/seed, SQL e HTTP passaram.
Lint, typecheck, build, 85 testes e 10 E2E passaram novamente (24,9s).
Também passou start/status/stop com URLs herdados e sem criação de `.env`.
Os bancos de desenvolvimento do checkout original foram preservados; serviços
originais retomados depois dos testes. A plataforma continua sem ferramenta de
escrita de configuração/secrets ou criação de instância nova nesta sessão.
