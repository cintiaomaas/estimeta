import { addMonthsClamped } from "./months";

export function monthlyDueDate(competence: string, day: number) {
  return addMonthsClamped(`${competence.slice(0, 7)}-${String(day).padStart(2, "0")}`, 0);
}

/** Next scheduled occurrence, whether already generated or still to be generated. */
export function nextScheduledDate(rule: { isActive: boolean; startDate: string; endDate: string | null; dayOfMonth: number }, today: string) {
  if (!rule.isActive) return null;
  const from = rule.startDate > today ? rule.startDate : today;
  let due = monthlyDueDate(from, rule.dayOfMonth);
  if (due < from) {
    if (from.startsWith("9999-12")) return null;
    due = monthlyDueDate(addMonthsClamped(`${from.slice(0, 7)}-01`, 1), rule.dayOfMonth);
  }
  return rule.endDate && due > rule.endDate ? null : due;
}
