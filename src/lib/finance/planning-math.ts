import { decimal, money, percentage } from "./report-math";
import type { PlanningInput } from "../validations/planning";
export function calculatePlanning(config: PlanningInput, realizedIncome: string, commitments: { categoryId: string; amount: string }[]) {
  const income = config.incomeSource === "MANUAL" ? config.referenceIncome : realizedIncome;
  const available = decimal(income).gt(0);
  const active = config.enabled ? config.groups.filter((g) => g.active) : [];
  const total = active.reduce((sum, g) => sum.plus(g.percentage), decimal());
  const assigned = new Set(active.flatMap((g) => g.categoryIds));
  return {
    enabled: config.enabled, incomeSource: config.incomeSource, referenceIncome: money(income), available,
    totalPercentage: money(total), remainingPercentage: money(decimal(100).minus(total)),
    unclassified: money(commitments.filter((c) => !assigned.has(c.categoryId)).reduce((s, c) => s.plus(c.amount), decimal())),
    groups: active.map((g) => {
      const planned = decimal(income).mul(g.percentage).div(100);
      const committed = commitments.filter((c) => g.categoryIds.includes(c.categoryId)).reduce((sum, c) => sum.plus(c.amount), decimal());
      const remaining = planned.minus(committed);
      const state = !available ? "UNAVAILABLE" : committed.gt(planned) ? "EXCEEDED" : committed.eq(planned) ? "REACHED" : committed.gte(planned.mul(g.alertPercentage).div(100)) ? "NEAR" : "WITHIN";
      return { name: g.name, percentage: money(g.percentage), alertPercentage: money(g.alertPercentage), planned: money(planned), committed: money(committed), incomePercentage: available ? percentage(committed, income) : null, utilizationPercentage: available ? percentage(committed, planned) : null, remaining: available ? money(remaining.gt(0) ? remaining : 0) : null, excess: available ? money(remaining.lt(0) ? remaining.negated() : 0) : null, excessPercentagePoints: available ? money(committed.gt(planned) ? committed.div(income).mul(100).minus(g.percentage) : 0) : null, state };
    }),
  };
}

