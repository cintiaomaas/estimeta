import { test } from "node:test";
import assert from "node:assert/strict";
import { goalProgress, monthlyEvolution } from "../src/lib/finance/goal-math";
import { goalSchema, contributionSchema, goalFilters } from "../src/lib/validations/goals";
test("metas: progresso, alvo atingido e excesso sem restante negativo", () => {
  assert.equal(goalProgress("10000", [], null, "2026-09-01").progressPercentage, "0.00");
  const result = goalProgress("10000", ["1500", "1000"], null, "2026-09-01");
  assert.equal(result.totalContributed, "2500.00"); assert.equal(result.remainingAmount, "7500.00"); assert.equal(result.progressPercentage, "25.00");
  assert.equal(goalProgress("10000", ["10000"], null, "2026-09-01").reached, true);
  const over = goalProgress("10000", ["10500"], null, "2026-09-01"); assert.equal(over.progressPercentage, "105.00"); assert.equal(over.remainingAmount, "0.00");
});
test("metas: precisão monetária e sugestão arredondada para cima", () => {
  assert.equal(goalProgress("9999999999999.99", ["9999999999999.98"], null, "2026-09-01").remainingAmount, "0.01");
  assert.equal(goalProgress("100", [], "2026-11-10", "2026-09-27").suggestedMonthly, "33.34");
  assert.equal(goalProgress("12000", [], "2027-02-28", "2026-09-27").suggestedMonthly, "2000.00");
  assert.equal(goalProgress("100", [], "2026-09-27", "2026-09-27").monthsRemaining, 1);
  assert.equal(goalProgress("100", [], "2026-09-26", "2026-09-27").suggestedMonthly, null);
  assert.equal(goalProgress("100", [], null, "2026-09-27").suggestedMonthly, null);
  assert.equal(goalProgress("100", [], "2026-12-31", "2026-09-27", "2026-12-01").monthsRemaining, 1);
});
test("metas: evolução acumulada respeita competência de corte", () => {
  const rows = [{ amount: "500", competenceDate: "2026-10-01" }, { amount: "0.10", competenceDate: "2026-09-01" }, { amount: "0.20", competenceDate: "2026-09-01" }];
  assert.deepEqual(monthlyEvolution(rows, "2026-09-30"), [{ month: "2026-09", amount: "0.30", accumulated: "0.30" }]);
  assert.equal(monthlyEvolution(rows, "2026-10-31")[1].accumulated, "500.30");
});
test("metas: schemas estritos, datas válidas, valor positivo e competência normalizada", () => {
  const goal = { name: "Viagem", targetAmount: "10000", startDate: "2026-09-01" };
  assert.ok(goalSchema.safeParse(goal).success);
  for (const change of [{ targetAmount: "0" }, { targetAmount: "1.001" }, { targetDate: "2026-08-01" }, { householdId: "untrusted" }, { startDate: "2026-02-30" }]) assert.equal(goalSchema.safeParse({ ...goal, ...change }).success, false);
  assert.equal(contributionSchema.parse({ amount: "10", contributionDate: "2026-09-10", competenceDate: "2026-10-20" }).competenceDate, "2026-10-01");
  assert.equal(goalFilters.safeParse({ through: "2026-13-01" }).success, false);
});
