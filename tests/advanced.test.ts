import { test } from "node:test";
import assert from "node:assert/strict";
import { splitInstallments } from "../src/lib/finance/installments";
import { addMonthsClamped } from "../src/lib/finance/months";
import { decimal } from "../src/lib/finance/report-math";
import { installmentSchema, recurringSchema, transferSchema } from "../src/lib/validations/advanced";
import { nextScheduledDate } from "../src/lib/finance/recurrence";
const id = "10000000-0000-4000-8000-000000000001";
const input = { type: "EXPENSE", description: "Notebook", accountId: id, categoryId: id, amount: "1000", competenceDate: "2027-01-01", scheduledDate: "2027-01-31", status: "PENDING", installmentCount: 3 };
test("próximo lançamento respeita vigência, dia mensal, bissexto e desativação", () => {
  const rule = { isActive: true, startDate: "2026-09-26", endDate: "2026-12-26", dayOfMonth: 10 };
  assert.equal(nextScheduledDate(rule, "2026-09-27"), "2026-10-10");
  assert.equal(nextScheduledDate(rule, "2026-10-10"), "2026-10-10");
  assert.equal(nextScheduledDate(rule, "2026-12-11"), null);
  assert.equal(nextScheduledDate({ ...rule, isActive: false }, "2026-09-27"), null);
  assert.equal(nextScheduledDate({ ...rule, startDate: "2028-01-31", endDate: null, dayOfMonth: 31 }, "2028-02-01"), "2028-02-29");
  assert.equal(nextScheduledDate({ ...rule, startDate: "9999-12-01", endDate: null }, "9999-12-11"), null);
});
test("parcelas preservam todos os centavos, inclusive montantes máximos", () => {
  assert.deepEqual(splitInstallments("1000", 3), ["333.34", "333.33", "333.33"]);
  for (const total of ["3.60", "100.00", "9999999999999.99"]) for (const count of [2, 3, 12, 360]) {
    const values = splitInstallments(total, count);
    assert.equal(values.reduce((sum, value) => sum.plus(value), decimal()).toFixed(2), decimal(total).toFixed(2));
    assert.ok(values.every((value) => decimal(value).gt(0)));
  }
  assert.throws(() => splitInstallments("0.01", 2));
});
test("datas preservam dia original, ano bissexto e virada de ano", () => {
  assert.equal(addMonthsClamped("2027-01-31", 1), "2027-02-28");
  assert.equal(addMonthsClamped("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonthsClamped("2027-01-31", 2), "2027-03-31");
  assert.equal(addMonthsClamped("2026-12-31", 1), "2027-01-31");
  assert.throws(() => addMonthsClamped("9999-12-01", 1));
});
test("schemas estritos recusam injeção, datas, status e parcelas inválidas", () => {
  assert.ok(installmentSchema.safeParse(input).success);
  for (const changes of [{ amount: "0.01" }, { type: "INCOME" }, { status: "PAID" }, { installmentCount: 0 }, { installmentCount: 361 }, { householdId: id }, { competenceDate: "9999-12-01" }]) assert.equal(installmentSchema.safeParse({ ...input, ...changes }).success, false);
  const transfer = { sourceAccountId: id, destinationAccountId: "20000000-0000-4000-8000-000000000002", amount: "200", transferDate: "2027-01-31", competenceDate: "2027-01-01" };
  assert.ok(transferSchema.safeParse(transfer).success);
  for (const changes of [{ destinationAccountId: id }, { amount: "0" }, { amount: "-1" }, { transferDate: "2027-02-29" }, { createdBy: id }]) assert.equal(transferSchema.safeParse({ ...transfer, ...changes }).success, false);
  const recurring = { type: "EXPENSE", description: "Internet", amount: "120", accountId: id, categoryId: id, dayOfMonth: 10, startDate: "2027-01-01" };
  assert.ok(recurringSchema.safeParse(recurring).success);
  for (const changes of [{ dayOfMonth: 32 }, { frequency: "DAILY" }, { endDate: "2026-12-01" }, { userId: id }]) assert.equal(recurringSchema.safeParse({ ...recurring, ...changes }).success, false);
});
