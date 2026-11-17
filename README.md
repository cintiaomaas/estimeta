# Estimeta

O Estimeta é uma aplicação de gestão financeira pessoal e familiar. Reúne o controle do dia a dia e o planejamento de objetivos para ajudar a entender quanto entra, quanto sai, quais compromissos estão pendentes e como o patrimônio evolui.

## Funcionalidades

| Área | O que permite fazer |
| --- | --- |
| Contas | Organizar contas financeiras, saldos e moedas. |
| Receitas e despesas | Registrar lançamentos, categorias, vencimentos e pagamentos. |
| Transferências | Movimentar valores entre contas. |
| Parcelas e recorrências | Controlar compromissos parcelados e lançamentos periódicos. |
| Planejamento | Definir a distribuição da renda e acompanhar o consumo do orçamento. |
| Metas | Cadastrar objetivos financeiros, contribuições e participantes. |
| Patrimônio e relatórios | Acompanhar saldos, investimentos e resultados ao longo do ano. |
| Notificações | Consultar avisos e receber lembretes Web Push quando configurados. |

O acesso exige autenticação. Os dados financeiros são vinculados ao espaço familiar do usuário, com isolamento entre famílias. O cadastro cria o usuário, seu espaço familiar e as categorias iniciais.

### Primeiros passos no produto

1. Crie sua conta em `/cadastro` e entre na aplicação.
2. Cadastre suas contas financeiras e revise as categorias.
3. Registre receitas, despesas e transferências.
4. Configure recorrências, planejamento e metas conforme sua rotina.
5. Acompanhe os resultados no dashboard e no resumo anual.

## Requisitos

- Node.js 22.12 ou superior e npm.
- PostgreSQL 18 com suporte a ICU, conforme a configuração utilizada pelo projeto no Neon.
- Uma branch de desenvolvimento no Neon para executar localmente e um banco separado para produção.

O projeto utiliza Next.js, React, TypeScript e Prisma 6. As versões das dependências são definidas pelo `package-lock.json`.

## Instalação local

Os exemplos usam PowerShell. No Windows, use `npm.cmd` caso a política de execução bloqueie o comando `npm`.

### 1. Prepare o ambiente

Após clonar o repositório, abra um terminal na pasta do projeto e crie a configuração local:

```powershell
Copy-Item .env.example .env.local
```

Se `.env.local` já existir, edite o arquivo existente para preservar suas credenciais.

### 2. Configure o PostgreSQL do Neon

Obtenha as conexões pooled e direta da mesma branch e do mesmo banco no Neon. Preencha `.env.local`:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.neon.tech/estimetadb?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.neon.tech/estimetadb?sslmode=require"
AUTH_SECRET="SUBSTITUA_POR_UM_SEGREDO_ALEATORIO"
AUTH_URL="http://localhost:3000"
```

Os valores são exemplos. Use as URLs fornecidas pelo Neon, preservando os parâmetros de conexão. `DATABASE_URL` atende à aplicação e `DIRECT_URL` é usada pelo Prisma CLI. Para desenvolvimento local, selecione a branch de desenvolvimento.

Gere um segredo de autenticação e copie o resultado para `AUTH_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### 3. Instale e prepare o banco

```powershell
npm ci
npm run db:deploy
```

`npm ci` instala as dependências e gera o cliente Prisma. `db:deploy` aplica somente as migrations pendentes no banco configurado. Em um banco novo e vazio, cria a estrutura inicial; em um banco já gerenciado por estas migrations, mantém o histórico existente. Um banco com tabelas preexistentes e sem histórico Prisma exige análise antes desta etapa.

O cadastro pela aplicação cria os dados iniciais do usuário; não há uma etapa de seed obrigatória.

### 4. Inicie a aplicação

```powershell
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000). Para conferir a conexão com o banco, abra `/api/health`; o resultado esperado é:

```json
{"status":"ok","database":"connected"}
```

## Configuração de ambiente

| Arquivo | Finalidade |
| --- | --- |
| `.env.local` | Configuração privada local da aplicação e do Prisma. |
| `.env.example` | Modelo versionado, sem credenciais reais. |
| `.env.neon-test.local` | Configuração privada opcional para executar os testes de integração existentes. |

Para executar a aplicação localmente, basta `.env.local`. Não crie arquivos adicionais `.env` ou `.env.migration.local`. Next.js e Prisma carregam a configuração local; variáveis já definidas no processo têm precedência. Os arquivos privados são ignorados pelo Git e pelo deploy.

| Variável | Configuração |
| --- | --- |
| `DATABASE_URL` | Obrigatória. URL PostgreSQL pooled do Neon. |
| `DIRECT_URL` | Obrigatória para os comandos Prisma. URL direta da mesma branch e banco. |
| `AUTH_SECRET` | Obrigatória. Segredo aleatório de autenticação; preserve o valor existente em produção. |
| `AUTH_URL` | `http://localhost:3000` localmente e o domínio HTTPS da aplicação em produção. |
| `AUTH_TRUST_HOST` | Preserve se já configurada na hospedagem. |
| `CRON_SECRET` | Segredo usado para autenticar o job de notificações. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Chave pública Web Push, necessária antes do build para habilitar Push. |
| `VAPID_PRIVATE_KEY` | Chave privada Web Push, exclusiva do servidor. |
| `VAPID_SUBJECT` | Contato VAPID, por exemplo `mailto:responsavel@example.com`. |

### Notificações Web Push

Após instalar as dependências, gere um par de chaves:

```powershell
npx web-push generate-vapid-keys
```

Preencha as variáveis VAPID e gere um `CRON_SECRET` independente com o comando de geração de segredo mostrado acima. Preserve as chaves existentes se já houver dispositivos inscritos. Sem essa configuração, o envio de lembretes Push não estará disponível.

O agendamento está em `vercel.json`: chama `/api/cron/due-notifications` diariamente às 12h UTC (9h em Brasília). A execução local não inicia esse agendamento automaticamente.

## Publicação na Vercel

1. Envie o código para o repositório Git, incluindo `prisma.config.ts`, as migrations e os scripts usados pelo build.
2. Importe o repositório na Vercel como projeto Next.js, com a raiz apontando para a pasta que contém `package.json`.
3. Use `npm ci` para instalação e `npm run build` para o build, com uma versão de Node.js compatível com o requisito do projeto.
4. Configure as variáveis de **Production**: `DATABASE_URL` e `DIRECT_URL` do Neon de produção, `AUTH_SECRET` e `AUTH_URL` com o domínio HTTPS publicado. Para notificações, configure também `CRON_SECRET` e as três variáveis VAPID.
5. Confira as migrations pendentes e execute `npm run db:deploy` em um ambiente controlado com as URLs do destino correto antes de publicar uma versão que dependa delas.
6. Execute o deploy. Após mudanças nas variáveis, faça um novo deploy para incorporá-las, especialmente a chave pública VAPID.
7. Valide `/api/health`, login e as operações financeiras da versão publicada.

Configure Preview com um banco separado de produção. Os arquivos `.env.local` e `.env.neon-test.local` ficam apenas na máquina local; a Vercel utiliza suas próprias variáveis de ambiente.

O build gera o cliente Prisma e compila a aplicação. Ele não aplica migrations automaticamente. Para testar a versão de produção localmente, execute `npm run build` e depois `npm run start`.

## Banco de dados e manutenção

O histórico PostgreSQL está em `prisma/migrations`:

- `0_init_postgresql`: estrutura inicial.
- `20261113000100_text_uniqueness`: collation ICU e índices de unicidade para e-mails, categorias e participantes.

Para criar uma alteração de schema em desenvolvimento:

```powershell
npm run db:migrate -- --name nome_da_alteracao
```

Esse comando pode exigir um shadow database. Revise o SQL gerado para preservar os índices e collations adicionais. Versione a migration junto com o código correspondente e use `db:deploy` para aplicá-la em produção.

Não use `reset`, `truncate`, `db push` ou seed para atualizar um banco de produção. Mantenha backup antes de alterações de estrutura ou dados.

No Windows, pare o servidor com Ctrl+C antes de regenerar o cliente Prisma ou compilar, pois processos ativos podem bloquear sua DLL.

## Verificação e comandos úteis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento. |
| `npm run build` | Cliente Prisma e build de produção. |
| `npm run start` | Execução do build de produção. |
| `npm run lint` | Análise com ESLint. |
| `npm run typecheck` | Verificação de tipos e rotas. |
| `npm test` | Testes unitários, contratos e interface, sem banco remoto. |
| `npm run db:generate` | Regeneração do cliente Prisma. |
| `npm run db:deploy` | Aplicação das migrations pendentes. |
| `npm run db:financial-defaults` | Categorias padrão em famílias ainda não inicializadas. |
| `npm run test:postgres` | Integração real na branch de testes verificada. |
| `npm run test:http` | Testes de APIs com servidor local no mesmo banco de testes. |
| `npm run test:performance` | Medição em banco local; saída em `.tmp/performance`. |
| `npm run docs:inventory` | Exportação do inventário da API para `.tmp/api`. |

### Testes de integração

São opcionais para instalar e executar o produto. O runner atual é restrito à branch autorizada em `scripts/testing/neon-config.mjs`: valida o destino pela API Neon, recusa a branch oficial e compara os registros preexistentes antes e depois dos testes.

O arquivo privado `.env.neon-test.local` contém `DATABASE_URL` (direta), `DATABASE_URL_POOLED`, `NEON_PROJECT_ID`, `NEON_TEST_BRANCH_ID`, `NEON_TEST_BRANCH_NAME`, `NEON_TEST_ENDPOINT_ID`, `NEON_TEST_DATABASE`, `NEON_TEST_SCHEMA` e `NEON_API_KEY`. As URLs em `.env.local` devem apontar para esse mesmo destino ao executar a integração. Essas credenciais não são necessárias na Vercel.

Para testes HTTP, inicie também o servidor local. `TEST_BASE_URL`, definida no ambiente do processo ou em `.env.local`, permite informar uma origem local diferente de `http://localhost:3000`.

## Estrutura do projeto

```text
src/app/                páginas e rotas HTTP
src/components/         componentes da interface
src/services/           regras de negócio e persistência
src/lib/                autenticação, validações e infraestrutura
prisma/schema.prisma    modelo de dados PostgreSQL
prisma/migrations/      histórico de alterações do banco
public/                 recursos estáticos e service worker
scripts/                manutenção e ferramentas de desenvolvimento
scripts/testing/        validação do destino dos testes
tests/                  testes unitários e de integração
```

A documentação interativa da API fica em `/docs`, e o contrato OpenAPI em `/api/openapi`. As pastas `.tmp` e `.local` guardam artefatos locais e não são necessárias para executar o produto.
