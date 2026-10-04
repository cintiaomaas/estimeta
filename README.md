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

Manifest, nome estimeta, cores, metadados Apple e ícones PNG 192/512/maskable/180 foram preservados. `public/sw.js` é o único service worker, registrado ao ativar notificações, com eventos `push` e `notificationclick`. Não intercepta requests, não implementa offline nem persiste dados financeiros em localStorage. O SVG fonte está em `public/icon.svg`; `node scripts/generate-icons.mjs` recria os PNGs com `sharp` disponível na árvore do Next.js.

## Notificações Web Push

Funcionalidade opcional em **Configurações → Notificações → Ativar notificações**, para Chrome/Edge desktop e Chrome Android/PWA instalada. **iOS não faz parte do escopo atual.** Firefox usa o mesmo padrão Web Push, sujeito à homologação. Navegação financeira, manifest e ícones permanecem iguais; a permissão só é solicitada ao clicar no botão. Cada dispositivo é ativado/desativado separadamente. Descrição, valor e vencimento podem aparecer na tela bloqueada, conforme informado na interface.

### Arquitetura e regra

Stack inspecionada: Next.js 16.3.5, React 19.3.0, App Router, Auth.js Credentials/JWT, Prisma 6.19.3 e MySQL. Nenhuma biblioteca push ou service worker existia. A nova dependência de runtime é `web-push`; `@types/web-push` é somente de desenvolvimento. Não há SDK Firebase.

`Transaction` já contém `id`, `createdBy`, `householdId`, `description`, `amount`, `scheduledDate` (MySQL DATE) e `status`. O job seleciona somente `type=EXPENSE`, `status=PENDING`, vencendo amanhã. O destinatário é **o autor (`createdBy`)**, desde que ainda pertença ao Household do lançamento e tenha inscrição ativa. Não envia para todos os membros da família. Parcelas e recorrências são elegíveis quando já materializadas em `Transaction`; o job não gera novas recorrências.

O calendário é `America/Sao_Paulo`, reutilizando `todayInBrazil` e `databaseDate`. Primeiro calcula o dia civil brasileiro, soma um dia e compara o MySQL DATE, sem converter o vencimento para o dia anterior. A competência continua independente do vencimento. O clique abre `/despesas?period=AAAA-MM` na competência correspondente; a lista mantém filtros e paginação existentes.

Persistência adicionada pela migration **`20261004120000_web_push`**:

- `PushSubscription`: usuário, endpoint/chaves, hash SHA-256 único do endpoint, estado ativo e auditoria; vários dispositivos por usuário. O hash resolve o limite de índices MySQL para URLs longas e não substitui o endpoint necessário ao envio.
- `NotificationLog`: referência ao usuário e lançamento, tipo `EXPENSE_DUE_TOMORROW`, vencimento de referência, criação e primeiro aceite pelo provedor (`sentAt`). Restrição única em usuário/lançamento/tipo/data.
- `NotificationDelivery`: reserva persistente por histórico/hash do endpoint; estados `CLAIMED`, `SENT`, `FAILED`, `EXPIRED`. Restrição única impede corrida entre execuções. O histórico não duplica descrição ou valor.
- Índice em `Transaction(type, status, scheduledDate, id)`. Migration aditiva, sem apagar ou reescrever dados financeiros. Exclusões legítimas de usuário/lançamento removem seus registros de notificação por cascade.

Rotas seguem a autenticação, validação Zod, checagem de origem e respostas privadas existentes:

| Método / rota | Uso |
| --- | --- |
| `POST /api/push/subscriptions` | Ativar a inscrição do usuário da sessão. Body: JSON `PushSubscription.toJSON()`. |
| `DELETE /api/push/subscriptions` | Desativar somente a inscrição da própria conta. Body: `{ "endpoint": "..." }`. |
| `POST /api/push/subscriptions/status` | Consultar somente `{ data: { active } }`; endpoint no body, nunca na URL. |
| `GET /api/cron/due-notifications` | Executar job com `Authorization: Bearer <CRON_SECRET>`, inclusive local. |

Nenhuma rota aceita `userId` do cliente. Um endpoint já pertencente a outra conta nunca é transferido ou removido. Destinos de envio são limitados a HTTPS dos serviços Google, Mozilla e Windows; novos provedores exigem revisão dessa lista. Chaves privadas ficam exclusivamente no módulo de servidor. Logs contêm eventos e contadores, sem payload, endpoints, chaves, SQL ou mensagens originais do provedor.

No logout, o aplicativo desativa a inscrição deste dispositivo e tenta revogá-la no navegador. Para proteger dispositivos compartilhados, o service worker confirma a sessão antes de apresentar valores. Sem conexão, com sessão expirada ou conta diferente, mostra apenas aviso genérico e abre login. O aplicativo continua funcionando se push ou cleanup falhar.

### Ambiente, VAPID e configuração local

Adicione ao `.env` sem substituir as variáveis existentes:

```dotenv
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
CRON_SECRET=
```

Gere um par VAPID localmente usando a dependência instalada:

```powershell
npx.cmd web-push generate-vapid-keys
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

O primeiro comando produz a chave pública e privada; o segundo gera um `CRON_SECRET` independente (mínimo 32 caracteres). Não compartilhe nem versione as saídas privadas. Use `mailto:` com um e-mail de contato válido em `VAPID_SUBJECT`. A chave pública é a única variável exposta ao navegador e precisa existir **antes do build**. Guarde o par VAPID estável; trocar chaves exige reativação das inscrições. Não há geração automática de secrets no build.

Com `DATABASE_URL` apontando para o ambiente correto:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run dev
```

HTTPS é obrigatório em produção e no Android. `http://localhost` é a exceção para desenvolvimento desktop; acesso ao IP da rede por HTTP não habilita Web Push. Faça login e ative em Configurações. Estados apresentados: ativadas, desativadas, permissão bloqueada, navegador incompatível e erro de consulta com nova tentativa. Falta de configuração não impede o uso financeiro.

### Vercel e funcionamento do job

Cadastre as quatro variáveis acima no projeto Vercel, além das variáveis de banco/auth já existentes. Configure o mesmo par VAPID no servidor e build; prefira credenciais separadas entre homologação e produção. Aplique a migration por um processo autorizado com `npm.cmd run db:deploy` antes de liberar o deploy. O build gera Prisma Client, **não aplica migrations**. Faça um novo deploy após configurar ou mudar a chave pública.

`vercel.json` agenda diariamente às **12:00 UTC (09:00 em São Paulo)**. Vercel Cron é habilitado em produção; desenvolvimento e previews precisam de disparo manual. A Vercel envia `CRON_SECRET` no header Authorization. Não há bypass local. Uma chamada sem secret ou com secret inválido retorna 401 antes de acessar o banco.

Não foi possível identificar o plano contratado pelos arquivos locais. A frequência diária é compatível com Hobby; nesse plano a execução pode ocorrer ao longo da hora agendada, sem minuto exato. Consulte [limites oficiais](https://vercel.com/docs/cron-jobs/usage-and-pricing) e [proteção e operação do cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

O job pagina 100 candidatos por vez, confere estado/proprietário novamente, reserva cada dispositivo antes do envio e usa até cinco envios paralelos, timeout de 5 segundos e TTL de uma hora. Retornos 404/410 desativam a inscrição, preservando os outros dispositivos. Sem despesas ou inscrições retorna contadores zerados. `sentAt` significa aceite pelo push service, não confirmação de leitura/entrega.

**Sem duplicação:** execução repetida ou concorrente encontra a reserva única e ignora aquela tentativa. MySQL e push service não oferecem transação distribuída: uma queda após reservar ou após o provedor aceitar pode deixar `CLAIMED` sem `sentAt`. Para preservar a ausência de duplicidade, esse MVP não reenvia automaticamente `CLAIMED` ou `FAILED`, inclusive timeouts e falhas transitórias. Não apague reservas para forçar reenvio sem investigar, pois pode duplicar um aviso já entregue. Dispositivos adicionais mantêm registros independentes.

A função tem limite configurado de 60 segundos, com orçamento de trabalho de 45 segundos. Se esgotado, retorna 503 com `data.incomplete=true`; a execução manual seguinte ignora reservas já existentes e pode continuar os candidatos restantes. Vercel Cron não faz retry automático. Monitore `push.job_completed`, `push.delivery_failures`, contadores `failed`/`expired` e respostas 503. Para volumes altos, recomenda-se fila com processamento em lotes e política explícita para falhas incertas.

### Disparar e testar manualmente

No ambiente de testes com servidor em execução e `.env` configurado, execute do diretório do projeto; o comando lê o secret sem imprimi-lo:

```powershell
node --env-file=.env -e "fetch('http://localhost:3000/api/cron/due-notifications',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}}).then(async r=>console.log(r.status,await r.json()))"
```

Para ambiente HTTPS, substitua a URL pelo domínio correspondente e utilize o secret daquele ambiente. O job não aceita data artificial: calcule amanhã em São Paulo. Não execute contra produção para experimentar.

Chrome Desktop (repita também no Edge):

1. Faça login com usuário de teste. Abra Configurações e confirme que nenhum popup aparece automaticamente.
2. Clique em Ativar notificações e permita. Verifique estado ativado, `sw.js` em DevTools → Application → Service Workers e uma inscrição ativa no banco.
3. Cadastre uma despesa pendente para amanhã, outra paga para amanhã e outra pendente para depois de amanhã. Dispare o job: apenas a primeira deve notificar com descrição, BRL e data.
4. Dispare duas vezes e simultaneamente; não deve surgir segundo aviso por dispositivo para o mesmo lançamento/data. Confira um histórico e uma entrega por dispositivo.
5. Clique na notificação: abre ou foca Despesas na competência correta. Faça o mesmo com competência diferente do mês atual.
6. Ative outro navegador/dispositivo na mesma conta; ambos recebem seus próprios avisos para uma nova despesa. Desativar um não desativa o outro.
7. Em perfil novo, negue a permissão: estado bloqueado, aplicativo financeiro utilizável. Reverta a permissão nas configurações do navegador para tentar novamente.
8. Saia da conta e entre em outra: inscrições não podem ser transferidas nem consultadas por outro usuário. Verifique rotas sem sessão (401), origem externa (403) e cron sem token (401).
9. Teste usuário sem inscrição, zero despesas, indisponibilidade do provedor e inscrição expirada (404/410 via sender simulado nos testes). Falhas devem preservar o restante da execução.

Android/PWA:

1. Abra o domínio **HTTPS** no Chrome Android, instale pelo menu do navegador e abra a PWA.
2. Faça login, ative em Configurações e permita também nas permissões do Android, se solicitado.
3. Cadastre uma nova despesa pendente para amanhã, coloque a PWA em segundo plano e dispare o job.
4. Confira título, valor e vencimento; toque no aviso e confira a tela Despesas. Repita o job e confirme ausência de duplicidade.
5. Desative, negue permissão e teste logout/troca de conta. O restante do aplicativo deve continuar utilizável. Valide em aparelho físico e com as políticas reais de bateria/rede.

### Testes automatizados e limitações

```powershell
npm.cmd run docs:inventory
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
# Somente com banco MySQL de testes e migrations aplicadas:
node --env-file=.env --import tsx --test tests/integration/push.mysql.ts
# Com servidor de testes iniciado e TEST_BASE_URL correspondente:
node --env-file=.env --import tsx --test tests/integration/push.http.ts
```

`tests/push.test.ts` cobre calendário brasileiro, autenticação do cron, validação/SSRF, múltiplos dispositivos, concorrência, repetição, falhas de envio, 404/410, ausência de inscrição, permissão negada e eventos do service worker. `tests/integration/push.mysql.ts` usa fixtures isoladas, sender simulado, consultas e restrições reais do MySQL para conferir despesas pendentes/pagas/outros dias, isolamento e unicidade concorrente. Não envia pushes reais.

`tests/integration/push.http.ts` verifica as rotas com login Auth.js real: 401 anônimo, 403 origem externa, 400 payload inválido/SSRF, 409 tentativa de tomar inscrição alheia, consulta/desativação por proprietário, cron protegido e headers do service worker.

Entrega depende de navegador, conectividade, permissão do sistema, bateria e push service; não substitui a consulta de vencimentos no aplicativo. Sessão expirada recebe somente conteúdo genérico. Avisos podem refletir dados que mudaram após envio; o job revalida antes do envio, mas não cancela mensagens já aceitas pelo provedor. Inscrições expiradas exigem reativação manual; não há renovação em segundo plano. Despesas criadas após o cron diário podem não ser avisadas a tempo. Não há catch-up para dias perdidos nem configurações de 0/3/5 dias nesta versão. O campo `type` e a data de referência permitem evolução futura.

### Arquivos desta implementação

Criados:

```text
prisma/migrations/20261004120000_web_push/migration.sql
public/sw.js
vercel.json
src/app/api/push/subscriptions/route.ts
src/app/api/push/subscriptions/status/route.ts
src/app/api/cron/due-notifications/route.ts
src/components/notifications/notification-settings.tsx
src/lib/push/browser.ts
src/lib/push/cron-auth.ts
src/lib/push/due-date.ts
src/lib/push/sender.ts
src/lib/validations/push.ts
src/services/push-subscriptions.ts
src/services/due-notifications.ts
tests/push.test.ts
tests/integration/push.mysql.ts
tests/integration/push.http.ts
```

Alterados: `prisma/schema.prisma`, `.env.example`, `package.json`, `package-lock.json`, `next.config.ts`, `src/app/(dashboard)/configuracoes/page.tsx`, `src/app/(dashboard)/despesas/page.tsx`, `src/components/layout/logout-button.tsx`, `src/lib/api/openapi.ts`, `scripts/api-inventory.ts` e este README. `docs/fase6/API.md` e `docs/fase6/openapi.json` foram regenerados pelo script existente; a pasta `docs` já é ignorada pelo Git neste projeto.

Validação em 04/10/2026: Prisma generate, typecheck, build e 59 testes unitários aprovados; lint sem erros, com 15 warnings preexistentes em `.tmp/bank-assets/inter-page.js`. Migration aplicada e integração MySQL/HTTP aprovada em MySQL 8 temporário, porta local isolada, sem modificar o banco remoto indicado no `.env`. Não houve deploy, envio push real nem homologação em Android físico; essas etapas exigem VAPID e ambiente HTTPS configurados.

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

PWA preservada: manifest e ícones válidos, standalone, agora com service worker exclusivo para notificações, sem cache financeiro offline ou fila de transações. Instale pelo menu do navegador quando disponível, usando HTTPS em produção ou localhost em desenvolvimento. Conexão continua necessária; não há promessa de funcionamento offline. Conferência em Android físico e instalação desktop ficam no roteiro de homologação.

Siga [PRODUCAO.md](docs/fase6/PRODUCAO.md) para variáveis, migrations, deploy, backup/restore e Swagger. O build gera o client Prisma, mas não roda migration/seed. `.env` local foi preservado; `.env.example` contém somente placeholders. Esta pasta não possui Git inicializado: a verificação de histórico/versionamento de segredos depende do repositório de destino.

