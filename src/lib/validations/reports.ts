import { z } from "zod";
import { todayInBrazil } from "../finance/dates";
const year = z.coerce.number().int().min(1000).max(9999);
const month = z.coerce.number().int().min(1).max(12);
export function reportFilters(input: unknown, monthly: boolean, today = todayInBrazil()) {
  const defaults = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  return monthly
    ? z.object({ year: year.default(defaults.year), month: month.default(defaults.month) }).strict().parse(input)
    : { ...z.object({ year: year.default(defaults.year) }).strict().parse(input), month: 1 };
}
