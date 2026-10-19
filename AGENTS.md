# CadFlux V1.1 — continuidade

Leia `docs/FASE-1-ESPECIFICACAO.txt` integralmente antes de implementar.
Leia `docs/STATUS.md` para entender o ponto de retomada.

## Escopo autorizado

Roberto autorizou explicitamente a Fase 2 em 19/10/2026. Leia também integralmente
`docs/FASE-2-ESPECIFICACAO.md`. Preservar a fundação da Fase 1 e refinar a gestão de
usuários, unidades e categorias, com vínculos adicionais, integridade e auditoria.

Não implementar atendimentos reais, consulta oficial de CPF, pessoas/famílias,
fechamentos, documentos oficiais/PDF/Word, encaminhamentos reais, indicadores reais,
SERPRO/Receita, BI, IA, WhatsApp ou notificações externas. Mostrar placeholders quando
necessário. Não avançar à Fase 3 sem autorização explícita.

## Estado e critérios de conclusão

A Fase 1 possui validação completa em nuvem documentada no PR #5 e em STATUS.
Conferir o commit e os resultados da execução correspondente antes de reutilizar
evidências. As mudanças da Fase 2 exigem testes próprios e regressão da fundação.

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
após Fase 2 e aguardar autorização para a fase seguinte.
