import { z } from "zod";
import { registerSchema } from "../validations/auth";
import { accountSchema, categorySchema, transactionSchema, transactionFilterSchema, categoryFilterSchema } from "../validations/finance";
import { installmentSchema, recurringSchema, transferSchema, generationSchema, advancedFilters } from "../validations/advanced";
import { goalSchema, goalStateSchema, participantSchema, contributionSchema, goalFilters, goalPeriod } from "../validations/goals";
import { planningSchema } from "../validations/planning";
import { pushEndpointSchema, pushSubscriptionSchema } from "../validations/push";

// Documentation only. Runtime validation and financial services remain the source of truth.
type Schema = Record<string, unknown>;
type Operation = { tags: string[]; summary: string; description: string; operationId: string; security: object[]; parameters: object[]; requestBody?: object; responses: Record<string, object> };
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const string = { type: "string" };
const bool = { type: "boolean" };
const integer = { type: "integer" };
const uuid = { type: "string", format: "uuid" };
const date = { type: "string", format: "date" };
const timestamp = { type: "string", format: "date-time" };
const decimal = { type: "string", pattern: "^-?\\d+\\.\\d{2}$", examples: ["350.50"], description: "Decimal serializado como string; nunca um float JSON." };
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: "null" }] });
const array = (items: Schema): Schema => ({ type: "array", items });
const object = (properties: Record<string, Schema>, required = Object.keys(properties)): Schema => ({ type: "object", properties, required });
const enumString = (...values: string[]): Schema => ({ type: "string", enum: values });
const json = (schema: Schema) => ({ "application/json": { schema } });
const envelope = (schema: Schema) => object({ data: schema });
function fromZod(schema: z.ZodType): Schema {
  const result = z.toJSONSchema(schema, { io: "input", target: "draft-2020-12" });
  delete result.$schema;
  return result;
}
const inputs = { RegisterRequest: registerSchema, AccountRequest: accountSchema, CategoryRequest: categorySchema, TransactionRequest: transactionSchema, InstallmentRequest: installmentSchema, RecurringRequest: recurringSchema, TransferRequest: transferSchema, GenerationRequest: generationSchema, GoalRequest: goalSchema, GoalStateRequest: goalStateSchema, ParticipantRequest: participantSchema, ContributionRequest: contributionSchema, PlanningRequest: planningSchema };
const named = object({ name: string });
const identity = { id: uuid, householdId: uuid };
const audit = { createdBy: uuid, createdAt: timestamp, updatedAt: timestamp };
const account = { ...identity, name: string, bankCode: nullable(string), type: enumString("CHECKING", "SAVINGS", "CASH", "INVESTMENT", "OTHER"), initialBalance: decimal, isActive: bool, includeInTotalBalance: bool, createdAt: timestamp, updatedAt: timestamp };
const transaction = { ...identity, ...audit, accountId: uuid, categoryId: uuid, type: enumString("INCOME", "EXPENSE"), description: string, amount: decimal, scheduledDate: date, competenceDate: date, transactionDate: nullable(date), status: enumString("PENDING", "RECEIVED", "PAID"), notes: nullable(string), installmentPlanId: nullable(uuid), installmentNumber: nullable(integer), installmentCount: nullable(integer), recurringOccurrenceId: nullable(uuid) };
const relation = object({ id: uuid, name: string, isActive: bool });
const progress = { totalContributed: decimal, remainingAmount: decimal, progressPercentage: decimal, reached: bool, monthsRemaining: integer, suggestedMonthly: nullable(decimal), deadlineStatus: string };
const financialTotals = { income: decimal, expenses: decimal, netSavings: decimal };
const reportTransaction = object({ id: uuid, type: enumString("INCOME", "EXPENSE"), description: string, amount: decimal, status: enumString("PENDING", "RECEIVED", "PAID"), scheduledDate: date, competenceDate: date, transactionDate: nullable(date), displayStatus: enumString("PENDING", "RECEIVED", "PAID", "OVERDUE"), account: named, category: named });
const contribution = object({ id: uuid, participantId: nullable(uuid), accountId: nullable(uuid), transferId: nullable(uuid), amount: decimal, contributionDate: date, competenceDate: date, description: nullable(string), account: nullable(named) });
const planningGroup = object({ name: string, percentage: decimal, alertPercentage: decimal, planned: decimal, committed: decimal, incomePercentage: nullable(decimal), utilizationPercentage: nullable(decimal), remaining: nullable(decimal), excess: nullable(decimal), excessPercentagePoints: nullable(decimal), state: enumString("UNAVAILABLE", "EXCEEDED", "REACHED", "NEAR", "WITHIN") });
const comparison = nullable(decimal);
const categoryAnnual = object({ id: uuid, name: string, type: enumString("INCOME", "EXPENSE"), isActive: bool, months: { ...array(decimal), minItems: 12, maxItems: 12 }, total: decimal, average: nullable(decimal) });
export const schemas: Record<string, Schema> = {
  ...Object.fromEntries(Object.entries(inputs).map(([name, schema]) => [name, fromZod(schema)])),
  Error: object({ error: object({ code: string, message: string }) }),
  Id: object({ id: uuid }), Message: object({ message: string }), Deletion: object({ message: string, deactivated: bool }),
  Pagination: object({ page: integer, limit: integer, total: integer }),
  TransactionPagination: object({ page: integer, limit: integer, total: integer, totalPages: integer }),
  Account: object(account), AccountBalance: object({ ...account, balance: decimal, balancePeriod: { type: "string", pattern: "^\\d{4}-\\d{2}$" } }),
  Category: object({ ...identity, name: string, type: enumString("INCOME", "EXPENSE"), isActive: bool, createdAt: timestamp, updatedAt: timestamp }),
  Transaction: object({ ...transaction, account: relation, category: relation, displayStatus: enumString("PENDING", "RECEIVED", "PAID", "OVERDUE") }),
  InstallmentTransaction: object({ ...transaction, createdAt: date, updatedAt: date }),
  Installment: object({ ...identity, ...audit, description: string, totalAmount: decimal, installmentCount: integer, firstCompetenceDate: date }),
  InstallmentDetail: { allOf: [ref("Installment"), object({ transactions: array(ref("InstallmentTransaction")) })] },
  Recurring: object({ ...identity, ...audit, createdAt: date, updatedAt: date, accountId: uuid, categoryId: uuid, type: enumString("INCOME", "EXPENSE"), description: string, amount: decimal, frequency: { const: "MONTHLY" }, startDate: date, endDate: nullable(date), dayOfMonth: integer, isActive: bool, notes: nullable(string), revision: integer, account: named, category: named, nextScheduledDate: nullable(date) }),
  Transfer: object({ ...identity, ...audit, createdAt: date, updatedAt: date, sourceAccountId: uuid, destinationAccountId: uuid, amount: decimal, transferDate: date, competenceDate: date, description: string, notes: nullable(string), sourceAccount: named, destinationAccount: named }),
  Generation: object({ generated: bool, reason: enumString("CREATED", "INACTIVE", "BEFORE_START", "AFTER_END", "ALREADY_EXISTS", "DELETED"), message: string, transactionId: nullable(uuid), competenceDate: date }),
  Goal: object({ id: uuid, name: string, description: nullable(string), icon: nullable(string), targetAmount: decimal, startDate: date, targetDate: nullable(date), status: enumString("ACTIVE", "COMPLETED", "ARCHIVED"), accountId: nullable(uuid), account: nullable(named), through: date, ...progress, canDelete: bool, participants: array(object({ id: uuid, name: string, isActive: bool, totalContributed: decimal, percentage: decimal })), contributions: array(contribution), evolution: array(object({ month: string, amount: decimal, accumulated: decimal })) }),
  Planning: z.toJSONSchema(planningSchema, { io: "output", target: "draft-2020-12" }),
  PlanningReport: object({ enabled: bool, incomeSource: enumString("REALIZED", "MANUAL"), referenceIncome: decimal, available: bool, totalPercentage: decimal, remainingPercentage: decimal, unclassified: decimal, groups: array(planningGroup) }),
  GoalsSummary: object({ activeCount: integer, targetAmount: decimal, totalContributed: decimal, progressPercentage: decimal, items: array(object({ id: uuid, name: string, targetAmount: decimal, ...progress })) }),
  Dashboard: object({ goals: ref("GoalsSummary"), planning: ref("PlanningReport"), period: object({ year: integer, month: integer }), asOf: date, balance: decimal, balanceKind: { const: "period" }, accountCount: integer, ...financialTotals, pendingIncome: decimal, pendingExpenses: decimal, overdueExpenses: decimal, comparison: object({ income: comparison, expenses: comparison, netSavings: comparison }), expensesByCategory: array(object({ id: uuid, name: string, amount: decimal, percentage: decimal })), topExpenses: array(reportTransaction), recentTransactions: array(reportTransaction), trend: array(object({ year: integer, month: integer, ...financialTotals })), availableYears: array(integer) }),
  Annual: object({ year: integer, averageMonths: integer, availableYears: array(integer), monthlySummary: array(object({ month: integer, ...financialTotals, balance: decimal })), annualTotals: object({ ...financialTotals, balance: decimal }), averages: object({ income: nullable(decimal), expenses: nullable(decimal), netSavings: nullable(decimal) }), incomeCategories: array(categoryAnnual), expenseCategories: array(categoryAnnual) }),
  PublicUser: object({ id: uuid, name: string, email: { type: "string", format: "email" }, createdAt: timestamp }),
  CurrentUser: { allOf: [ref("PublicUser"), object({ membership: nullable(object({ role: enumString("OWNER", "MEMBER"), household: object({ id: uuid, name: string }) })) })] },
};
delete schemas.Planning.$schema;
// Refinements/transforms cannot all be expressed in JSON Schema: document, don't duplicate validation.
const rules: Record<string, string> = {
  RegisterRequest: "E-mail normalizado. Extras descartados. Senha: mínimo 10 caracteres, letra, número, máximo 72 bytes UTF-8. Autor e Household são criados pelo servidor.",
  TransactionRequest: "Valor > 0. Datas reais entre 1000 e 9999. Competência normalizada para dia 01. INCOME: PENDING/RECEIVED; EXPENSE: PENDING/PAID. Data efetiva obrigatória para realizado e nula para PENDING. Conta/categoria do Household, categoria compatível e referências ativas em novos vínculos.",
  InstallmentRequest: "Despesa PENDING, total dividido exatamente em 2–360 parcelas; cada parcela >= 0,01; calendário não pode exceder 9999. Competência e vencimento avançam separadamente.",
  RecurringRequest: "Mensal; término >= início; revisão atual obrigatória na edição (409 se antiga). Criação gera até três competências elegíveis. Na listagem, year/month são aceitos e validados mas não filtram regras.",
  TransferRequest: "Contas distintas do Household; competência normalizada. Transferência vinculada a meta não pode ser editada/excluída (409).",
  GoalRequest: "Alvo > 0, prazo >= início. Participantes iniciais somente na criação; PUT deve omitir participants ou enviar []. Edição exige meta ACTIVE. Retorna somente id.",
  ContributionRequest: "Meta ativa; participante da mesma meta. Transferência exige valor integral, conta de destino, data e competência correspondentes e vínculo único. Não altera receitas/despesas/saldo.",
  PlanningRequest: "Grupos ativos somam até 100%; categoria EXPENSE do Household não pode estar em dois grupos ativos. Fonte MANUAL exige renda > 0. Revisão protege edições concorrentes (409).",
};
for (const [name, description] of Object.entries(rules)) schemas[name].description = description;
schemas.TransactionRequest.examples = [{ accountId: "11111111-1111-4111-8111-111111111111", categoryId: "22222222-2222-4222-8222-222222222222", type: "EXPENSE", description: "Supermercado", amount: "350.50", scheduledDate: "2027-01-10", competenceDate: "2027-01-01", status: "PENDING", transactionDate: null }];

function parameters(schema?: z.ZodType): object[] {
  if (!schema) return [];
  const converted = fromZod(schema) as { properties: Record<string, Schema>; required?: string[] };
  return Object.entries(converted.properties).map(([name, value]) => ({ name, in: "query", required: converted.required?.includes(name) ?? false, schema: value }));
}
const paths: Record<string, Record<string, Operation>> = {};
const errorDescriptions: Record<number, string> = { 400: "Entrada inválida, JSON malformado ou referência não permitida.", 401: "Sessão ausente, expirada ou usuário removido.", 403: "Sem Household ou origem de mutação não permitida.", 404: "Recurso não encontrado neste Household/meta.", 409: "Conflito de unicidade, revisão, vínculo ou histórico.", 500: "Falha interna; mensagem controlada, sem detalhes técnicos." };
function add(path: string, method: string, tag: string, summary: string, response: Schema, options: { body?: string; query?: z.ZodType; status?: number; public?: boolean; errors?: number[]; description?: string; raw?: boolean } = {}) {
  const status = options.status ?? 200;
  const params = [...path.matchAll(/\{([^}]+)\}/g)].map(match => ({ name: match[1], in: "path", required: true, schema: uuid, description: "ID do recurso; IDs inexistentes ou de outro Household retornam 404." }));
  const operation: Operation = {
    tags: [tag], summary, description: options.description ?? "Household e autor derivados exclusivamente da sessão. Valores monetários em strings decimais. Respostas financeiras private, no-store.",
    operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`,
    security: options.public ? [] : [{ sessionCookie: [] }, { secureSessionCookie: [] }],
    parameters: [...params, ...parameters(options.query)],
    responses: { [status]: { description: status === 201 ? "Criado." : "Sucesso.", content: json(options.raw ? response : envelope(response)) }, ...Object.fromEntries((options.errors ?? [400, 401, 403, 404, 409, 500]).map(code => [code, { description: errorDescriptions[code], content: json(ref("Error")) }])) },
    ...(options.body ? { requestBody: { required: true, content: json(ref(options.body)) } } : {}),
  };
  (paths[path] ??= {})[method] = operation;
}
const readErrors = [400, 401, 403, 500];
schemas.PushSubscriptionRequest = fromZod(pushSubscriptionSchema);
schemas.PushEndpointRequest = fromZod(pushEndpointSchema);
add("/api/push/subscriptions", "post", "Notifications", "Ativar Web Push neste dispositivo", object({ active: bool }), { body: "PushSubscriptionRequest", errors: [400, 401, 403, 409, 500], description: "Endpoint HTTPS de provedor permitido; chaves base64url. Proprietário exclusivamente da sessão, nunca transfere inscrição de outra conta." });
add("/api/push/subscriptions", "delete", "Notifications", "Desativar Web Push neste dispositivo", object({ active: bool }), { body: "PushEndpointRequest", errors: [400, 401, 403, 500], description: "Idempotente e limitada ao usuário autenticado. Não afeta outros dispositivos." });
add("/api/push/subscriptions/status", "post", "Notifications", "Consultar inscrição do dispositivo", object({ active: bool }), { body: "PushEndpointRequest", errors: [400, 401, 403, 500], description: "Endpoint no corpo, sem expor subscriptions em URLs ou respostas. Retorna somente o estado da própria conta." });
const jobCounts = object({ selected: integer, sent: integer, skipped: integer, failed: integer, expired: integer, incomplete: bool });
add("/api/cron/due-notifications", "get", "Notifications", "Verificar despesas vencendo amanhã", jobCounts, { errors: [401, 500], description: "Interna: Bearer CRON_SECRET (mínimo 32 caracteres), inclusive local. Diária 12:00 UTC. Não aceita data ou usuário do cliente. Reserva persistente por dispositivo antes do envio." });
paths["/api/cron/due-notifications"].get.security = [{ cronBearer: [] }];
paths["/api/cron/due-notifications"].get.responses["503"] = { description: "Configuração ausente ou orçamento de execução esgotado (incomplete=true); repetir com o mesmo secret.", content: json({ oneOf: [ref("Error"), envelope(jobCounts)] }) };
const listDescriptions: Record<string, string> = {
  Account: "Contas do Household, inclusive inativas, com saldo. Sem filtros: mês atual no Brasil; somente year: dezembro; month exige year. Lista sem paginação.",
  Category: "Categorias do Household, inclusive inativas. Filtro opcional type. Lista sem paginação.",
  Transaction: "Paginação padrão 1/20, máximo 100. year/month por competência (month exige year); startDate/endDate por vencimento. PENDING exclui despesas atrasadas; OVERDUE é derivado. Busca por descrição; sort=date usa vencimento.",
  Transfer: "Paginação padrão 1/20, máximo 100, sem totalPages na resposta. year/month por competência; month exige year. accountId seleciona origem ou destino. Busca por descrição.",
  Recurring: rules.RecurringRequest + " Paginação padrão 1/20, máximo 100, sem totalPages na resposta; filtro por conta e descrição.",
};
const paged = (name: string, full = false) => object({ data: array(ref(name)), pagination: ref(full ? "TransactionPagination" : "Pagination") });
for (const [path, tag, name, filter, paginated] of [
  ["accounts", "Accounts", "Account", z.object({ year: transactionFilterSchema.shape.year, month: transactionFilterSchema.shape.month }), false],
  ["categories", "Categories", "Category", categoryFilterSchema, false],
  ["transactions", "Transactions", "Transaction", transactionFilterSchema, true],
  ["transfers", "Transfers", "Transfer", advancedFilters, true],
  ["recurring-transactions", "Recurring Transactions", "Recurring", advancedFilters, true],
] as const) {
  add(`/api/${path}`, "get", tag, `Listar ${path}`, paginated ? paged(name, name === "Transaction") : array(ref(name === "Account" ? "AccountBalance" : name)), { query: filter, raw: paginated, errors: readErrors, description: listDescriptions[name] });
  add(`/api/${path}`, "post", tag, `Criar ${path}`, ref(name), { body: `${name}Request`, status: 201, errors: [400, 401, 403, 409, 500] });
  add(`/api/${path}/{id}`, "get", tag, `Consultar ${path}`, ref(name), { errors: [401, 403, 404, 500] });
  add(`/api/${path}/{id}`, "put", tag, `Editar ${path}`, ref(name), { body: `${name}Request` });
  add(`/api/${path}/{id}`, "delete", tag, name === "Recurring" ? "Desativar recorrência; preservar ocorrências" : `Excluir ${path}`, ref(name === "Account" || name === "Category" ? "Deletion" : "Message"), { errors: [401, 403, 404, 409, 500], description: "Contas/categorias em uso são desativadas. Recorrências são desativadas. Transações/transferências são excluídas conforme vínculos existentes." });
}
add("/api/installment-plans", "post", "Installments", "Criar plano e parcelas atomicamente", ref("Installment"), { body: "InstallmentRequest", status: 201, errors: [400, 401, 403, 409, 500] });
add("/api/installment-plans/{id}", "get", "Installments", "Consultar plano e parcelas remanescentes", ref("InstallmentDetail"), { errors: [401, 403, 404, 500] });
add("/api/recurring-transactions/{id}/generate", "post", "Recurring Transactions", "Gerar competência idempotentemente", ref("Generation"), { body: "GenerationRequest", description: "Retorna 200 tanto para criação quanto para resultado sem geração. Chamada explícita pode recriar ocorrência excluída; criação automática não recria. Não duplica lançamento existente." });
add("/api/goals", "get", "Goals", "Listar metas com histórico e progresso", paged("Goal"), { query: goalFilters, raw: true, errors: readErrors });
add("/api/goals", "post", "Goals", "Criar meta", ref("Id"), { body: "GoalRequest", status: 201, errors: [400, 401, 403, 409, 500] });
add("/api/goals/{id}", "get", "Goals", "Consultar meta", ref("Goal"), { query: goalPeriod, errors: [400, 401, 403, 404, 500], description: "through seleciona competência de corte, padrão hoje no Brasil. Histórico inclui contribuições futuras; totais/evolução respeitam corte. Configuração/status atuais, sem versionamento histórico." });
add("/api/goals/{id}", "put", "Goals", "Editar meta ativa", ref("Id"), { body: "GoalRequest" });
add("/api/goals/{id}", "patch", "Goals", "Concluir, arquivar ou reativar meta", ref("Id"), { body: "GoalStateRequest" });
add("/api/goals/{id}", "delete", "Goals", "Excluir meta sem histórico", ref("Message"), { errors: [401, 403, 404, 409, 500], description: "Exclusão definitiva somente sem histórico. GOAL_HAS_HISTORY (409) mesmo após remover contribuições; arquivamento é PATCH status ARCHIVED." });
for (const [resource, childId, body] of [["participants", "participantId", "ParticipantRequest"], ["contributions", "contributionId", "ContributionRequest"]]) {
  add(`/api/goals/{id}/${resource}`, "post", "Goals", `Adicionar ${resource}`, ref("Id"), { body, status: 201 });
  add(`/api/goals/{id}/${resource}/{${childId}}`, "put", "Goals", `Editar ${resource}`, ref("Id"), { body });
}
add("/api/goals/{id}/contributions/{contributionId}", "delete", "Goals", "Remover contribuição preservando Transfer", ref("Message"));
add("/api/planning", "get", "Planning", "Consultar planejamento", ref("Planning"), { errors: [401, 403, 500] });
add("/api/planning", "put", "Planning", "Salvar planejamento com revisão", ref("Planning"), { body: "PlanningRequest", errors: [400, 401, 403, 409, 500] });
const reportQuery = { year: z.coerce.number().int().min(1000).max(9999).optional(), month: z.coerce.number().int().min(1).max(12).optional() };
add("/api/dashboard", "get", "Dashboard", "Resumo mensal", ref("Dashboard"), { query: z.object(reportQuery), errors: readErrors, description: "Ano/mês padrão: atuais em America/Sao_Paulo. Saldo sempre limitado ao fim da competência; previsões não alteram realizados. Transferências não entram em receitas/despesas/economia." });
add("/api/reports/annual", "get", "Reports", "Resumo anual", ref("Annual"), { query: z.object({ year: reportQuery.year }), errors: readErrors, description: "Ano padrão atual no Brasil. Doze meses; saldo anual é dezembro, não a soma mensal. Média indisponível em ano futuro." });
add("/api/auth/register", "post", "Authentication", "Cadastrar usuário e Household", object({ user: ref("PublicUser") }), { public: true, status: 201, body: "RegisterRequest", errors: [400, 409, 500], description: rules.RegisterRequest });
add("/api/users/me", "get", "Authentication", "Usuário e vínculo da sessão", object({ user: ref("CurrentUser") }), { errors: [401, 500] });
add("/api/health", "get", "Health", "Disponibilidade da aplicação e MySQL", object({ status: { const: "ok" }, database: { const: "connected" } }), { public: true, raw: true, errors: [], description: "Executa SELECT 1. Público, no-store; não retorna versões, host ou credenciais." });
paths["/api/health"].get.responses["503"] = { description: "Banco indisponível.", content: json(object({ status: { const: "error" }, database: { const: "unavailable" } })) };

// Concrete Auth.js actions handled by the existing catch-all, not duplicate route handlers.
for (const [path, method, summary, schema] of [
  ["/api/auth/csrf", "get", "Obter token CSRF Auth.js", object({ csrfToken: string })],
  ["/api/auth/session", "get", "Consultar sessão Auth.js", { anyOf: [{ type: "null" }, object({ user: object({ id: uuid, name: string, email: string }), expires: timestamp })] }],
  ["/api/auth/session", "post", "Atualizar sessão pelo protocolo Auth.js", { anyOf: [{ type: "null" }, object({ user: object({ id: uuid, name: string, email: string }), expires: timestamp })] }],
  ["/api/auth/providers", "get", "Consultar provedores Auth.js", object({ credentials: object({ id: string, name: string, type: string, signinUrl: string, callbackUrl: string }) })],
  ["/api/auth/signin", "get", "Página de login (redirecionamento configurado)", string],
  ["/api/auth/signin", "post", "Iniciar fluxo Auth.js (Credentials usa callback)", string],
  ["/api/auth/signout", "get", "Página de confirmação Auth.js", string],
  ["/api/auth/signout", "post", "Encerrar sessão Auth.js", string],
  ["/api/auth/callback/credentials", "post", "Login Credentials Auth.js", string],
  ["/api/auth/error", "get", "Erro de autenticação Auth.js", string],
  ["/api/auth/verify-request", "get", "Página informativa delegada ao Auth.js; não envia e-mail", string],
] as const) {
  add(path, method, "Authentication", summary, schema, { public: true, raw: true, errors: [], description: "Protocolo do Auth.js 5 Credentials (catch-all GET/POST). Use /login e Sair da aplicação para sessão HttpOnly; não é Bearer token. Não usa envelope de negócio. Cookies Secure em HTTPS, SameSite=Lax. Erros/redirecionamentos dependem do protocolo Auth.js." });
  const op = paths[path][method];
  op.responses.default = { description: "Resposta de erro controlada pelo Auth.js; pode ser HTML, JSON ou redirecionamento." };
  if (["/api/auth/signin", "/api/auth/signout", "/api/auth/callback/credentials", "/api/auth/error", "/api/auth/verify-request"].includes(path)) {
    op.responses = { "200": { description: "Página HTML ou {url} quando X-Auth-Return-Redirect estiver presente.", content: { "text/html": { schema: string }, "application/json": { schema: object({ url: string }) } } }, "302": { description: "Redirecionamento do Auth.js.", headers: { Location: { schema: string } } }, default: op.responses.default };
  }
  if (method === "post") op.requestBody = { required: true, content: { "application/x-www-form-urlencoded": { schema: object({ csrfToken: string, callbackUrl: string, ...(path.endsWith("credentials") ? { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } : {}) }, path.endsWith("credentials") ? ["csrfToken", "email", "password"] : ["csrfToken"]) } } };
  if (path === "/api/auth/session" && method === "post") op.requestBody = { required: true, content: json(object({ csrfToken: string, data: { description: "Dados do protocolo de atualização. O callback atual não permite alterar a identidade pelo cliente." } }, ["csrfToken"])) };
}
add("/api/openapi", "get", "Documentation", "Documento OpenAPI desta aplicação", { type: "object" }, { public: true, raw: true, errors: [], description: "Somente contratos e exemplos fictícios. Não consulta dados dos usuários." });

export const openapi = {
  openapi: "3.1.0",
  info: { title: "Estimeta API", version: "0.1.0", description: "Contratos reais da Fase 6. Login via /login; sessão Auth.js em cookie HttpOnly. Dinheiro como string Decimal e datas financeiras YYYY-MM-DD. Regras adicionais dos schemas Zod descritas em cada request. Não existem módulos de cartão, sincronização offline ou endpoints para Repetir. Documentação pública sem dados reais; Swagger somente leitura." },
  servers: [{ url: "/", description: "Mesma origem da aplicação" }],
  tags: [...new Set(Object.values(paths).flatMap(verbs => Object.values(verbs).flatMap(op => op.tags)))].map(name => ({ name })),
  paths,
  components: { schemas, securitySchemes: {
    cronBearer: { type: "http", scheme: "bearer", description: "Secret exclusivo do agendador; não usar token de sessão." },
    sessionCookie: { type: "apiKey", in: "cookie", name: "authjs.session-token", description: "Desenvolvimento HTTP. Emitido no login; nunca colar tokens na documentação." },
    secureSessionCookie: { type: "apiKey", in: "cookie", name: "__Secure-authjs.session-token", description: "HTTPS. Cookie HttpOnly gerenciado pelo Auth.js." },
  } },
};
