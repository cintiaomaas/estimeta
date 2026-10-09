# estimeta

Aplicação de controle financeiro pessoal e familiar, com contas, receitas, despesas, parcelamentos, recorrências, transferências, planejamento da renda, metas e notificações de vencimento.

Este guia apresenta primeiro a instalação e a configuração; depois, as regras de negócio implementadas por funcionalidade.

## 1. O que precisa instalar

| Requisito | Uso |
| --- | --- |
| **Node.js 22.12 ou superior** | Executar a aplicação e os scripts; versão mínima definida em `package.json`. |
| **npm** | Instalar as dependências; normalmente acompanha o Node.js. |
| **MySQL 8** | Persistir os dados. Pode ser local ou um servidor acessível pela aplicação. |
| **Git** | Obter e atualizar o repositório, se ele ainda não estiver na máquina. |

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 6, Auth.js 5 beta e as demais bibliotecas são instaladas pelo npm. Não é necessário instalar Prisma ou Next.js globalmente. As versões reproduzíveis estão no `package-lock.json`.

Os exemplos abaixo usam PowerShell e `npm.cmd`, evitando conflitos com o wrapper `npm.ps1` no Windows. Em outros sistemas, use `npm` e os comandos equivalentes do seu shell.

## 2. Configuração e primeira execução

### Preparar o ambiente

Na pasta do projeto:

```powershell
cd C:\Workspace\estimetaApp
node --version
npm.cmd --version
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Gere um segredo para a autenticação:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Edite `.env` com as credenciais do banco e o segredo gerado. Preserve um `.env` já configurado.

| Variável | Quando configurar | Finalidade |
| --- | --- | --- |
| `DATABASE_URL` | Sempre | Conexão, por exemplo `mysql://USER:PASSWORD@localhost:3306/estimeta`. Codifique caracteres especiais da senha com URL encoding. |
| `AUTH_SECRET` | Sempre | Segredo gerado com pelo menos 32 bytes aleatórios para proteger a sessão. |
| `AUTH_URL` | Sempre | Origem da aplicação: `http://localhost:3000` localmente; domínio HTTPS em produção. |
| `SEED_PASSWORD` | Apenas para dados de demonstração | Senha com pelo menos 10 caracteres, uma letra e um número, limitada a 72 bytes. |
| `CRON_SECRET` | Para gerar avisos de vencimento | Segredo independente com pelo menos 32 caracteres, usado para autenticar o job. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Para Web Push | Chave pública VAPID, disponível antes do build. |
| `VAPID_PRIVATE_KEY` | Para Web Push | Chave privada do mesmo par VAPID, exclusiva do servidor. |
| `VAPID_SUBJECT` | Para Web Push | Contato do responsável, por exemplo `mailto:contato@seu-dominio.com`. |
| `TEST_BASE_URL` | Opcional, testes HTTP | Endereço da aplicação de teste; padrão `http://localhost:3000`. |

O `.env` é ignorado pelo Git. Apenas a chave VAPID pública deve ser exposta ao navegador.

### Criar o banco e instalar dependências

No MySQL, com uma conta que tenha permissão de criação:

```sql
CREATE DATABASE estimeta CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Configure `DATABASE_URL` com um usuário autorizado a acessar esse banco e aplicar as migrations. No terminal do projeto:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run dev
```

`npm ci` instala as versões do lockfile e já gera o Prisma Client pelo `postinstall`; `db:generate` também pode ser executado após mudanças no schema. `db:deploy` aplica todas as migrations pendentes e não exige shadow database.

Abra [a aplicação local](http://localhost:3000), crie seu usuário em `/cadastro` e cadastre uma conta financeira em `/contas`. As categorias padrão são criadas junto com o cadastro. Depois, registre receitas e despesas e consulte o Dashboard e o Resumo.

Verifique a conexão em [GET /api/health](http://localhost:3000/api/health): retorna HTTP 200 com `database: "connected"` ou HTTP 503 com `database: "unavailable"`.

### Dados de demonstração — opcional

Com `SEED_PASSWORD` preenchida no `.env`:

```powershell
npm.cmd run db:seed
```

O seed cria `demo@estimeta.example`, o espaço `Casa de Exemplo`, contas e lançamentos fictícios, incluindo exemplos de parcelamento, recorrência e transferência. Entre com a senha definida em `SEED_PASSWORD`. Parte dos exemplos usa setembro de 2026 e 2027: selecione essas competências para visualizá-los.

O seed pode ser repetido sem duplicar seus registros e não altera a senha de usuário já existente. Use apenas em desenvolvimento; ele recusa execução com `NODE_ENV=production`.

### Atualizar uma instalação existente

Após atualizar o código e revisar as variáveis de ambiente:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:deploy
```

Para espaços antigos que ainda não receberam categorias padrão:

```powershell
npm.cmd run db:financial-defaults
```

Esse comando inicializa apenas espaços sem a marca de inicialização; não restaura categorias que o usuário excluiu ou renomeou após a inicialização.

Para criar uma nova migration durante o desenvolvimento, use `npm.cmd run db:migrate -- --name nome_da_alteracao`. Esse comando exige permissão para criar o shadow database; para apenas instalar ou atualizar o app, use `db:deploy`.

### Build e execução em produção

Configure o banco, `AUTH_SECRET` e `AUTH_URL` com HTTPS no ambiente de destino. Aplique as migrations antes de disponibilizar a nova versão e execute:

```powershell
npm.cmd run build
npm.cmd start
```

O build gera o Prisma Client, mas não aplica migrations nem executa seed. No Windows, pare o servidor de desenvolvimento antes do build se ele estiver mantendo a DLL do Prisma em uso.

### Configurar notificações — opcional

Para gerar avisos na Central, configure `CRON_SECRET` e agende uma chamada autenticada a `GET /api/cron/due-notifications`. O agendamento do repositório em `vercel.json` é diário, às **12:00 UTC (09:00 em São Paulo)**. Fora da Vercel, configure um agendador para chamar a mesma rota. Executar `npm run dev` não inicia esse agendamento.

Para também enviar Web Push, gere o par de chaves:

```powershell
npx.cmd web-push generate-vapid-keys
```

Preencha as três variáveis VAPID no `.env`. Para gerar `CRON_SECRET`, execute novamente o comando de geração aleatória usado para `AUTH_SECRET`, produzindo outro valor. Mantenha o par VAPID estável; trocar as chaves exige reativar as inscrições. Alterar a chave pública exige novo build.

Para disparar o job manualmente em desenvolvimento, informe no terminal o mesmo segredo configurado no servidor:

```powershell
$env:CRON_SECRET = Read-Host 'Informe o CRON_SECRET configurado no servidor'
Invoke-RestMethod -Uri 'http://localhost:3000/api/cron/due-notifications' -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
Remove-Item Env:CRON_SECRET
```

Entre no app e ative o Push em **Configurações → Notificações**, em cada dispositivo desejado. É necessário HTTPS, exceto em `http://localhost` no desktop. Acesso pelo IP da rede usando HTTP não habilita Web Push. O escopo previsto é Chrome/Edge desktop e Chrome Android/PWA; Firefox depende de homologação e iOS está fora do escopo atual.

A versão com Central de Notificações exige a migration `20261009120000_notification_center`, incluída em `db:deploy`. Sessões anteriores à atualização precisam de novo login e ativação das notificações. Consulte [NOTIFICATIONS.md](NOTIFICATIONS.md) para detalhes e roteiro de homologação.

## 3. Regras de negócio por funcionalidade

### Regras comuns: dinheiro, datas e isolamento

- Os dados financeiros pertencem a um **espaço familiar** (`Household`). O servidor identifica esse espaço pela sessão e impede acesso a registros de outros espaços.
- Valores são exibidos em reais, com duas casas decimais. Lançamentos, transferências, metas e contribuições exigem valor maior que zero; saldo inicial de conta pode ser zero, mas não negativo.
- **Competência** é o mês ao qual o valor pertence e fica armazenada no primeiro dia do mês. Relatórios e saldos acumulados usam essa competência.
- **Data prevista** é o vencimento ou recebimento esperado. **Data efetiva** registra quando ocorreu o pagamento ou recebimento. Essas datas são independentes da competência.
- O calendário usado para definir hoje, atraso e vencimento amanhã é `America/Sao_Paulo`.
- Pendências não movimentam o saldo realizado. Editar ou excluir um lançamento realizado muda os cálculos da sua competência e dos saldos acumulados seguintes.

### Cadastro, login e espaço familiar

Rotas: `/cadastro`, `/login`, `/configuracoes` e `/esqueci-senha`.

- Cadastro exige nome de 2 a 100 caracteres, e-mail válido e único e senha com pelo menos 10 caracteres, uma letra e um número, limitada a 72 bytes. O formulário exige confirmação da senha.
- O e-mail é normalizado para minúsculas. O cadastro cria, de forma atômica, usuário, espaço `Casa de <nome>`, vínculo de proprietário (`OWNER`) e categorias padrão.
- Cada usuário pertence a um único espaço; o modelo permite vários membros no mesmo espaço. Convites e gerenciamento de membros ainda não estão implementados.
- Login utiliza e-mail e senha; a sessão tem validade configurada de 24 horas. Páginas e APIs financeiras exigem autenticação.
- Logout encerra a sessão e revoga as autorizações de Push associadas. Se o worker não confirmar a revogação local, a interface informa falha e não conclui a saída.
- Recuperação de senha possui somente página informativa; ainda não envia e-mails nem redefine senhas.

### Contas financeiras

Rota: `/contas`.

- Tipos disponíveis: conta corrente, poupança, dinheiro, investimento e outros. A instituição financeira é opcional e serve para identificação visual; não conecta o app ao banco.
- Cada conta tem nome, saldo inicial, estado ativo/inativo e opção de participação no saldo geral.
- O saldo de uma conta no período é: **saldo inicial + receitas recebidas − despesas pagas + transferências recebidas − transferências enviadas**, acumulados por competência até o mês consultado.
- Contas inativas preservam histórico e saldo. A opção `includeInTotalBalance` define se entram no saldo geral, independentemente de estarem ativas.
- Ao excluir uma conta que tenha vínculos com lançamentos, recorrências, transferências, metas ou contribuições, o app apenas a desativa. Sem vínculos, a exclusão é definitiva.
- Novos vínculos exigem contas ativas. Ao editar um registro existente, é permitido manter a conta inativa que já estava vinculada.

### Categorias

Rota: `/configuracoes/categorias`.

- Cada categoria pertence a receitas ou despesas. Nome e tipo não podem se repetir no mesmo espaço, inclusive entre categorias desativadas.
- O cadastro inicial fornece categorias de receita como Salário e Renda extra, e de despesa como Moradia, Alimentação e Transporte. Elas podem ser personalizadas.
- A categoria precisa corresponder ao tipo do lançamento. Novos lançamentos exigem categoria ativa; edições podem preservar o vínculo inativo original.
- Categoria usada por lançamentos ou recorrências não pode mudar de tipo. Também é necessário removê-la dos grupos de planejamento antes de mudar o tipo.
- Excluir uma categoria usada por lançamentos ou recorrências apenas a desativa, preservando o histórico. Sem esses vínculos, ela é excluída.

### Receitas, despesas e transações

Rotas: `/receitas`, `/despesas` e `/transacoes`.

- Todo lançamento exige descrição, valor positivo, conta, categoria, competência, data prevista e status. Observações são opcionais.
- Receita pode estar **prevista** (`PENDING`) ou **recebida** (`RECEIVED`). Despesa pode estar **prevista** (`PENDING`) ou **paga** (`PAID`).
- Lançamento realizado exige data efetiva. Lançamento previsto não pode ter data efetiva.
- **Atrasada** é uma classificação calculada para despesa pendente cujo vencimento é anterior a hoje; não é um status gravado. Receita pendente continua prevista mesmo após a data esperada.
- O filtro de previstas separa as despesas atrasadas. Mês/ano filtram competência; busca usa a descrição. Também há filtros por conta, categoria, tipo e status, ordenação e paginação.
- Edição altera somente o lançamento escolhido. Exclusão remove o lançamento e recalcula os resultados; avisos já registrados na Central permanecem no histórico.
- Nos detalhes, **Repetir** abre um novo formulário copiando tipo, descrição, conta, categoria e observações. Sugere o próximo mês para competência e vencimento, limpa o valor e a data efetiva e define o status como previsto. Só cria o novo registro ao salvar, sem vínculo automático com o original.

### Parcelamento de despesas

Disponível no formulário de nova despesa.

- O valor informado é o **total da compra**, dividido em 2 a 360 parcelas, com mínimo de R$ 0,01 por parcela.
- A divisão preserva o total exato: centavos restantes são distribuídos nas primeiras parcelas. Exemplo: R$ 100,00 em três parcelas resulta em R$ 33,34, R$ 33,33 e R$ 33,33.
- Todas as parcelas são criadas como despesas previstas, sem data efetiva, com competência e vencimento avançando mensalmente. Dias inexistentes são ajustados ao último dia do mês.
- Cada parcela pode ser editada, paga ou excluída individualmente. Excluir uma não exclui as demais; seu tipo deve permanecer despesa.

### Recorrências mensais

Rota: `/recorrencias`.

- Receitas e despesas podem ter recorrência mensal, com valor fixo, dia de vencimento de 1 a 31, início, término opcional e estado ativo/inativo. O término não pode anteceder o início.
- Ao criar a regra, o app tenta gerar até três competências a partir do mês atual ou do início futuro, respeitando a vigência. Os lançamentos gerados são previstos.
- Nos meses seguintes, use **Gerar competência**. O job de notificações não gera recorrências.
- Existe no máximo uma ocorrência por regra e competência. Gerar novamente um mês que já tem lançamento não cria duplicata. Se o lançamento foi excluído, uma geração manual explícita permite recriá-lo.
- O vencimento deve estar dentro da vigência. Dia 31 em um mês mais curto é ajustado ao último dia desse mês.
- Alterar a regra afeta apenas gerações futuras; os lançamentos existentes permanecem iguais. Desativar impede novas gerações e preserva os lançamentos anteriores.
- Edições concorrentes são recusadas quando a revisão está desatualizada; reabra a regra antes de salvar.

### Transferências entre contas

Rota: `/transferencias`.

- Origem e destino devem ser contas diferentes do mesmo espaço; novos vínculos exigem contas ativas. Valor deve ser positivo, com data da transferência e competência informadas.
- Transferência debita a origem e credita o destino por competência. Não é receita nem despesa e não altera a economia do mês.
- Entre duas contas incluídas no saldo geral, o efeito consolidado é zero. Se apenas uma participa do saldo geral, o consolidado muda. Não há bloqueio por saldo insuficiente na origem.
- Editar ou excluir recalcula os saldos. Se houver contribuição de meta vinculada, remova esse vínculo antes de editar ou excluir a transferência.

### Planejamento da renda

Rota: `/configuracoes/planejamento`; acompanhamento no Dashboard.

- Planejamento é configurado por espaço e pode ser ativado ou desativado. A base é a receita recebida da competência ou uma renda manual de referência maior que zero.
- Grupos possuem nome, percentual da renda, percentual de alerta, categorias de despesa e estado ativo/inativo. São permitidos até 50 grupos.
- Percentuais de grupo e alerta devem ser maiores que zero e no máximo 100%, com até duas casas decimais. A soma dos grupos ativos não pode ultrapassar 100%; pode sobrar renda não distribuída.
- Uma categoria não pode se repetir no mesmo grupo nem pertencer a dois grupos ativos. Só são aceitas categorias de despesa do espaço.
- **Planejado = renda de referência × percentual do grupo. Comprometido = despesas pagas + previstas**, incluindo atrasadas, nas categorias do grupo e na competência selecionada.
- O alerta é calculado sobre o valor planejado do grupo. Os estados são dentro do limite, próximo do limite, limite atingido e excedido; sem renda positiva, a avaliação fica indisponível.
- Despesas fora dos grupos ativos aparecem como não classificadas. O planejamento não cria lançamentos nem movimenta contas.
- A configuração atual é usada ao consultar os períodos; não existe versão histórica por mês. Alterações concorrentes exigem recarregar antes de salvar.

### Metas financeiras, participantes e contribuições

Rota: `/metas`; resumo de metas ativas no Dashboard.

- Uma meta tem nome, valor-alvo positivo, data inicial, prazo opcional, descrição/ícone opcionais e conta de referência opcional. O prazo não pode anteceder o início.
- Estados: ativa, concluída e arquivada. Atingir o valor-alvo sinaliza o progresso, mas a mudança de estado é manual. Reative metas concluídas ou arquivadas antes de editar seus dados, participantes ou contribuições.
- Participantes são nomes associados à meta, não usuários com acesso ao app. Os nomes são únicos dentro da meta e podem ser desativados, preservando contribuições anteriores.
- Contribuição exige valor positivo, data e competência; participante, conta, transferência e descrição são opcionais. Novos vínculos exigem participante ativo da própria meta e conta ativa do espaço.
- **Contribuições não criam receitas, despesas ou transferências e não alteram saldos de contas.** A conta da meta é uma referência, sem sincronização automática com seu saldo.
- Uma transferência existente pode ser vinculada a uma única contribuição. Valor, data, competência e conta da contribuição devem corresponder à transferência e à conta de destino.
- Remover uma contribuição preserva a transferência vinculada. Após ter qualquer contribuição, a meta mantém a marca de histórico e não pode ser excluída definitivamente, mesmo se todas as contribuições forem removidas; use arquivamento.
- Progresso soma contribuições até a competência consultada e pode ultrapassar 100%. O restante nunca é negativo. A sugestão mensal divide o restante pelos meses até o prazo, incluindo os meses inicial e final do intervalo, e arredonda para cima em centavos.

### Dashboard mensal

Rota: `/dashboard`.

- Receitas e despesas realizadas consideram apenas recebidas e pagas da competência selecionada. **Economia do mês = receitas recebidas − despesas pagas.**
- O saldo geral acumula os movimentos até essa competência e os saldos iniciais das contas incluídas; não é apenas o resultado do mês.
- Previsões de receita, despesas previstas e despesas atrasadas são apresentadas separadamente. Atraso é avaliado em relação a hoje, mesmo ao consultar um mês antigo.
- Exibe comparação com o mês anterior, evolução de seis meses, despesas pagas por categoria, cinco maiores despesas pagas e cinco lançamentos mais recentes do período.
- Quando a base do mês anterior é zero, a comparação percentual fica indisponível. O Dashboard também apresenta planejamento e resumo das metas ativas.

### Resumo anual e patrimônio

Rota: `/resumo`.

- Exibe receitas recebidas e despesas pagas por categoria e competência nos 12 meses do ano, totais, médias, economia e saldo acumulado de cada mês. Categorias inativas com movimento realizado no ano continuam aparecendo.
- Total anual soma os 12 meses. Médias usam 12 meses para anos anteriores, de janeiro até o mês atual para o ano corrente e ficam indisponíveis para anos futuros.
- O saldo anual é o saldo acumulado ao final de dezembro; não é a soma dos 12 saldos mensais.
- **Patrimônio total** soma os saldos de todas as contas, incluindo investimentos, contas inativas e contas excluídas do saldo geral, contando cada conta uma vez.
- O patrimônio usa a competência do mês atual, independentemente do ano selecionado no relatório. Não inclui contribuições de metas como um valor adicional.

### Central de Notificações e Web Push

Rotas: `/notificacoes` e `/configuracoes`.

- O job seleciona despesas previstas com vencimento **amanhã**, no calendário brasileiro. Parcelas e recorrências participam quando já existem como lançamentos.
- O destinatário é o autor do lançamento, desde que ainda pertença ao espaço da despesa. O aviso não é enviado automaticamente aos demais membros.
- O aviso é registrado na Central mesmo sem inscrição de Push. A chave de usuário, lançamento, tipo e vencimento impede duplicação em reexecuções.
- A Central preserva descrição, valor e competência registrados no aviso. Excluir a despesa mantém o aviso, mas remove o vínculo para abrir a origem.
- A listagem tem 20 itens por página. Apenas abrir a Central não marca tudo como lido; selecionar um aviso, abri-lo pelo Push ou usar as ações de leitura atualiza o estado. Leitura é individual por usuário e compartilhada entre seus dispositivos.
- O sino mostra a quantidade de não lidas; contador e lista atualizam ao retomar a janela e a cada minuto. Links de aviso exigem sessão e acesso do proprietário.
- Push é opcional e ativado explicitamente por dispositivo. O app envia para inscrições ativas com sessão válida; respostas 404/410 do provedor desativam a inscrição afetada.
- Detalhes financeiros só são exibidos pelo worker com autorização local válida para usuário, sessão, dispositivo e prazo. Fechar a PWA não encerra a sessão. Descrição, valor e vencimento podem aparecer na tela bloqueada conforme a configuração do sistema.
- A entrega é deduplicada por aviso/dispositivo. Aceite pelo provedor não comprova leitura nem exibição; tentativas com resultado incerto não são reenviadas automaticamente.

### PWA e navegação

- O app fornece manifest e ícones para instalação nos navegadores compatíveis.
- O service worker trata Push e abertura de notificações. Não implementa uso financeiro offline nem cache das requisições financeiras.
- Sem conexão, as operações que dependem do servidor ficam indisponíveis. O armazenamento local do worker mantém dados de autorização de Push, sem conteúdo financeiro.

## 4. Verificações e manutenção

| Comando | Finalidade |
| --- | --- |
| `npm.cmd run lint` | Análise estática com ESLint. |
| `npm.cmd run typecheck` | Gerar tipos de rotas e verificar TypeScript. |
| `npm.cmd test` | Testes unitários e de interface. |
| `npm.cmd run test:mysql` | Integração com MySQL real, configurado no `.env`. |
| `npm.cmd run test:http` | Integração das APIs com servidor em execução, no mesmo banco de teste. |
| `npm.cmd run build` | Verificar e gerar o build de produção. |
| `npm.cmd run docs:inventory` | Gerar inventário da API em `docs/fase6/` (diretório ignorado pelo Git). |
| `npm.cmd run test:performance` | Medir consultas em banco local de desenvolvimento. |

Use banco dedicado de desenvolvimento ou homologação para testes de integração: as suítes criam e removem dados temporários. `TEST_BASE_URL` e `DATABASE_URL` devem apontar para o mesmo ambiente de teste, nunca para produção.

### Problemas comuns

| Sintoma | O que verificar |
| --- | --- |
| `npm.ps1` falha no PowerShell | Use `npm.cmd`; se também falhar, revise a instalação do Node.js/npm. |
| Banco indisponível | MySQL em execução, host/porta acessíveis, banco criado e credenciais em `DATABASE_URL`. |
| Tabelas ou colunas ausentes | Execute `db:deploy` no banco configurado e `db:generate`; reinicie a aplicação. |
| Erro de shadow database | Para aplicar migrations existentes use `db:deploy`; reserve `db:migrate` para criar migrations. |
| Login não funciona após configuração | Revise `AUTH_SECRET`, `AUTH_URL` e a conexão com o banco; reinicie o servidor. |
| Push não pode ser ativado | Confira HTTPS/localhost, permissão do navegador, chaves VAPID e novo login após atualização. |
| Avisos de vencimento não aparecem | Confira agendamento, Bearer `CRON_SECRET` e existência de despesas previstas para amanhã. |

### Organização do código e API

```text
src/app/                páginas, layouts e rotas HTTP
src/components/         interfaces de finanças, relatórios, planejamento, metas e notificações
src/services/           regras de negócio e consultas ao banco
src/lib/validations/    validações dos dados de entrada
src/lib/finance/        cálculos de datas, saldos, planejamento e metas
src/lib/auth/           autenticação e proteção de acesso
src/lib/push/           autorização e entrega Web Push
prisma/                 modelo de dados, migrations e seed
public/                 ícones, recursos estáticos e service worker
scripts/                manutenção e geração de documentação
tests/                  testes unitários, de interface e integração
```

O contrato OpenAPI está disponível em [GET /api/openapi](http://localhost:3000/api/openapi). As APIs de negócio exigem sessão; o job usa Bearer `CRON_SECRET`. Erros de negócio seguem `{ "error": { "code": "...", "message": "..." } }`; Auth.js e health usam seus formatos próprios.

As regras acima descrevem o código atual. As principais referências para evolução são [serviços](src/services/), [validações](src/lib/validations/) e [schema do banco](prisma/schema.prisma). Antes de alterar código Next.js, leia o guia pertinente em `node_modules/next/dist/docs/`, conforme as instruções do projeto.
