import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { openapi, schemas } from "../../src/lib/api/openapi";

const origin = process.env.TEST_BASE_URL ?? "http://localhost:3000";
function expand(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expand);
  if (!value || typeof value !== "object") return value;
  const data = value as Record<string, unknown>;
  if (typeof data.$ref === "string") return expand(schemas[data.$ref.split("/").pop()!]);
  return Object.fromEntries(Object.entries(data).map(([key, entry]) => [key, expand(entry)]));
}
const validators = new Map<string, z.ZodType>();
async function validateResponse(path: string, method: string, response: Response) {
  const pathname = path.split("?")[0];
  const entry = Object.entries(openapi.paths).find(([template]) => new RegExp(`^${template.replace(/\{[^}]+\}/g, "[^/]+")}$`).test(pathname));
  assert.ok(entry, `Endpoint documentado: ${path}`);
  const operation = entry[1][method.toLowerCase()];
  assert.ok(operation, `Método documentado: ${method} ${path}`);
  const contract = operation.responses[response.status] as { content?: { "application/json"?: { schema: Record<string, unknown> } } } | undefined;
  assert.ok(contract, `${method} ${path}: status ${response.status} documentado`);
  const schema = contract.content?.["application/json"]?.schema;
  if (!schema) return;
  const key = `${method} ${entry[0]} ${response.status}`;
  if (!validators.has(key)) validators.set(key, z.fromJSONSchema(expand(schema) as Parameters<typeof z.fromJSONSchema>[0]));
  const body = await response.clone().json();
  const parsed = validators.get(key)!.safeParse(body);
  assert.ok(parsed.success, `${key}: ${parsed.success ? "" : parsed.error.message}`);
}

class Session {
  cookies = new Map<string, string>();
  header() { return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "); }
  keep(response: Response) { for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0]; const at = pair.indexOf("="); this.cookies.set(pair.slice(0, at), pair.slice(at + 1)); } }
  async request(path: string, method = "GET", body?: unknown) {
    const response = await fetch(origin + path, { method, redirect: "manual", headers: { Origin: origin, Cookie: this.header(), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    this.keep(response);
    await validateResponse(path, method, response);
    return response;
  }
  async login(email: string, password: string) {
    const csrf = await (await this.request("/api/auth/csrf")).json();
    const response = await fetch(origin + "/api/auth/callback/credentials", { method: "POST", redirect: "manual", headers: { Origin: origin, Cookie: this.header(), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: origin + "/dashboard" }) });
    this.keep(response);
    assert.equal(response.status, 302);
    assert.equal((await (await this.request("/api/users/me")).json()).data.user.email, email);
  }
}

test("Fase 6 HTTP: contratos OpenAPI, Household A/B e segurança", async suite => {
  assert.notEqual(process.env.NODE_ENV, "production");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname), "Use servidor local de teste.");
  const db = new PrismaClient();
  const emails = [0, 1].map(() => `phase6-${randomUUID()}@example.invalid`);
  const password = `Qa-${randomUUID()}-9a`;
  const a = new Session(), b = new Session();
  try {
    await suite.test("todas as operações privadas documentadas exigem sessão", async () => {
      const anonymous = new Session();
      for (const [path, methods] of Object.entries(openapi.paths)) for (const [method, operation] of Object.entries(methods)) {
        if (!operation.security.length) continue;
        const response = await anonymous.request(path.replace(/\{[^}]+\}/g, randomUUID()), method.toUpperCase(), ["post", "put", "patch"].includes(method) ? {} : undefined);
        assert.equal(response.status, 401, `${method} ${path}`);
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      }
    });
    for (const [index, session] of [a, b].entries()) {
      assert.equal((await session.request("/api/auth/register", "POST", { name: "Pessoa QA Fase 6", email: emails[index], password })).status, 201);
      await session.login(emails[index], password);
    }
    const create = async (path: string, body: unknown) => {
      const response = await a.request(path, "POST", body);
      assert.equal(response.status, 201, path);
      return (await response.json()).data;
    };
    const accountInput = { name: "Conta A", type: "CASH", initialBalance: "1000" };
    const accountA = await create("/api/accounts", accountInput);
    const accountOther = await create("/api/accounts", { ...accountInput, name: "Destino A", initialBalance: "500" });
    const categoryInput = { name: "Categoria A", type: "EXPENSE" };
    const categoryA = await create("/api/categories", categoryInput);
    const transactionInput = { accountId: accountA.id, categoryId: categoryA.id, type: "EXPENSE", description: "Somente A", amount: "50.00", scheduledDate: "2027-01-10", competenceDate: "2027-01-01", status: "PENDING" };
    const transactionA = await create("/api/transactions", transactionInput);
    const transferInput = { sourceAccountId: accountA.id, destinationAccountId: accountOther.id, amount: "200.00", transferDate: "2027-01-05", competenceDate: "2027-01-01" };
    const transferA = await create("/api/transfers", transferInput);
    const recurringInput = { accountId: accountA.id, categoryId: categoryA.id, type: "EXPENSE", description: "Recorrência A", amount: "100", startDate: "2027-01-01", dayOfMonth: 10 };
    const recurringA = await create("/api/recurring-transactions", recurringInput);
    const installmentA = await create("/api/installment-plans", { ...transactionInput, amount: "1000", installmentCount: 3 });
    const goalInput = { name: "Meta A", targetAmount: "5000", startDate: "2027-01-01" };
    const goalA = await create("/api/goals", goalInput);
    const goalOther = await create("/api/goals", { ...goalInput, name: "Outra meta A" });
    const participantA = await create(`/api/goals/${goalA.id}/participants`, { name: "Pessoa A" });
    const contributionInput = { participantId: participantA.id, amount: "100", contributionDate: "2027-01-10", competenceDate: "2027-01-01" };
    const contributionA = await create(`/api/goals/${goalA.id}/contributions`, contributionInput);
    await suite.test("A cria; B não consulta, edita ou exclui recursos de cada módulo", async () => {
      for (const [resource, id, body] of [["accounts", accountA.id, accountInput], ["categories", categoryA.id, categoryInput], ["transactions", transactionA.id, transactionInput], ["transfers", transferA.id, transferInput], ["recurring-transactions", recurringA.id, recurringInput], ["goals", goalA.id, goalInput]] as const) {
        for (const method of ["GET", "PUT", "DELETE"]) {
          const response = await b.request(`/api/${resource}/${id}`, method, method === "PUT" ? body : undefined);
          assert.equal(response.status, 404, `${method} ${resource}`);
          assert.deepEqual(await response.json(), { error: { code: "NOT_FOUND", message: "Registro não encontrado neste espaço familiar." } });
        }
        assert.equal((await a.request(`/api/${resource}/${id}`)).status, 200);
        assert.equal((await (await b.request(`/api/${resource}`)).json()).data.some((row: { id: string }) => row.id === id), false);
      }
      assert.equal((await b.request(`/api/installment-plans/${installmentA.id}`)).status, 404);
      assert.equal((await a.request(`/api/installment-plans/${installmentA.id}`)).status, 200);
    });
    await suite.test("ações específicas e IDs filhos não atravessam Household nem meta", async () => {
      for (const [path, method, body] of [
        [`/api/recurring-transactions/${recurringA.id}/generate`, "POST", { competenceDate: "2027-04-01" }],
        [`/api/goals/${goalA.id}`, "PATCH", { status: "ARCHIVED" }],
        [`/api/goals/${goalA.id}/participants`, "POST", { name: "Intruso" }],
        [`/api/goals/${goalA.id}/participants/${participantA.id}`, "PUT", { name: "Intruso" }],
        [`/api/goals/${goalA.id}/contributions`, "POST", contributionInput],
        [`/api/goals/${goalA.id}/contributions/${contributionA.id}`, "PUT", contributionInput],
        [`/api/goals/${goalA.id}/contributions/${contributionA.id}`, "DELETE", undefined],
      ] as const) assert.equal((await b.request(path, method, body)).status, 404, path);
      assert.equal((await a.request(`/api/goals/${goalOther.id}/participants/${participantA.id}`, "PUT", { name: "Outro" })).status, 404);
      assert.equal((await a.request(`/api/goals/${goalOther.id}/contributions/${contributionA.id}`, "PUT", contributionInput)).status, 404);
      assert.equal((await a.request(`/api/goals/${goalOther.id}/contributions/${contributionA.id}`, "DELETE")).status, 404);
      const detail = (await (await a.request(`/api/goals/${goalA.id}?through=2027-01-01`)).json()).data;
      assert.equal(detail.totalContributed, "100.00");
      assert.equal(detail.participants[0].name, "Pessoa A");
      assert.equal(detail.status, "ACTIVE");
    });
    await suite.test("referências estrangeiras e mass assignment são rejeitados", async () => {
      for (const [path, body] of [["/api/transactions", transactionInput], ["/api/transfers", transferInput], ["/api/recurring-transactions", recurringInput], ["/api/installment-plans", { ...transactionInput, installmentCount: 3 }], ["/api/goals", { ...goalInput, accountId: accountA.id }]] as const) assert.equal((await b.request(path, "POST", body)).status, 400, path);
      const ownGoal = await b.request("/api/goals", "POST", goalInput);
      assert.equal(ownGoal.status, 201); const bGoal = (await ownGoal.json()).data.id;
      assert.equal((await b.request(`/api/goals/${bGoal}/contributions`, "POST", contributionInput)).status, 400);
      assert.equal((await b.request(`/api/goals/${bGoal}/contributions`, "POST", { ...contributionInput, participantId: null, transferId: transferA.id })).status, 400);
      for (const property of ["householdId", "createdBy", "userId"]) assert.equal((await a.request("/api/transactions", "POST", { ...transactionInput, [property]: randomUUID() })).status, 400);
    });
    await suite.test("planejamento, relatórios e saldo não vazam dados entre A/B", async () => {
      const config = { revision: 0, enabled: true, incomeSource: "MANUAL", referenceIncome: "5000", groups: [{ name: "Grupo A", percentage: "30", alertPercentage: "90", active: true, categoryIds: [categoryA.id] }] };
      assert.equal((await a.request("/api/planning", "PUT", config)).status, 200);
      assert.equal((await b.request("/api/planning", "PUT", config)).status, 400);
      assert.equal((await (await b.request("/api/planning")).json()).data.enabled, false);
      const balances = (await (await a.request("/api/accounts?year=2027&month=1")).json()).data;
      assert.equal(balances.find((r: { id: string }) => r.id === accountA.id).balance, "800.00");
      assert.equal(balances.find((r: { id: string }) => r.id === accountOther.id).balance, "700.00");
      const start = performance.now();
      const dashboard = (await (await a.request("/api/dashboard?year=2027&month=1")).json()).data;
      const annual = (await (await a.request("/api/reports/annual?year=2027")).json()).data;
      assert.equal(dashboard.balance, "1500.00"); assert.equal(annual.annualTotals.balance, "1500.00");
      assert.equal(dashboard.income, "0.00"); assert.equal(dashboard.expenses, "0.00");
      console.info(`Fase 6: dashboard+anual HTTP fixture pequena ${Math.round(performance.now() - start)}ms (inclui validação OpenAPI; não é benchmark de produção).`);
      const other = (await (await b.request("/api/dashboard?year=2027&month=1")).json()).data;
      assert.equal(other.balance, "0.00"); assert.equal(other.pendingExpenses, "0.00");
      assert.deepEqual(other.recentTransactions, []);
      assert.equal((await (await b.request("/api/reports/annual?year=2027")).json()).data.annualTotals.balance, "0.00");
    });
    await suite.test("origem, JSON inválido e headers mantêm erros controlados", async () => {
      for (const path of ["/api/accounts", "/api/categories", "/api/transactions", "/api/transfers", "/api/recurring-transactions", "/api/installment-plans", "/api/goals", "/api/planning"]) {
        const response = await fetch(origin + path, { method: path.endsWith("planning") ? "PUT" : "POST", headers: { Origin: "https://foreign.example", Cookie: a.header(), "Content-Type": "application/json" }, body: "{}" });
        assert.equal(response.status, 403); assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      }
      const response = await fetch(origin + "/api/transactions", { method: "POST", headers: { Origin: origin, Cookie: a.header(), "Content-Type": "application/json" }, body: "{" });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, "INVALID_INPUT");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(response.headers.get("x-frame-options"), "DENY");
    });
    await suite.test("Swagger local, manifest e health publicados sem dados privados", async () => {
      const docs = await fetch(origin + "/docs"); assert.equal(docs.status, 200);
      assert.match(await docs.text(), /swagger-ui-bundle.js/);
      for (const path of ["/swagger/swagger-ui-bundle.js", "/swagger/swagger-ui.css", "/api-docs.js", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]) assert.equal((await fetch(origin + path)).status, 200, path);
      const spec = await (await a.request("/api/openapi")).json(); assert.equal(spec.openapi, "3.1.0");
      assert.deepEqual(spec, JSON.parse(JSON.stringify(openapi)), "Servidor deve publicar o contrato atual.");
      assert.ok(!JSON.stringify(spec).includes(emails[0]));
      assert.equal((await a.request("/api/health")).status, 200);
    });
  } finally {
    // Only identities created by this run, never user/demo data.
    for (const email of emails) {
      const user = await db.user.findUnique({ where: { email }, include: { membership: true } });
      const householdId = user?.membership?.householdId;
      if (householdId) {
        const where = { householdId };
        await db.goalContribution.deleteMany({ where }); await db.goalParticipant.deleteMany({ where }); await db.financialGoal.deleteMany({ where });
        await db.transaction.deleteMany({ where }); await db.transfer.deleteMany({ where }); await db.recurringOccurrence.deleteMany({ where }); await db.recurringTransaction.deleteMany({ where }); await db.installmentPlan.deleteMany({ where });
        await db.incomePlanning.deleteMany({ where }); await db.category.deleteMany({ where }); await db.account.deleteMany({ where }); await db.household.delete({ where: { id: householdId } });
      }
      if (user) await db.user.delete({ where: { id: user.id } });
    }
    await db.$disconnect();
  }
});
