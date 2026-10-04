import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { financialService } from "../../src/services/finance";
import { referenceTransactions } from "../fixtures/transactions-reference";
import { accountBalances } from "../../src/services/balances";
import { planningConfig } from "../../src/services/planning";
import { reportService } from "../../src/services/reports";
import { referenceAccountBalances } from "../fixtures/account-balances-reference";
import { dateOnly, displayStatus } from "../../src/lib/finance/dates";
import { money } from "../../src/lib/finance/report-math";

test("leituras agrupadas preservam precisão, limites de competência, relações e Household", async (suite) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  let queries = 0;
  db.$on("query", () => queries++);
  const homes = [randomUUID(), randomUUID()], users = [randomUUID(), randomUUID()];
  const accounts = Array.from({ length: 4 }, () => randomUUID());
  const categories: string[] = Array.from({ length: 4 }, () => randomUUID());
  const date = (s: string) => new Date(`${s}T00:00:00Z`);
  try {
    for (let i = 0; i < 2; i++) await db.user.create({ data: { id: users[i], name: "QA leituras temporário", email: `reads-${users[i]}@example.invalid`, passwordHash: "not-a-login-hash", membership: { create: { role: "OWNER", household: { create: { id: homes[i], name: "QA leituras temporário" } } } } } });
    await db.account.createMany({ data: accounts.map((id, i) => ({ id, householdId: homes[i === 3 ? 1 : 0], name: `Conta ${i}`, type: "CASH" as const, initialBalance: "100.01", isActive: i !== 0, includeInTotalBalance: i !== 2 })) });
    await db.category.createMany({ data: categories.map((id, i) => ({ id, householdId: homes[i === 3 ? 1 : 0], name: `Categoria ${i}`, type: i === 0 ? "INCOME" as const : "EXPENSE" as const })) });
    await db.transaction.createMany({ data: Array.from({ length: 24 }, (_, i) => ({
      householdId: homes[0], createdBy: users[0], accountId: accounts[i % 3], categoryId: categories[i < 12 ? 0 : 1 + i % 2],
      type: i < 12 ? "INCOME" as const : "EXPENSE" as const,
      amount: i < 12 ? "9999999999999.99" : "10.25", description: `Fixture ${i}`,
      status: i % 5 === 0 ? "PENDING" as const : i < 12 ? "RECEIVED" as const : "PAID" as const,
      competenceDate: date(i % 7 === 0 ? "2027-01-01" : i % 4 === 0 ? "2026-09-01" : "2026-10-01"),
      scheduledDate: date("2026-10-02"), transactionDate: i % 5 === 0 ? null : date("2026-09-30"),
    })) });
    await db.transaction.create({ data: { householdId: homes[1], createdBy: users[1], accountId: accounts[3], categoryId: categories[3], type: "EXPENSE", amount: "123.45", description: "Outro Household", status: "PAID", competenceDate: date("2026-10-01"), scheduledDate: date("2026-10-01"), transactionDate: date("2026-10-01") } });
    await db.transfer.createMany({ data: Array.from({ length: 6 }, (_, i) => ({ householdId: homes[0], createdBy: users[0], sourceAccountId: accounts[i % 3], destinationAccountId: accounts[(i + 1) % 3], amount: "15.99", description: "Transferência fictícia", transferDate: date("2026-10-01"), competenceDate: date(i === 5 ? "2027-01-01" : "2026-10-01") })) });
    await db.incomePlanning.create({ data: { householdId: homes[0], enabled: true, incomeSource: "MANUAL", referenceIncome: "5000.01" } });
    const groups = [randomUUID(), randomUUID()];
    await db.planningGroup.createMany({ data: [
      { id: groups[0], householdId: homes[0], name: "Com categorias", position: 0, percentage: "35.25", alertPercentage: "90", active: false },
      { id: groups[1], householdId: homes[0], name: "Sem categorias", position: 1, percentage: "10.50", alertPercentage: "95", active: true },
    ] });
    await db.planningGroupCategory.createMany({ data: categories.slice(1, 3).map(categoryId => ({ planningGroupId: groups[0], householdId: homes[0], categoryId })) });
    await suite.test("saldos em uma consulta equivalem à referência em todos os limites", async () => {
      for (const before of ["2026-09-01", "2026-10-01", "2026-11-01", "2027-02-01"]) {
        await db.$transaction(async tx => {
          const start = queries;
          const actual = await accountBalances(tx, homes[0], date(before));
          assert.equal(queries - start, 1);
          assert.deepEqual(actual, await referenceAccountBalances(tx, homes[0], date(before)));
        }, { isolationLevel: "RepeatableRead", timeout: 15000 });
      }
      assert.deepEqual(await accountBalances(db, randomUUID(), date("2026-11-01")), []);
      assert.deepEqual(await accountBalances(db, homes[1], date("2026-11-01")), await referenceAccountBalances(db, homes[1], date("2026-11-01")));
    });
    await suite.test("lista mantém filtros combinados, curingas, ordenação e páginas vazias", async () => {
      const finance = financialService(db, { userId: users[0], householdId: homes[0] });
      const cases = [
        {}, { year: 2026 }, { year: 2026, month: 10 }, { year: 2027, month: 1 },
        { type: "INCOME", status: "PENDING" }, { type: "EXPENSE", status: "OVERDUE" }, { type: "INCOME", status: "OVERDUE" },
        { status: "PAID" }, { status: "RECEIVED" }, { status: "PENDING" },
        { accountId: accounts[0], categoryId: categories[0] }, { accountId: accounts[3] }, { categoryId: categories[3] },
        { search: "Fixture 1" }, { search: "Fixture _" }, { search: "%" }, { search: "' OR 1=1 --" },
        { startDate: "2026-10-02", endDate: "2026-10-02", type: "EXPENSE" }, { startDate: "2026-10-03" }, { endDate: "2026-10-01" },
        { page: 2, limit: 3, sort: "amount", order: "asc" }, { page: 99, limit: 3 },
        { sort: "description", order: "desc", limit: 100 }, { sort: "date", order: "asc", limit: 1 },
      ];
      for (const filters of cases) {
        const actual = await finance.transactions(filters);
        const expected = await referenceTransactions(db, homes[0], filters);
        assert.deepEqual(actual, expected, JSON.stringify(filters));
      }
    });
    await suite.test("planejamento: grupos inativos, múltiplas categorias e grupo vazio", async () => {
      const row = await db.incomePlanning.findUniqueOrThrow({ where: { householdId: homes[0] }, include: { groups: { orderBy: { position: "asc" }, include: { categories: true } } } });
      const start = queries;
      const actual = await planningConfig(db, homes[0]);
      assert.equal(queries - start, 1);
      assert.deepEqual(actual, { enabled: row.enabled, incomeSource: row.incomeSource, referenceIncome: money(row.referenceIncome), revision: row.revision, groups: row.groups.map(g => ({ name: g.name, percentage: money(g.percentage), alertPercentage: money(g.alertPercentage), active: g.active, categoryIds: g.categories.map(c => c.categoryId) })) });
      assert.deepEqual((await planningConfig(db, homes[1])).groups, []);
      await db.incomePlanning.create({ data: { householdId: homes[1] } });
      assert.deepEqual((await planningConfig(db, homes[1])).groups, []);
    });
    await suite.test("Dashboard mantém limites, ordenação, nomes e valores dos detalhes", async () => {
      const now = new Date("2026-10-03T15:00:00Z");
      const report = await reportService(db, { userId: users[0], householdId: homes[0] }, now).dashboard({ year: 2026, month: 10 });
      const select = { id: true, type: true, description: true, amount: true, status: true, scheduledDate: true, competenceDate: true, transactionDate: true, account: { select: { name: true } }, category: { select: { name: true } } } as const;
      for (const top of [true, false]) {
        const rows = await db.transaction.findMany({ where: { householdId: homes[0], competenceDate: { gte: date("2026-10-01"), lt: date("2026-11-01") }, ...(top ? { type: "EXPENSE", status: "PAID" } as const : {}) }, select, take: 5, orderBy: top ? [{ amount: "desc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }] });
        const expected = rows.map(r => ({ ...r, amount: money(r.amount), scheduledDate: dateOnly(r.scheduledDate), competenceDate: dateOnly(r.competenceDate), transactionDate: r.transactionDate ? dateOnly(r.transactionDate) : null, displayStatus: displayStatus({ ...r, scheduledDate: dateOnly(r.scheduledDate) }, "2026-10-03") }));
        assert.deepEqual(top ? report.topExpenses : report.recentTransactions, expected);
      }
      assert.equal(report.accountCount, 3);
      assert.ok(report.expensesByCategory.every(r => categories.slice(1, 3).includes(r.id)));
    });
  } finally {
    const where = { householdId: { in: homes } };
    await db.transfer.deleteMany({ where }); await db.transaction.deleteMany({ where }); await db.incomePlanning.deleteMany({ where });
    await db.category.deleteMany({ where }); await db.account.deleteMany({ where });
    await db.household.deleteMany({ where: { id: { in: homes } } }); await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect();
  }
});

