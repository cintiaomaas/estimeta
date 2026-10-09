import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, type PrismaClient } from "@prisma/client";
import { reportService } from "../src/services/reports";
import { consolidatedBalance } from "../src/services/balances";

function fixture(values: { initialBalance: string; movement?: string; type?: string; includeInTotalBalance?: boolean; isActive?: boolean }[]) {
  const accounts = values.map((row, i) => ({ id: String(i), householdId: "home", type: "CHECKING", includeInTotalBalance: true, isActive: true, ...row, movement: new Prisma.Decimal(row.movement ?? 0) }));
  const cutoffs: Date[] = [];
  const tx = {
    $queryRaw: async (query: Prisma.Sql) => {
      if (query.sql.includes("FROM Account")) {
        assert.equal(query.values[0], "home");
        cutoffs.push(query.values[1] as Date);
        return accounts;
      }
      return [];
    },
    account: { findMany: async () => accounts.filter(a => a.includeInTotalBalance) },
    category: { findMany: async () => [] },
    transaction: { groupBy: async () => [] },
    transfer: { groupBy: async () => [] },
  } as unknown as Prisma.TransactionClient;
  const db = { $transaction: async (work: (client: Prisma.TransactionClient) => Promise<unknown>) => work(tx) } as unknown as PrismaClient;
  return { tx, cutoffs, service: reportService(db, { householdId: "home", userId: "user" }, new Date("2026-10-09T12:00:00Z")) };
}

test("patrimônio inclui contas excluídas, desativadas, negativas e investimentos uma única vez", async () => {
  const { service, tx, cutoffs } = fixture([
    { initialBalance: "2500" }, { initialBalance: "1000" },
    { initialBalance: "5000", includeInTotalBalance: false, isActive: false },
    { initialBalance: "-500" }, { initialBalance: "15000", type: "INVESTMENT", includeInTotalBalance: false },
  ]);
  for (const year of [2025, 2026, 2027]) {
    const report = await service.annual({ year });
    assert.equal(report.totalWealth, "23000.00");
    assert.deepEqual(report.annualTotals, { income: "0.00", expenses: "0.00", netSavings: "0.00", balance: "3000.00" });
    assert.equal(report.monthlySummary.length, 12);
    assert.ok(report.monthlySummary.every(row => row.balance === "3000.00"));
    assert.deepEqual(report.incomeCategories, []);
    assert.deepEqual(report.expenseCategories, []);
  }
  assert.ok(cutoffs.every(date => date.toISOString() === "2026-11-01T00:00:00.000Z"));
  assert.equal((await consolidatedBalance(tx, "home", cutoffs[0])).value, "3000.00");
});

for (const [name, accounts, expected] of [
  ["somente contas", [{ initialBalance: "100.10", movement: "20.25" }, { initialBalance: "0.20", includeInTotalBalance: false }], "120.55"],
  ["somente investimentos", [{ initialBalance: "10000", type: "INVESTMENT" }], "10000.00"],
  ["sem contas nem investimentos", [], "0.00"],
  ["conta negativa reduz investimentos", [{ initialBalance: "-1000" }, { initialBalance: "10000", type: "INVESTMENT" }], "9000.00"],
  ["patrimônio negativo", [{ initialBalance: "-1000", includeInTotalBalance: false }, { initialBalance: "100" }], "-900.00"],
] as const) {
  test(`patrimônio: ${name}`, async () => {
    const { service } = fixture([...accounts]);
    assert.equal((await service.annual({ year: 2026 })).totalWealth, expected);
  });
}
