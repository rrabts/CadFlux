# CadFlux — governança do repositório

## Proteção desejada da main

Configuração declarativa: [main-ruleset.json](../.github/main-ruleset.json).
O arquivo versionado não ativa a proteção no GitHub. A ativação exige uma
operação administrativa e verificação posterior das regras efetivas.

| Regra | Configuração |
| --- | --- |
| Alvo | Apenas `refs/heads/main` |
| Modo | Ativo |
| Exceções permanentes | Nenhuma |
| Integração | Pull request obrigatório |
| Validação exigida | `PostgreSQL, backend and browser`, emitida por GitHub Actions (app 15368) |
| Atualização da branch | Base atualizada antes de integrar |
| Discussões de revisão | Resolvidas antes da integração |
| Force push e exclusão da main | Bloqueados |
| Aprovação de outra pessoa | Zero obrigatórias nesta configuração; não foi designado um segundo mantenedor |

Pull request e testes são obrigatórios mesmo sem aprovação de uma segunda
pessoa. Isso não deve ser apresentado como revisão humana independente.
Quando houver outro revisor designado, avaliar uma aprovação obrigatória e
revisão de alterações de workflows. Não habilitar bypass para evitar um teste
falho, nem bloquear todas as atualizações da branch por engano.

### Aplicação e conferência

Importar o JSON como ruleset de branch nas configurações do repositório, ou
usar a API oficial com sessão administrativa autorizada. Antes de criar,
consultar os rulesets existentes para evitar duplicação. Se já houver o
ruleset `CadFlux main — PR e validação`, comparar e atualizar somente esse
ruleset; não substituir outras proteções.

Depois de aplicar, conferir no GitHub: alvo `main`, modo ativo, nenhuma exceção,
PR exigido, check exato vinculado ao GitHub Actions e base atualizada. Conferir
também a API de regras efetivas de `main`. Validar o comportamento com o PR
de manutenção já aprovado, sem criar commits inválidos ou tentar force push.

O conector disponível nesta sessão permite código/PRs, mas não possui ação de
escrita administrativa de rulesets. A interface do GitHub exige autenticação
administrativa independente. Enquanto não houver evidência da aplicação, o
item permanece **preparado, não confirmado como ativo** em STATUS.

Referências oficiais:
- [API de regras de repositório](https://docs.github.com/en/rest/repos/rules?apiVersion=2022-11-28).
- [Workflow de validação](../.github/workflows/phase-1-cloud.yml).

## Avaliação da automação auxiliar removida

O arquivo `.github/workflows/copilot-setup-steps.yml` continha somente um
fragmento de step `Codacy CLI V2`, sem os campos de um workflow executável.
O nome do arquivo não correspondia a uma preparação funcional do Copilot.

Na base `35aab49`, o [run 39780048209](https://github.com/rrabts/CadFlux/actions/runs/39780048209)
falhou sem jobs. O fragmento deixava ferramenta e configuração em branco,
descrevia ESLint como padrão e não habilitava envio de relatório nem fornecia
referência a integração configurada. Não havia check/status Codacy no commit
consultado. Isso não prova inexistência de uma conta externa; apenas ausência
de uso funcional demonstrado neste repositório.

O workflow principal já executa `pnpm lint` com `--max-warnings=0`, usando as
regras Next.js/TypeScript, além de testes, banco real e build. Manter aquele
fragmento criava falhas sem cobertura adicional demonstrada. Decisão: removê-lo
e preservar integralmente a validação principal. Não foram desligados checks
funcionais nem modificados os comandos de teste.

Uma futura integração de análise estática só deve ser adicionada com objetivo
distinto, configuração válida, permissões mínimas e evidência de resultado.
Não cadastrar tokens ou serviços externos apenas para manter esse fragmento.
