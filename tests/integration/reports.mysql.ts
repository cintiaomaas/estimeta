import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { financialService } from "../../src/services/finance";
import { reportService } from "../../src/services/reports";
test("relatórios MySQL: cenários determinísticos e isolamento", async (suite) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const db = new PrismaClient();
  const householdIds = [randomUUID(), randomUUID()];
  const userIds = [randomUUID(), randomUUID()];
  try {
    for (let i = 0; i < 2; i++) await db.user.create({ data: { id: userIds[i], name: "QA relatórios", email: `report-${userIds[i]}@example.invalid`, passwordHash: "no-login", membership: { create: { role: "OWNER", household: { create: { id: householdIds[i], name: "QA relatórios" } } } } } });
    const actor = { householdId: householdIds[0], userId: userIds[0] };
    const finance = financialService(db, actor);
    await suite.test("competência futura não altera saldo do mês corrente nem de períodos anteriores", async () => {
      const account = await finance.saveAccount({ name: "Regressão competência futura", type: "CASH", initialBalance: "0" });
      const categories = [];
      const transactions = [];
      try {
        for (const type of ["INCOME", "EXPENSE"] as const) {
          const category = await finance.saveCategory({ name: `Regressão ${type}`, type });
          categories.push(category.id);
          const row = await finance.saveTransaction({ accountId: account.id, categoryId: category.id, type, amount: type === "INCOME" ? "5000" : "3000", description: "Competência futura", competenceDate: "2027-01-01", scheduledDate: "2026-09-10", transactionDate: "2026-09-10", status: type === "INCOME" ? "RECEIVED" : "PAID" });
          transactions.push(row.id);
        }
        const service = reportService(db, actor, new Date("2026-09-22T15:00:00Z"));
        for (const [year, month, expected] of [[2026, 9, "0.00"], [2026, 12, "0.00"], [2027, 1, "2000.00"], [2027, 2, "2000.00"]] as const) {
          const dashboard = await service.dashboard({ year, month });
          assert.equal(dashboard.balance, expected, `${month}/${year}`);
          assert.equal(dashboard.balanceKind, "period");
          if (year === 2026 && month === 9) assert.deepEqual([dashboard.income, dashboard.expenses, dashboard.netSavings], ["0.00", "0.00", "0.00"]);
          const annual = await service.annual({ year });
          assert.equal(dashboard.balance, annual.monthlySummary[month - 1].balance);
        }
        assert.deepEqual((await service.annual({ year: 2026 })).monthlySummary.map((r) => r.balance), Array(12).fill("0.00"));
        assert.deepEqual((await service.annual({ year: 2027 })).monthlySummary.slice(0, 2).map((r) => r.balance), ["2000.00", "2000.00"]);
      } finally {
        for (const id of transactions) await finance.removeTransaction(id);
        for (const id of categories) await finance.removeCategory(id);
        await finance.removeAccount(account.id);
      }
    });
    const reports = reportService(db, actor, new Date("2027-02-15T15:00:00Z"));
    const account = await finance.saveAccount({ name: "Conta", type: "CASH", initialBalance: "1000" });
    const income = await finance.saveCategory({ name: "Renda", type: "INCOME" });
    const expense = await finance.saveCategory({ name: "Moradia", type: "EXPENSE" });
    const add = (type: "INCOME" | "EXPENSE", amount: string, month: string, status: "PENDING" | "PAID" | "RECEIVED", scheduledDate = "2027-02-20") => finance.saveTransaction({ accountId: account.id, categoryId: type === "INCOME" ? income.id : expense.id, type, amount, description: `${type} ${month}`, competenceDate: `2027-${month}-01`, scheduledDate, status, transactionDate: status === "PENDING" ? null : "2027-02-08" });
    await suite.test("conta sem movimento preserva saldo inicial", async () => {
      const report = await reports.dashboard({ year: 2027, month: 1 });
      assert.equal(report.balance, "1000.00"); assert.equal(report.income, "0.00"); assert.equal(report.comparison.income, null);
    });
    await add("INCOME", "5000", "01", "RECEIVED"); await add("EXPENSE", "3000", "01", "PAID");
    await add("EXPENSE", "500", "01", "PENDING"); await add("EXPENSE", "75", "01", "PENDING", "2027-02-14"); await add("INCOME", "200", "01", "PENDING");
    await add("INCOME", "5000", "02", "RECEIVED"); await add("EXPENSE", "4000", "02", "PAID");
    await suite.test("realizados, previstos, atraso, competência e saldo acumulado", async () => {
      const jan = await reports.dashboard({ year: 2027, month: 1 });
      assert.deepEqual([jan.income, jan.expenses, jan.netSavings, jan.balance, jan.pendingIncome, jan.pendingExpenses, jan.overdueExpenses], ["5000.00", "3000.00", "2000.00", "3000.00", "200.00", "500.00", "75.00"]);
      assert.equal(jan.topExpenses[0].transactionDate, "2027-02-08");
      assert.equal(jan.expensesByCategory[0].percentage, "100.00");
      const feb = await reports.dashboard({ year: 2027, month: 2 });
      assert.equal(feb.expenses, "4000.00"); assert.equal(feb.balance, "4000.00"); assert.equal(feb.comparison.income, "0.00"); assert.equal(feb.trend.length, 6);
    });
    await suite.test("anual, média transcorrida, meses vazios e ano seguinte", async () => {
      const annual = await reports.annual({ year: 2027 });
      assert.equal(annual.monthlySummary.length, 12);
      assert.equal(annual.monthlySummary[0].balance, "3000.00"); assert.equal(annual.monthlySummary[1].balance, "4000.00");
      assert.equal(annual.monthlySummary[2].income, "0.00"); assert.equal(annual.annualTotals.balance, "4000.00");
      assert.equal(annual.annualTotals.income, "10000.00"); assert.equal(annual.averages.income, "5000.00");
      assert.equal(annual.expenseCategories[0].total, "7000.00");
      const next = await reports.annual({ year: 2028 }); assert.equal(next.monthlySummary[0].balance, "4000.00"); assert.equal(next.averages.income, null);
      const closed = await reportService(db, actor, new Date("2028-01-15T15:00:00Z")).annual({ year: 2027 }); assert.equal(closed.averages.income, "833.33");
    });
    await suite.test("outro Household não contamina contas, categorias, dashboard ou anual", async () => {
      const b = financialService(db, { householdId: householdIds[1], userId: userIds[1] });
      const ab = await b.saveAccount({ name: "Conta B", type: "CASH", initialBalance: "999999" });
      const cb = await b.saveCategory({ name: "Exclusiva B", type: "EXPENSE" });
      await b.saveTransaction({ accountId: ab.id, categoryId: cb.id, type: "EXPENSE", amount: "123", description: "Exclusiva B", competenceDate: "2027-01-01", scheduledDate: "2027-01-01", transactionDate: "2027-01-01", status: "PAID" });
      const report = await reports.dashboard({ year: 2027, month: 1 }); assert.equal(report.balance, "3000.00"); assert.equal(report.expensesByCategory.length, 1);
      assert.equal((await reports.annual({ year: 2027 })).annualTotals.expenses, "7000.00");
      assert.equal((await reports.annual({ year: 2027 })).expenseCategories.some((c) => c.id === cb.id), false);
    });
    await suite.test("desativação preserva histórico e nova conexão reflete persistência", async () => {
      await finance.removeAccount(account.id); await finance.removeCategory(expense.id);
      const fresh = new PrismaClient();
      try { const annual = await reportService(fresh, actor).annual({ year: 2027 }); assert.equal(annual.annualTotals.balance, "4000.00"); assert.equal(annual.expenseCategories[0].isActive, false); } finally { await fresh.$disconnect(); }
    });
  } finally {
    await db.transaction.deleteMany({ where: { householdId: { in: householdIds } } });
    await db.account.deleteMany({ where: { householdId: { in: householdIds } } });
    await db.category.deleteMany({ where: { householdId: { in: householdIds } } });
    await db.household.deleteMany({ where: { id: { in: householdIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } }); await db.$disconnect();
  }
});
