import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { annualBalances, consolidatedBalance } from "../src/services/balances";
import { monthDate } from "../src/lib/finance/report-math";

test("annual balances match monthly snapshots, including transfers and excluded accounts", async () => {
  const accounts = [
    { id: "included", householdId: "home", initialBalance: "100.10", includeInTotalBalance: true, isActive: false },
    { id: "second", householdId: "home", initialBalance: "20.00", includeInTotalBalance: true, isActive: true },
    { id: "excluded", householdId: "home", initialBalance: "9000", includeInTotalBalance: false, isActive: true },
    { id: "foreign", householdId: "other", initialBalance: "99999", includeInTotalBalance: true, isActive: true },
  ];
  const transactions = [
    { accountId: "included", type: "INCOME", status: "RECEIVED", amount: "50.05", competenceDate: monthDate(2025, 12), householdId: "home" },
    { accountId: "included", type: "EXPENSE", status: "PAID", amount: "10.25", competenceDate: monthDate(2026, 1), householdId: "home" },
    { accountId: "included", type: "EXPENSE", status: "PENDING", amount: "999", competenceDate: monthDate(2026, 1), householdId: "home" },
    { accountId: "excluded", type: "INCOME", status: "RECEIVED", amount: "999", competenceDate: monthDate(2026, 1), householdId: "home" },
    { accountId: "included", type: "INCOME", status: "RECEIVED", amount: "500", competenceDate: monthDate(2027, 1), householdId: "home" },
    { accountId: "foreign", type: "INCOME", status: "RECEIVED", amount: "999", competenceDate: monthDate(2026, 1), householdId: "other" },
  ];
  const transfers = [
    { sourceAccountId: "included", destinationAccountId: "second", amount: "40", competenceDate: monthDate(2026, 1), householdId: "home" },
    { sourceAccountId: "included", destinationAccountId: "excluded", amount: "15.10", competenceDate: monthDate(2026, 2), householdId: "home" },
    { sourceAccountId: "excluded", destinationAccountId: "included", amount: "5.05", competenceDate: monthDate(2026, 3), householdId: "home" },
  ];
  type Row = Record<string, unknown>;
  function matches(row: Row, where: Row): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (key === "OR") return (value as Row[]).some((condition) => matches(row, condition));
      if (value && typeof value === "object") {
        if ("in" in value) return (value.in as unknown[]).includes(row[key]);
        if ("lt" in value) return (row[key] as Date) < (value.lt as Date);
      }
      return row[key] === value;
    });
  }
  let queries = 0;
  const groupBy = (rows: Row[]) => async ({ where }: { where: Row }) => {
    queries++;
    // Ungrouped rows are equivalent inputs for the reducers under test.
    return rows.filter((row) => matches(row, where)).map((row) => ({ ...row, _sum: { amount: row.amount } }));
  };
  const tx = {
    // The monthly reader now receives a joined SQL projection. Keep the original
    // fixture oracle; real SQL equivalence is covered by the MySQL read regression.
    $queryRaw: async (query: Prisma.Sql) => {
      const householdId = query.values[0], before = query.values[1] as Date;
      return accounts.filter(a => a.householdId === householdId).map(a => {
        let movement = new Prisma.Decimal(0);
        for (const t of transactions.filter(t => t.householdId === householdId && t.accountId === a.id && t.competenceDate < before)) {
          if (t.type === "INCOME" && t.status === "RECEIVED") movement = movement.plus(t.amount);
          if (t.type === "EXPENSE" && t.status === "PAID") movement = movement.minus(t.amount);
        }
        for (const t of transfers.filter(t => t.householdId === householdId && t.competenceDate < before)) {
          if (t.sourceAccountId === a.id) movement = movement.minus(t.amount);
          if (t.destinationAccountId === a.id) movement = movement.plus(t.amount);
        }
        return { ...a, movement };
      });
    },
    account: { findMany: async ({ where }: { where: Row }) => { queries++; return accounts.filter((row) => matches(row, where)); } },
    transaction: { groupBy: groupBy(transactions) }, transfer: { groupBy: groupBy(transfers) },
  } as unknown as Prisma.TransactionClient;
  const actual = await annualBalances(tx, "home", 2026);
  assert.equal(queries, 4, "query count must not grow with the number of months");
  assert.deepEqual(actual.slice(0, 3), ["159.90", "144.80", "149.85"]);
  for (let month = 1; month <= 12; month++) {
    assert.equal(actual[month - 1], (await consolidatedBalance(tx, "home", monthDate(2026, month + 1))).value);
  }
  assert.deepEqual(await annualBalances(tx, "empty", 2026), Array(12).fill("0.00"));
});
