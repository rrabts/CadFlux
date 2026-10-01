# CadFlux V1.1 — continuidade

Leia `docs/FASE-1-ESPECIFICACAO.txt` integralmente antes de implementar.
Leia `docs/STATUS.md` para entender o ponto de retomada.

## Escopo autorizado

Implementar exclusivamente a Fase 1 da especificação: autenticação real, três perfis,
autorização no servidor, usuários, unidades e categorias de apoio, importação CSV/XLSX
com validação/prévia/confirmação, auditoria e interface institucional acessível.

Não implementar atendimentos reais, consulta oficial de CPF, pessoas/famílias,
fechamentos, documentos oficiais/PDF/Word, encaminhamentos reais, indicadores reais,
SERPRO/Receita, BI, IA, WhatsApp ou notificações externas. Mostrar placeholders quando
necessário. Não avançar à Fase 2 sem autorização explícita.

## Estado e critérios de conclusão

O código inicial foi interrompido antes de instalar dependências. Não tratar arquivos
existentes como funcionalidades concluídas. Conferir imports, rotas, schema e segurança.
Há scripts referenciados no package.json que ainda precisam ser implementados.

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
após Fase 1 e aguardar autorização.
