import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { defaultCategories } from "../../src/lib/finance/defaults";
const origin = process.env.TEST_BASE_URL ?? "http://localhost:3000";
class BrowserSession {
  cookies = new Map<string, string>();
  async request(path: string, method = "GET", body?: unknown) {
    const response = await fetch(`${origin}${path}`, { method, redirect: "manual", headers: { Origin: origin, Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0]; const index = pair.indexOf("="); this.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
    return response;
  }
  async login(email: string, password: string) {
    const csrf = await (await this.request("/api/auth/csrf")).json();
    const response = await fetch(`${origin}/api/auth/callback/credentials`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin, Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ") }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${origin}/dashboard` }) });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0]; const index = pair.indexOf("="); this.cookies.set(pair.slice(0, index), pair.slice(index + 1)); }
    assert.equal(response.status, 302);
    assert.equal((await (await this.request("/api/auth/session")).json()).user.email, email);
  }
}
test("APIs reais autenticadas: CRUD, guards e persistência após novo login", async (suite) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const db = new PrismaClient();
  const email = `finance-http-${randomUUID()}@example.invalid`;
  const password = `Qa-${randomUUID()}-9a`;
  const session = new BrowserSession();
  let householdId: string | undefined;
  let accountId: string;
  let categoryId: string;
  let transactionId: string;
  try {
    await suite.test("as 15 operações financeiras exigem autenticação", async () => {
      const anonymous = new BrowserSession();
      for (const resource of ["accounts", "categories", "transactions", "transfers", "recurring-transactions", "goals"]) {
        for (const [path, method] of [[`/api/${resource}`, "GET"], [`/api/${resource}`, "POST"], [`/api/${resource}/${randomUUID()}`, "GET"], [`/api/${resource}/${randomUUID()}`, "PUT"], [`/api/${resource}/${randomUUID()}`, "DELETE"]]) {
          assert.equal((await anonymous.request(path, method, method === "POST" || method === "PUT" ? {} : undefined)).status, 401, `${method} ${path}`);
        }
      }
      assert.equal((await anonymous.request("/api/installment-plans", "POST", {})).status, 401);
      assert.equal((await anonymous.request(`/api/installment-plans/${randomUUID()}`)).status, 401);
      assert.equal((await anonymous.request(`/api/recurring-transactions/${randomUUID()}/generate`, "POST", {})).status, 401);
    });
    await suite.test("cadastro cria categorias padrão atomicamente e login funciona", async () => {
      assert.equal((await session.request("/api/auth/register", "POST", { name: "QA HTTP temporário", email, password })).status, 201);
      await session.login(email, password);
      const me = await (await session.request("/api/users/me")).json();
      assert.ok(me.data);
      const user = await db.user.findUniqueOrThrow({ where: { email }, include: { membership: true } });
      householdId = user.membership!.householdId;
      assert.equal((await (await session.request("/api/categories")).json()).data.length, defaultCategories.length);
    });
    await suite.test("cria, consulta e edita conta e categoria via HTTP", async () => {
      let response = await session.request("/api/accounts", "POST", { name: "Conta HTTP", type: "CASH", initialBalance: "100.25" });
      assert.equal(response.status, 201); accountId = (await response.json()).data.id;
      response = await session.request("/api/categories", "POST", { name: "Categoria HTTP", type: "EXPENSE" });
      assert.equal(response.status, 201); categoryId = (await response.json()).data.id;
      assert.equal((await session.request(`/api/accounts/${accountId}`)).status, 200);
      assert.equal((await session.request(`/api/categories/${categoryId}`)).status, 200);
      assert.equal((await session.request(`/api/accounts/${accountId}`, "PUT", { name: "Conta HTTP editada", type: "CASH", initialBalance: "200.30" })).status, 200);
      assert.equal((await session.request(`/api/categories/${categoryId}`, "PUT", { name: "Categoria HTTP editada", type: "EXPENSE" })).status, 200);
    });
    await suite.test("Fase 5: APIs, participantes, contribuições e persistência após login", async () => {
      const base = { name: "Meta HTTP", targetAmount: "10000", startDate: "2026-09-01" };
      let response = await session.request("/api/goals", "POST", base); assert.equal(response.status, 201); const id = (await response.json()).data.id;
      assert.equal((await session.request("/api/goals", "POST", { ...base, householdId })).status, 400);
      response = await session.request(`/api/goals/${id}/participants`, "POST", { name: "Pessoa HTTP" }); assert.equal(response.status, 201); const participantId = (await response.json()).data.id;
      const contribution = { participantId, amount: "500", contributionDate: "2026-09-15", competenceDate: "2026-09-01" };
      response = await session.request(`/api/goals/${id}/contributions`, "POST", contribution); assert.equal(response.status, 201); const contributionId = (await response.json()).data.id;
      response = await session.request(`/api/goals/${id}`); assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal((await response.json()).data.totalContributed, "500.00");
      assert.equal((await session.request(`/api/goals/${id}/contributions/${contributionId}`, "PUT", { ...contribution, amount: "700" })).status, 200);
      assert.equal((await session.request(`/api/goals/${id}`, "PUT", { ...base, targetAmount: "500" })).status, 200);
      await session.login(email, password); assert.equal((await (await session.request(`/api/goals/${id}`)).json()).data.progressPercentage, "140.00");
      const anonymous = new BrowserSession();
      for (const [path, method] of [[`/api/goals/${id}`, "PATCH"], [`/api/goals/${id}/participants`, "POST"], [`/api/goals/${id}/participants/${participantId}`, "PUT"], [`/api/goals/${id}/contributions`, "POST"], [`/api/goals/${id}/contributions/${contributionId}`, "PUT"], [`/api/goals/${id}/contributions/${contributionId}`, "DELETE"]]) assert.equal((await anonymous.request(path, method, {})).status, 401);
      assert.equal((await session.request(`/api/goals/${id}/participants/${participantId}`, "PUT", { name: "Pessoa HTTP", isActive: false })).status, 200);
      assert.equal((await session.request(`/api/goals/${id}/contributions/${contributionId}`, "DELETE")).status, 200);
      assert.equal((await session.request(`/api/goals/${id}`, "PATCH", { status: "COMPLETED" })).status, 200);
      assert.equal((await session.request(`/api/goals/${id}`, "DELETE")).status, 409);
      assert.equal((await session.request(`/api/goals/${id}`, "PATCH", { status: "ARCHIVED" })).status, 200);
      assert.equal((await (await session.request(`/api/goals/${id}`)).json()).data.status, "ARCHIVED");
      const empty = (await (await session.request("/api/goals", "POST", base)).json()).data;
      assert.equal((await session.request(`/api/goals/${empty.id}`, "DELETE")).status, 200);
      assert.equal((await session.request(`/api/goals/${empty.id}`)).status, 404);
    });
    const input = () => ({ description: "Despesa HTTP", accountId, categoryId, type: "EXPENSE", amount: "25.75", scheduledDate: "2027-01-10", competenceDate: "2027-01-01", status: "PENDING", transactionDate: null });
    await suite.test("POST/GET/PUT de lançamento e resposta de filtros paginada", async () => {
      const response = await session.request("/api/transactions", "POST", input());
      assert.equal(response.status, 201); transactionId = (await response.json()).data.id;
      assert.equal((await session.request(`/api/transactions/${transactionId}`)).status, 200);
      assert.equal((await session.request(`/api/transactions/${transactionId}`, "PUT", { ...input(), amount: "30.99", status: "PAID", transactionDate: "2027-02-05" })).status, 200);
      const list = await (await session.request("/api/transactions?year=2027&month=1&search=HTTP&limit=1")).json();
      assert.equal(list.pagination.total, 1); assert.equal(list.data[0].amount, "30.99");
    });
    await suite.test("erros de validação, duplicidade e tentativa de injetar propriedade", async () => {
      assert.equal((await session.request("/api/categories", "POST", { name: "Categoria HTTP editada", type: "EXPENSE" })).status, 409);
      const response = await session.request("/api/transactions", "POST", { ...input(), householdId: randomUUID() });
      assert.equal(response.status, 400); assert.equal(typeof (await response.json()).error.message, "string");
      assert.equal((await session.request(`/api/transactions?householdId=${randomUUID()}`)).status, 400);
      assert.equal((await session.request("/api/transactions", "POST", { ...input(), amount: "0" })).status, 400);
      assert.equal((await fetch(`${origin}/api/accounts`, { method: "POST", headers: { Origin: "https://untrusted.example" } })).status, 403);
    });
    await suite.test("nova sessão encontra os mesmos dados persistidos", async () => {
      const otherDevice = new BrowserSession();
      await otherDevice.login(email, password);
      const transaction = await (await otherDevice.request(`/api/transactions/${transactionId}`)).json();
      assert.equal(transaction.data.amount, "30.99");
      assert.equal(transaction.data.transactionDate, "2027-02-05");
    });
    await suite.test("relatórios autenticados, filtros, cache e persistência após nova sessão", async () => {
      const anonymous = new BrowserSession();
      for (const path of ["/api/dashboard", "/api/reports/annual"]) assert.equal((await anonymous.request(path)).status, 401);
      for (const query of ["month=13", "month=0", "year=10000", "year=abc", `householdId=${randomUUID()}`]) assert.equal((await session.request(`/api/dashboard?${query}`)).status, 400);
      assert.equal((await session.request("/api/reports/annual?year=0")).status, 400);
      assert.equal((await session.request(`/api/reports/annual?householdId=${randomUUID()}`)).status, 400);
      const response = await session.request("/api/dashboard?year=2027&month=1");
      assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store");
      const dashboard = (await response.json()).data;
      assert.equal(dashboard.expenses, "30.99"); assert.equal(dashboard.balance, "169.31");
      const annual = (await (await session.request("/api/reports/annual?year=2027")).json()).data;
      assert.equal(annual.monthlySummary[0].expenses, "30.99"); assert.equal(annual.monthlySummary[1].expenses, "0.00");
      const empty = (await (await session.request("/api/reports/annual?year=2028")).json()).data;
      assert.equal(empty.annualTotals.expenses, "0.00"); assert.equal(empty.annualTotals.balance, "169.31");
      const otherDevice = new BrowserSession(); await otherDevice.login(email, password);
      assert.equal((await (await otherDevice.request("/api/dashboard?year=2027&month=1")).json()).data.expenses, "30.99");
      assert.equal((await session.request(`/api/transactions/${transactionId}`, "PUT", { ...input(), amount: "40.99", status: "PAID", transactionDate: "2027-02-05" })).status, 200);
      assert.equal((await (await session.request("/api/dashboard?year=2027&month=1")).json()).data.expenses, "40.99");
    });
    await suite.test("planejamento HTTP: autenticação, origem, persistência, validação e dashboard", async () => {
      const anonymous = new BrowserSession();
      assert.equal((await anonymous.request("/api/planning")).status, 401);
      assert.equal((await anonymous.request("/api/planning", "PUT", {})).status, 401);
      const initial = (await (await session.request("/api/planning")).json()).data;
      assert.equal(initial.enabled, false);
      const input = { ...initial, enabled: true, incomeSource: "MANUAL", referenceIncome: "10000", groups: [{ name: "Grupo HTTP", percentage: "20", alertPercentage: "90", active: true, categoryIds: [categoryId] }] };
      assert.equal((await session.request("/api/planning", "PUT", { ...input, householdId: randomUUID() })).status, 400);
      assert.equal((await session.request("/api/planning", "PUT", { ...input, groups: [{ ...input.groups[0], percentage: "101" }] })).status, 400);
      assert.equal((await fetch(`${origin}/api/planning`, { method: "PUT", headers: { Origin: "https://untrusted.example" } })).status, 403);
      const saved = await session.request("/api/planning", "PUT", input);
      assert.equal(saved.status, 200); assert.equal(saved.headers.get("cache-control"), "private, no-store");
      assert.equal((await session.request("/api/planning", "PUT", input)).status, 409);
      const otherDevice = new BrowserSession(); await otherDevice.login(email, password);
      assert.equal((await (await otherDevice.request("/api/planning")).json()).data.referenceIncome, "10000.00");
      const report = (await (await session.request("/api/dashboard?year=2027&month=1")).json()).data;
      assert.equal(report.planning.groups[0].committed, "40.99"); assert.equal(report.planning.groups[0].planned, "2000.00");
      assert.equal(report.balance, "159.31");
    });
    await suite.test("fase 4 HTTP: parcelas, recorrências, transferências, validações e persistência", async () => {
      const account = (await (await session.request("/api/accounts", "POST", { name: "Destino Fase 4", type: "SAVINGS", initialBalance: "0", includeInTotalBalance: false })).json()).data;
      try {
        let response = await session.request("/api/installment-plans", "POST", { ...input(), amount: "1000", installmentCount: 3, scheduledDate: "2027-01-31" });
        assert.equal(response.status, 201);
        const plan = (await response.json()).data;
        response = await session.request(`/api/installment-plans/${plan.id}`);
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).data.transactions.map((r: { amount: string }) => r.amount), ["333.34", "333.33", "333.33"]);
        const ruleInput = { type: "EXPENSE", description: "Internet HTTP", amount: "120", accountId, categoryId, startDate: "2027-01-01", dayOfMonth: 10 };
        response = await session.request("/api/recurring-transactions", "POST", ruleInput);
        assert.equal(response.status, 201); const rule = (await response.json()).data;
        for (let i = 0; i < 2; i++) {
          const duplicate = await session.request(`/api/recurring-transactions/${rule.id}/generate`, "POST", { competenceDate: "2027-02-01" });
          assert.equal(duplicate.status, 200);
          const result = (await duplicate.json()).data;
          assert.equal(result.reason, "ALREADY_EXISTS"); assert.ok(result.transactionId); assert.equal(result.generated, false);
        }
        const generated = (await (await session.request(`/api/recurring-transactions/${rule.id}/generate`, "POST", { competenceDate: "2027-04-01" })).json()).data;
        assert.equal(generated.generated, true); assert.equal(generated.reason, "CREATED"); assert.ok(generated.transactionId);
        assert.equal((await session.request("/transacoes?year=2027&month=4")).status, 200);
        assert.equal(await db.recurringOccurrence.count({ where: { recurringTransactionId: rule.id, competenceDate: new Date("2027-02-01") } }), 1);
        const before = (await (await session.request("/api/dashboard?year=2027&month=1")).json()).data;
        const transferInput = { sourceAccountId: accountId, destinationAccountId: account.id, amount: "50", competenceDate: "2027-01-01", transferDate: "2026-09-23" };
        response = await session.request("/api/transfers", "POST", transferInput);
        assert.equal(response.status, 201); const transfer = (await response.json()).data;
        const after = (await (await session.request("/api/dashboard?year=2027&month=1")).json()).data;
        assert.equal(after.balance, "109.31"); assert.equal(after.income, before.income); assert.equal(after.expenses, before.expenses); assert.equal(after.netSavings, before.netSavings); assert.deepEqual(after.planning, before.planning);
        for (const resource of ["transfers", "recurring-transactions"]) {
          assert.equal((await session.request(`/api/${resource}?householdId=${randomUUID()}`)).status, 400);
          assert.equal((await fetch(`${origin}/api/${resource}`, { method: "POST", headers: { Origin: "https://untrusted.example" } })).status, 403);
          assert.equal((await session.request(`/api/${resource}/${randomUUID()}`)).status, 404);
        }
        assert.equal((await session.request("/api/transfers", "POST", { ...transferInput, destinationAccountId: accountId })).status, 400);
        assert.equal((await session.request("/api/transfers", "POST", { ...transferInput, destinationAccountId: randomUUID() })).status, 400);
        const otherDevice = new BrowserSession(); await otherDevice.login(email, password);
        assert.equal((await (await otherDevice.request(`/api/transfers/${transfer.id}`)).json()).data.amount, "50.00");
        assert.equal((await otherDevice.request(`/api/recurring-transactions/${rule.id}`, "PUT", { ...ruleInput, revision: rule.revision, amount: "150" })).status, 200);
        assert.equal((await otherDevice.request(`/api/recurring-transactions/${rule.id}`, "DELETE")).status, 200);
        assert.equal((await otherDevice.request(`/api/transfers/${transfer.id}`, "DELETE")).status, 200);
      } finally {
        await db.transaction.deleteMany({ where: { householdId, id: { not: transactionId } } });
        await db.transfer.deleteMany({ where: { householdId } }); await db.recurringOccurrence.deleteMany({ where: { householdId } }); await db.recurringTransaction.deleteMany({ where: { householdId } }); await db.installmentPlan.deleteMany({ where: { householdId } });
        await db.account.delete({ where: { id: account.id } });
      }
    });
    await suite.test("DELETE preserva histórico de conta/categoria e remove lançamento solicitado", async () => {
      assert.equal((await (await session.request(`/api/categories/${categoryId}`, "DELETE")).json()).data.deactivated, true);
      assert.equal((await (await session.request(`/api/accounts/${accountId}`, "DELETE")).json()).data.deactivated, true);
      assert.equal((await session.request(`/api/transactions/${transactionId}`, "DELETE")).status, 200);
      assert.equal((await session.request(`/api/transactions/${transactionId}`)).status, 404);
      assert.equal((await (await session.request(`/api/categories/${categoryId}`, "DELETE")).json()).data.deactivated, false);
      assert.equal((await (await session.request(`/api/accounts/${accountId}`, "DELETE")).json()).data.deactivated, false);
    });
    await suite.test("sessão de usuário removido termina no login sem loop", async () => {
      // The preceding test removed this fixture's transactions and account.
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      await db.goalContribution.deleteMany({ where: { householdId } }); await db.goalParticipant.deleteMany({ where: { householdId } }); await db.financialGoal.deleteMany({ where: { householdId } });
      await db.user.delete({ where: { id: user.id } });
      assert.equal((await session.request("/api/dashboard")).status, 401);
      const dashboard = await session.request("/dashboard");
      const dashboardBody = await dashboard.text();
      assert.ok(dashboard.headers.get("location")?.includes("/login") || dashboardBody.includes("NEXT_REDIRECT;replace;/login"));
      const login = await session.request("/login");
      assert.equal(login.status, 200);
      assert.equal(login.headers.get("location"), null);
      const loginBody = await login.text();
      assert.ok(loginBody.includes("Entre na sua conta"));
      assert.ok(!loginBody.includes("NEXT_REDIRECT"));
      const home = await session.request("/");
      const homeBody = await home.text();
      assert.ok(home.headers.get("location") === "/login" || homeBody.includes("NEXT_REDIRECT;replace;/login"));
    });
  } finally {
    // Only this run's random fixture is removed; no preexisting user is touched.
    const user = await db.user.findUnique({ where: { email }, include: { membership: true } });
    householdId ??= user?.membership?.householdId;
    if (householdId) {
      await db.goalContribution.deleteMany({ where: { householdId } }); await db.goalParticipant.deleteMany({ where: { householdId } }); await db.financialGoal.deleteMany({ where: { householdId } });
      await db.transaction.deleteMany({ where: { householdId } });
      await db.transfer.deleteMany({ where: { householdId } }); await db.recurringOccurrence.deleteMany({ where: { householdId } }); await db.recurringTransaction.deleteMany({ where: { householdId } }); await db.installmentPlan.deleteMany({ where: { householdId } });
      await db.category.deleteMany({ where: { householdId } });
      await db.account.deleteMany({ where: { householdId } });
      await db.household.delete({ where: { id: householdId } });
    }
    if (user) await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
