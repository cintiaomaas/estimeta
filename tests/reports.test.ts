import { test } from "node:test";
import assert from "node:assert/strict";
import { averageMonths, comparison, decimal, money, monthDate, net, percentage } from "../src/lib/finance/report-math";
import { reportFilters } from "../src/lib/validations/reports";
import { currency } from "../src/lib/finance/client";
import { displayStatus } from "../src/lib/finance/dates";
test("economia positiva, negativa e precisão acima de Number seguro", () => {
  assert.equal(money(net("5000", "3000")), "2000.00");
  assert.equal(money(net("5000", "5500.50")), "-500.50");
  assert.equal(money(decimal("9999999999999999.99").plus("0.01")), "10000000000000000.00");
  assert.equal(currency("-0.50"), "-R$ 0,50");
});
test("saldo inicial acumulado janeiro e fevereiro", () => {
  const january = decimal(1000).plus(net(5000, 3000));
  assert.equal(money(january), "3000.00");
  assert.equal(money(january.plus(net(5000, 4000))), "4000.00");
  assert.equal(money(january.plus(net(0, 0))), "3000.00");
});
test("comparações, bases negativas e zero", () => {
  assert.equal(comparison(6000, 5000), "20.00");
  assert.equal(comparison(-500, -1000), "50.00");
  assert.equal(comparison(10, 0), null);
  assert.equal(comparison(0, 0), null);
});
test("percentuais de categorias e total vazio", () => {
  assert.deepEqual([600, 1200, 200].map((n) => percentage(n, 2000)), ["30.00", "60.00", "10.00"]);
  assert.equal(percentage(0, 0), "0.00");
});
test("atraso usa regra centralizada e não inclui vencimento de hoje ou receita", () => {
  assert.equal(displayStatus({ type: "EXPENSE", status: "PENDING", scheduledDate: "2027-01-14" }, "2027-01-15"), "OVERDUE");
  for (const record of [{ type: "INCOME", status: "PENDING", scheduledDate: "2027-01-14" }, { type: "EXPENSE", status: "PENDING", scheduledDate: "2027-01-15" }]) assert.equal(displayStatus(record, "2027-01-15"), "PENDING");
});
test("médias, virada de ano e filtros estritos", () => {
  assert.equal(averageMonths(2026, "2027-02-15"), 12);
  assert.equal(averageMonths(2027, "2027-02-15"), 2);
  assert.equal(averageMonths(2028, "2027-02-15"), 0);
  assert.equal(monthDate(2027, 0).toISOString().slice(0, 10), "2026-12-01");
  assert.deepEqual(reportFilters({}, true, "2027-02-15"), { year: 2027, month: 2 });
  for (const input of [{ month: 13 }, { month: 0 }, { year: 10000 }, { year: "abc" }, { householdId: "other" }]) assert.throws(() => reportFilters(input, true));
});
