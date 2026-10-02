# Fase 1 — entrega de 2 de outubro de 2026

Branch: `feature/foundation-auth`. Base original inspecionada antes da edição; scaffold preservado e concluído. Nenhuma alteração realizada diretamente na main.

## Implementado

- Next.js/TypeScript strict, Tailwind, PostgreSQL real, Prisma, lockfile e configuração de qualidade.
- Migration inicial com as 11 entidades e proteções de auditoria append-only e contra exclusão física de usuários.
- Seed idempotente de três contas fictícias, unidade de demonstração e quatro categorias.
- Login, logout, sessão opaca expirada em 8 horas, hash scrypt, cookie protegido, usuário ativo, limite de tentativas, troca obrigatória de senha temporária.
- Autorização central no servidor, proteção de páginas/APIs, schemas estritos, CSRF por origem, proteção de autoalteração e último administrador.
- Gestão de usuários com busca, quatro filtros, criação, edição, vínculos, perfil, ativação/inativação e histórico.
- Unidades e categorias funcionais; consultas de auditoria somente leitura.
- Importação CSV/XLSX com template, limites, validação estrutural de CPF, normalização, duplicidades, revisão, confirmação atômica e de uso único. Senhas aleatórias fora do arquivo; arquivo original não é persistido.
- Verificação real do tamanho descompactado do XLSX, além dos cabeçalhos ZIP, e rejeição de fórmulas/macros/vínculos externos.
- Dashboards vazios por perfil, marca geométrica, sidebar recolhível, drawer mobile, tema Claro/Escuro/Sistema persistente, feedback e componentes acessíveis.
- README completo, configuração local/nuvem, limpeza de dados temporários e workflow CI.

## Evidências locais

Ambiente: Node 24, pnpm 10.28.2, PostgreSQL embarcado real 18.4, Prisma 6.19.3. Banco da aplicação separado de `cadflux_test`.

| Verificação                            | Resultado                                                 |
| -------------------------------------- | --------------------------------------------------------- |
| Instalação e geração Prisma            | Executadas                                                |
| Migration da aplicação                 | Aplicada com sucesso                                      |
| Migration do banco exclusivo de testes | Aplicada com sucesso                                      |
| Seed                                   | Executado; idempotência exercitada em múltiplas execuções |
| Integração PostgreSQL                  | 21 testes aprovados                                       |
| Navegador Chromium                     | 8 testes aprovados                                        |
| Acessibilidade axe                     | Sem violações WCAG A/AA detectadas nas telas testadas     |
| Lint                                   | Aprovado, zero warnings                                   |
| Typecheck strict                       | Aprovado                                                  |
| Build Next.js                          | Aprovado                                                  |
| Capturas desktop/mobile                | Inspecionadas                                             |

A suíte de integração cobre login válido/inválido/inativo, sessão/expiração/logout, limite de tentativas, permissões dos três perfis, criação/edição/vínculos/perfil/status, revogação de sessão, senha temporária, mass assignment, autoalteração, revalidação do administrador, CSV/XLSX, referências/perfil inválidos, duplicidades, revalidação e atomicidade, IDOR, confirmação expirada, limites/fórmulas/ZIP com tamanho falso e imutabilidade dos logs.

A suíte de navegador cobre rotas e APIs protegidas, CSRF, acesso direto bloqueado aos perfis operacionais, menu da Direção, tema persistido, sidebar/drawer, logout, inativação, cadastro/edição/ativação/inativação pela UI, revisão e confirmação de importação, troca obrigatória de senha e verificação automatizada de acessibilidade. Os testes não equivalem a uma certificação completa de acessibilidade.

## Limites preservados

Sem atendimentos, pessoas/famílias, consulta CPF oficial, fechamentos reais, documentos oficiais, PDF/DOCX, encaminhamentos funcionais, indicadores operacionais, IA ou integrações externas. MFA, e-mail de recuperação/convite, unidades adicionais e segundo aprovador possuem base arquitetural, sem serviço funcional nesta fase. Nenhum deploy de produção foi realizado. CI foi configurada; o resultado remoto deve ser consultado no GitHub após publicação da branch.

Instalação, contas fictícias, permissões, rotas, limites de consulta e decisões estão no README. Não iniciar a Fase 2 sem autorização.
