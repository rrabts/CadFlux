# CadFlux V1.1 — continuidade

Leia `docs/FASE-1-ESPECIFICACAO.txt` integralmente antes de implementar.
Leia `docs/STATUS.md` para entender o ponto de retomada.

## Escopo autorizado

Roberto autorizou a Fase 3 (Atendimentos) em 19/10/2026 após as Fases 1 e 2
integradas e validadas na main. Leia `docs/FASE-3-ESPECIFICACAO.md` integralmente.
Preservar autenticação, gestão institucional, permissões e auditoria existentes.
Implementar registros operacionais apenas com dados fictícios nesta entrega.

Não implementar consulta oficial de CPF, pessoas/famílias como cadastro separado,
fechamentos, documentos oficiais/PDF/Word, encaminhamentos, indicadores agregados,
SERPRO/Receita, BI, IA, WhatsApp, notificações ou publicação de produção.
Não avançar à Fase 4 sem nova autorização.

## Estado e critérios de conclusão

A Fase 1 possui validação completa em nuvem documentada no PR #5 e em STATUS.
Conferir o commit e os resultados da execução correspondente antes de reutilizar
evidências. As Fases 2 e 3 exigem testes próprios e regressão da fundação.

Usar Next.js, TypeScript estrito, PostgreSQL real, Prisma e Tailwind. Não substituir
autenticação por mocks ou localStorage. Senhas apenas com hash seguro; sessão httpOnly;
status/perfil autorizados no backend. Auditoria append-only e sem dados de senha/token.
Nenhum usuário criado por importação antes da confirmação; confirmação revalida no
servidor e é de uso único. Dados apenas fictícios.

Preservar o que estiver correto. Trabalhar em etapas pequenas e executar migrations,
seed, lint, typecheck, testes críticos e build. Corrigir falhas e documentar limitações.
Só declarar Fase 1 concluída quando os 20 critérios de aceite tiverem evidência.

## Ambiente de nuvem

O repositório contém apenas código e configuração de exemplo. `.env`, dados do banco,
dependências e caches devem permanecer ignorados. Preparação Linux em
`scripts/cloud-setup.sh`; configuração e retomada em `docs/NUVEM.md`.

No fim, atualizar README e STATUS com comandos, contas fictícias, rotas, matriz de
permissões, entidades/migrations, resultados de testes, decisões e limitações. Parar
após Fase 3 e aguardar autorização para a fase seguinte.
