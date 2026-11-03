import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, type PrismaClient } from "@prisma/client";
import { financialService } from "../src/services/finance";
import { expensePaymentSchema } from "../src/lib/validations/finance";

const version = "2026-11-01T12:00:00.000Z";
const payment = { status: "PAID", transactionDate: "2026-11-03", expectedUpdatedAt: version };
function fixture(overrides = {}) {
  let row = { id: "expense", householdId: "home", type: "EXPENSE", status: "PENDING", updatedAt: new Date(version),
    amount: new Prisma.Decimal("123.45"), scheduledDate: new Date("2026-10-01"), competenceDate: new Date("2026-10-01"), transactionDate: null,
    installmentPlanId: "plan", recurringOccurrenceId: "occurrence", accountId: "account", categoryId: "category", ...overrides };
  const updates: unknown[] = [];
  const tx = { transaction: {
    findFirst: async ({ where }: { where: { id: string; householdId: string } }) => row.id === where.id && row.householdId === where.householdId ? row : null,
    update: async ({ data }: { data: Partial<typeof row> }) => { updates.push(data); row = { ...row, ...data }; return row; },
  } };
  const db = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } as unknown as PrismaClient;
  return { service: financialService(db, { userId: "user", householdId: "home" }), updates };
}
test("payment updates only selected expense status/date and undo restores pending", async () => {
  const { service, updates } = fixture();
  const paid = await service.setExpensePayment(payment, "expense");
  assert.equal(paid.status, "PAID");
  assert.equal(paid.amount, "123.45");
  assert.equal(paid.competenceDate, "2026-10-01");
  assert.equal(paid.transactionDate, "2026-11-03");
  assert.deepEqual(Object.keys(updates[0] as object).sort(), ["status", "transactionDate", "updatedAt"]);
  const undone = await service.setExpensePayment({ status: "PENDING", transactionDate: null, expectedUpdatedAt: paid.updatedAt.toISOString() }, "expense");
  assert.equal(undone.status, "PENDING");
  assert.equal(undone.transactionDate, null);
});
test("rejects foreign households, income, duplicate payment and stale undo", async () => {
  for (const override of [{ householdId: "other" }, { type: "INCOME" }, { status: "PAID" }, { updatedAt: new Date("2026-11-02") }]) {
    const { service, updates } = fixture(override);
    await assert.rejects(service.setExpensePayment(payment, "expense"));
    assert.equal(updates.length, 0);
  }
  const { service } = fixture();
  await service.setExpensePayment(payment, "expense");
  await assert.rejects(service.setExpensePayment({ status: "PENDING", transactionDate: null, expectedUpdatedAt: version }, "expense"));
});
test("payment validates real dates and rejects unrelated fields", () => {
  for (const input of [{ ...payment, transactionDate: "2026-02-30" }, { ...payment, amount: "1.00" }, { ...payment, transactionDate: null }, { ...payment, status: "PENDING" }]) {
    assert.equal(expensePaymentSchema.safeParse(input).success, false);
  }
});
