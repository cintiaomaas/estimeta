import { decimal, money, percentage } from "./report-math";
export function goalProgress(target: string, amounts: string[], targetDate: string | null, reference: string, startDate = reference) {
  const total = amounts.reduce((sum, amount) => sum.plus(amount), decimal());
  const remaining = decimal(target).minus(total);
  const rest = remaining.isNegative() ? decimal() : remaining;
  const from = startDate > reference ? startDate : reference;
  // Count calendar months touched, including the partial current/deadline months.
  const months = targetDate && targetDate >= from ? (Number(targetDate.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(targetDate.slice(5, 7)) - Number(from.slice(5, 7)) + 1 : 0;
  return { totalContributed: money(total), remainingAmount: money(rest), progressPercentage: percentage(total, target), reached: total.gte(target), monthsRemaining: months, suggestedMonthly: months ? money(rest.div(months).toDecimalPlaces(2, 0)) : null,
    deadlineStatus: !targetDate ? "Sem prazo" : targetDate < reference ? "Prazo vencido" : targetDate === reference ? "Prazo atingido" : `${months} ${months === 1 ? "mês" : "meses"} disponíveis` };
}
export function monthlyEvolution(rows: { amount: string; competenceDate: string }[], through: string) {
  const months = new Map<string, ReturnType<typeof decimal>>();
  for (const row of rows) if (row.competenceDate.slice(0, 7) <= through.slice(0, 7)) {
    const key = row.competenceDate.slice(0, 7);
    months.set(key, (months.get(key) ?? decimal()).plus(row.amount));
  }
  let total = decimal();
  return [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => { total = total.plus(amount); return { month, amount: money(amount), accumulated: money(total) }; });
}
