# estimeta

A **Fase 6** consolida qualidade e documentação sem mudar as regras financeiras ou a UX aprovada. Consulte [FASE6.md](FASE6.md), a [auditoria inicial](docs/FASE6-AUDITORIA.md), o [inventário completo da API](docs/fase6/API.md) e o [checklist de produção](docs/fase6/PRODUCAO.md). Schema e migrations preservados.

A Fase 5 adiciona **Metas financeiras** em `/metas`: participantes nominais, contribuições, progresso por competência, prazo, histórico e resumo compacto no Dashboard. Mantém os padrões visuais de listas e drawers. Contribuições não criam receitas/despesas nem alteram saldo; uma Transfer existente pode ser vinculada uma única vez. Consulte [FASE5.md](FASE5.md) para modelagem, APIs, regras, migration, testes e roteiro manual. Antes de iniciar esta versão em outro ambiente, execute `npm.cmd run db:generate` e `npm.cmd run db:deploy`.

A Fase 4 adiciona parcelamentos, recorrências mensais, transferências, Repetir e inclusão de contas no saldo geral, preservando a estrutura e as regras anteriores. Consulte [FASE4.md](FASE4.md) para arquitetura, migration, APIs, validação e roteiro manual. Aplique `npm.cmd run db:generate` e `npm.cmd run db:deploy` antes de iniciar a versão atualizada.

Aplicação de controle financeiro pessoal e familiar. A Fase 2 adiciona contas, categorias personalizáveis e lançamentos de receita/despesa persistidos no MySQL, mantendo a autenticação e o espaço familiar da Fase 1. A Fase 3 adiciona dashboard mensal e resumo anual calculados a partir do MySQL. Consulte [FASE3.md](FASE3.md) para regras, APIs, testes e decisões. Consulte [FASE2.md](FASE2.md) para regras, contratos de API, decisões de modelagem, resultados dos testes e roteiro manual.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma ORM 6, MySQL 8, Auth.js 5 (Credentials, versão beta), Zod 4, React Hook Form e Lucide. Versões exatas ficam em `package-lock.json`. Prisma 6 foi escolhido para manter o conector MySQL integrado; uma migração para Prisma 7 exigirá o driver adapter e revisão da configuração. Auth.js segue o padrão documentado em https://authjs.dev e https://nextjs.org/learn/dashboard-app/adding-authentication.

## Pré-requisitos

- Node.js 22.12+ (validado com Node 24).
- npm e MySQL 8 em execução.
- Um banco exclusivo para desenvolvimento e usuário com permissão para criar tabelas e índices.
- `db:migrate` também exige permissão para criar o shadow database. Para aplicar a migration existente sem shadow database, use `db:deploy`.

## Instalação

No PowerShell:

```powershell
cd C:\Workspace\estimetaApp
npm.cmd ci
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Copie o secret gerado para `AUTH_SECRET` no `.env`. Não sobrescreva um `.env` já configurado. O sufixo `.cmd` evita conflitos com instalações antigas do npm no PowerShell. Em outros shells, use `npm` normalmente.

## Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | `mysql://USER:PASSWORD@HOST:3306/estimeta` com credenciais locais. Caracteres especiais da senha precisam de URL encoding. |
| `AUTH_SECRET` | Secret aleatório com pelo menos 32 bytes para proteger a sessão. |
| `AUTH_URL` | Origem da aplicação, por exemplo `http://localhost:3000`. Em produção use HTTPS. |
| `SEED_PASSWORD` | Senha fictícia do usuário de desenvolvimento: mínimo de 10 caracteres, letra, número e até 72 bytes. |

O `.env` está ignorado pelo Git. Não coloque secrets no código, em prints ou no README. Nenhuma variável de banco/auth é pública (`NEXT_PUBLIC_`).

## Banco de dados e Prisma

Crie um banco dedicado usando uma conta administrativa do seu MySQL:

```sql
CREATE DATABASE estimeta CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Configure `DATABASE_URL` com um usuário autorizado a acessar esse banco. Em seguida:

```powershell
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run db:financial-defaults
npm.cmd run db:seed
```

A migration `init_auth_household` cria `User`, `Household` e `HouseholdMember`, UUIDs, e-mail único, índices e chaves estrangeiras. `HouseholdMember.userId` é único: cada usuário pertence a um único espaço, enquanto um espaço pode ter vários membros. Papéis: `OWNER` e `MEMBER`. Cadastro cria as três entidades em uma escrita aninhada atômica do Prisma; conflitos concorrentes de e-mail são tratados pelo índice único.

Para criar migrations futuras em desenvolvimento:

```powershell
npm.cmd run db:migrate -- --name nome_da_alteracao
```

## Seed

```powershell
npm.cmd run db:seed
```

Cria `demo@estimeta.example`, nome `Pessoa Exemplo`, um espaço `Casa de Exemplo` e vínculo `OWNER`, categorias padrão, duas contas demo, lançamentos fictícios de setembro/2026 e exemplos da Fase 4: cartão, notebook em três parcelas, Internet recorrente e transferência em 2027. Use a senha definida em `SEED_PASSWORD`. O seed é idempotente, não altera a senha de usuários existentes e recusa `NODE_ENV=production`. Execute apenas em banco de desenvolvimento. Valores dos arquivos da planilha não são importados.

## Executando localmente

```powershell
npm.cmd run dev
```

Abra http://localhost:3000. Para testar num celular na mesma rede, configure `AUTH_URL` com o endereço IP local do computador e permita a porta no firewall. Cookies de produção requerem HTTPS.

## Build e verificações

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

O build gera o Prisma Client, mas não aplica migrations e não executa seed. `npm.cmd test` cobre autenticação e validações financeiras. `npm.cmd run test:mysql` cobre as regras do serviço em MySQL real. Com a aplicação em execução, `npm.cmd run test:http` verifica as APIs autenticadas. As duas suítes de integração criam e removem somente seus usuários e Households temporários; execute em desenvolvimento. No Windows, pare o servidor Next antes do build para liberar a DLL do Prisma e reinicie-o após o comando.

## Estrutura do projeto

```text
src/app/(auth)/          login, cadastro e recuperação futura
src/app/(dashboard)/     layout privado, resumo e configurações
src/app/api/             route handlers
src/components/forms/   React Hook Form e feedback de envio
src/components/layout/  navegação desktop/mobile e logout
src/components/ui/      elementos reutilizáveis
src/lib/auth/           Auth.js, hash e guards server-side
src/lib/db/             singleton Prisma exclusivo do servidor
src/lib/validations/    schemas Zod compartilhados
src/lib/api/            erros padronizados
src/lib/utils/          formatação pt-BR e BRL
src/services/           regras de cadastro e persistência
src/types/              tipagem de sessão
prisma/                 schema, migration e seed
public/                 ícones locais e recursos estáticos
tests/                  testes essenciais de autenticação
```

Os grupos de rotas não afetam URLs. A proteção reside no servidor, no layout e nas páginas privadas; não depende de middleware nem de JavaScript no navegador. Novas APIs privadas devem chamar `requireApiUser()` e derivar usuário e household da sessão, nunca de IDs enviados pelo cliente. Consultas selecionam explicitamente os campos públicos. `server-only` impede importação acidental do banco em componentes client-side.

## APIs disponíveis

| Método e caminho | Comportamento |
| --- | --- |
| `POST /api/auth/register` | `{ name, email, password }`; 201 com usuário público; 400 inválido; 409 e-mail existente; 500 erro interno. |
| `GET/POST /api/auth/[...nextauth]` | Login, CSRF, sessão e logout gerenciados pelo Auth.js. |
| `GET /api/users/me` | Usuário e vínculo familiar da sessão; 401 sem autenticação. |
| `GET /api/health` | 200 `{ status: "ok", database: "connected" }`; 503 com `database: "unavailable"` sem conexão. |

Erros das APIs de negócio: `{ "error": { "code": "ERROR_CODE", "message": "Mensagem compreensível." } }`. O health utiliza o formato de monitoramento acima e as rotas Auth.js seguem seu protocolo próprio. Senha e hash nunca são retornados. JSON inválido é 400. O e-mail é normalizado para minúsculas.

## Autenticação

Credentials Provider com bcrypt (custo 12) e JWT criptografado em cookie HttpOnly gerenciado pelo Auth.js; sessão com validade de 24 horas e `user.id`, `user.name`, `user.email`. HTTPS permite cookies seguros em produção. As páginas privadas também confirmam que o usuário ainda existe no banco. Logout encerra a sessão do navegador. JWT não tem revogação central imediata de tokens copiados; uma política de revogação será necessária para futuras trocas de senha e encerramento de todas as sessões.

Recuperação de senha possui apenas página informativa, sem simular envio. Futuramente precisará de serviço de e-mail, token aleatório de uso único, expiração e persistência do hash do token. Convites não estão implementados.

## Teste manual

1. Sem sessão, acesse `/dashboard` e `/configuracoes`: ambos devem redirecionar para `/login`.
2. Em `/cadastro`, teste campos inválidos, senhas diferentes e senha fraca. Corrija e cadastre uma conta.
3. Confira no MySQL que há um usuário com hash, um household e vínculo OWNER. Não copie hashes para logs.
4. Repita o cadastro com o mesmo e-mail, inclusive letras maiúsculas: deve retornar 409 sem criar registros extras.
5. Tente login com senha incorreta; depois use a correta e confira redirecionamento ao resumo.
6. Consulte `/api/users/me`: não pode incluir senha/hash. Confirme o espaço em `/configuracoes`.
7. Abra login/cadastro autenticado: deve ir ao resumo. Saia pelo menu e confirme a proteção novamente.
8. Teste desktop e celular (320, 375, 768 e 1440px): navegação por teclado, foco, labels e ausência de rolagem horizontal.
9. Confira `/manifest.webmanifest`, ícones e `/api/health`. Banco indisponível deve resultar em health 503.

## PWA

Manifest, nome estimeta, cores, metadados Apple e ícones PNG 192/512/maskable/180 estão preparados. Não há service worker nem offline nesta fase; a instalação depende das regras do navegador. Não há persistência financeira em localStorage. O SVG fonte está em `public/icon.svg`; `node scripts/generate-icons.mjs` recria os PNGs com `sharp` disponível na árvore do Next.js.

## Próximas fases e limites conhecidos

- Receitas, despesas, contas e categorias estão implementadas na Fase 2. Dashboard financeiro e resumo anual estão implementados na Fase 3; cartões como despesa, parcelas, recorrências e transferências estão implementados na Fase 4.
- Recharts é usado no dashboard; cálculos permanecem no servidor. OpenAPI/Swagger está disponível na Fase 6; automação visual contínua permanece uma evolução futura.
- Antes de exposição pública, configurar HTTPS e limitação distribuída de tentativas de login/cadastro no proxy ou serviço compartilhado; não há rate limiting distribuído nesta fundação.
- Convites, edição de perfil, recuperação por e-mail e revogação central de sessões não estão operacionais.
- Consulte `VALIDACAO.md` como registro histórico da Fase 1 e `FASE2.md` para a validação atual, que inclui MySQL e autenticação reais.


## Dashboard e resumo anual — Fase 3

- `/dashboard`: mês/ano, receitas recebidas, despesas pagas, economia, saldo, previsões, atraso, comparação com mês anterior, evolução de seis meses, categorias e movimentações.
- `/resumo`: janeiro–dezembro, totais, médias, saldo acumulado e categorias; anos vêm das transações e do ano atual.
- APIs: `GET /api/dashboard?year=2026&month=9` e `GET /api/reports/annual?year=2026`, autenticadas, por Household da sessão, respostas privadas sem cache.
- Competência determina o período do relatório. Vencimento determina atraso. Data efetiva registra pagamento/recebimento sem deslocar a competência.
- Economia líquida = receitas RECEIVED − despesas PAID. Saldo ao final do período = soma dos saldos das contas marcadas para incluir no saldo geral, inclusive desativadas. Cada saldo considera valor inicial + receitas recebidas − despesas pagas + transferências recebidas − enviadas, acumulados por competência até o fim do mês selecionado. A regra também vale para o mês corrente; competências futuras não alteram períodos anteriores e o saldo não reinicia em janeiro.
- PENDING não altera saldo nem realizado. Despesa pendente vencida antes de hoje em America/Sao_Paulo é atrasada, usando a regra compartilhada da Fase 2.
- Média: 12 meses em ano encerrado; janeiro até o mês atual dividido pelos meses transcorridos no corrente; indisponível em ano futuro. Saldo anual é dezembro, nunca a soma dos saldos.
- Precisão: Decimal no servidor, strings monetárias na API e formatação exata no frontend. Apenas coordenadas dos gráficos usam Number.

[FASE3.md](FASE3.md) detalha a interpretação dos HTMLs, ambiguidades de médias, limitações do saldo histórico, inventário de arquivos, resultados e roteiro manual. Não há mudanças de banco ou `.env` nesta fase.


## Planejamento da renda e usabilidade

Configurações → Planejamento da renda permite renda realizada ou manual, grupos personalizados, percentuais e alertas. O dashboard compara o planejado com despesas pagas + pendentes, mantendo o saldo somente por realizados e competência. Consulte [PLANEJAMENTO.md](PLANEJAMENTO.md) para modelagem, migration, limitações, testes e roteiro. Nesta evolução há três novas tabelas de configuração; nenhuma alteração de `.env`.


## Refinamento de UX — Fase 5.1

Consulte [FASE5_1.md](FASE5_1.md) para MoneyField, exclusão protegida de metas, planejamento em linhas, donut e validações.

## API — OpenAPI / Swagger

Com o servidor iniciado, abra [Swagger local](http://localhost:3000/docs) em `/docs` ou [OpenAPI JSON](http://localhost:3000/api/openapi) em `/api/openapi`. Contratos OpenAPI 3.1 derivados dos schemas Zod existentes, com respostas conferidas nos serviços e exemplos fictícios. O [inventário](docs/fase6/API.md) reúne métodos, autenticação, parâmetros, corpos, respostas e erros. As seções históricas acima continuam como registro das fases.

Autenticação real: faça login em `/login`; Auth.js emite cookie HttpOnly (Secure sob HTTPS), não Bearer token. APIs privadas revalidam usuário e Household no servidor. Auth.js mantém seu próprio protocolo de sessão/CSRF/logout. Os métodos financeiros usam Origin/Sec-Fetch-Site; cliente não-browser sem esses cabeçalhos continua aceito. Preserve a origem canônica no proxy e não habilite CORS com credenciais para origens arbitrárias.

`/docs` e `/api/openapi` são públicos, contêm apenas contratos e exemplos fictícios, sem consulta ao banco. Swagger somente leitura, sem executar mutações; scripts/CSS locais, validador externo desligado e credenciais não persistidas. A dependência Swagger não entra nos componentes financeiros. `predev` e `prebuild` preparam seus assets automaticamente; se usar `next dev` diretamente, rode `npm.cmd run docs:assets` antes. Em deploy, copie `public` completo junto do build.

```powershell
npm.cmd run docs:assets
npm.cmd run docs:inventory
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:mysql
# Com servidor local em execução:
npm.cmd run test:http
# Opcional: fixture temporária local, sem dados do usuário:
npm.cmd run test:performance
```

`docs:inventory` atualiza a tabela e o snapshot OpenAPI. Testes verificam cobertura de métodos/rotas, referências, ícones, erros e respostas HTTP reais contra os schemas publicados. `test:performance` gera [medição local](docs/fase6/performance.json), remove apenas sua fixture aleatória e não representa SLA de produção. Não execute integração/seed em banco produtivo.

## Segurança, observabilidade e produção

Erros públicos preservam status/corpo e agora recebem `private, no-store`. Falhas inesperadas geram `api.unexpected_error` com timestamp, sem mensagem original, stack, SQL, cookies ou valores financeiros. O log de autenticação existente permanece genérico. Capture stdout/stderr no ambiente de deploy; monitore taxa de 5xx, latência e `/api/health` (200/503). Error tracking pode ser conectado futuramente nesse helper, com sanitização obrigatória.

HTTPS, rate limiting distribuído no proxy/serviço compartilhado, backups com restauração ensaiada e monitoramento são requisitos operacionais antes da exposição pública. Não há limitação em memória apresentada como proteção de produção. Recuperação por e-mail e revogação central de JWT continuam pendentes. Headers nosniff, DENY e Referrer-Policy existentes foram preservados; CSP mais restritiva depende de ensaio em staging com Next/Auth.js/Recharts e Swagger.

PWA preservada: manifest e ícones válidos, standalone, sem service worker, cache financeiro offline ou fila de transações. Instale pelo menu do navegador quando disponível, usando HTTPS em produção ou localhost em desenvolvimento. Conexão continua necessária; não há promessa de funcionamento offline. Conferência em Android físico e instalação desktop ficam no roteiro de homologação; não foram comprovadas nesta fase.

Siga [PRODUCAO.md](docs/fase6/PRODUCAO.md) para variáveis, migrations, deploy, backup/restore e Swagger. O build gera o client Prisma, mas não roda migration/seed. `.env` local foi preservado; `.env.example` contém somente placeholders. Esta pasta não possui Git inicializado: a verificação de histórico/versionamento de segredos depende do repositório de destino.

