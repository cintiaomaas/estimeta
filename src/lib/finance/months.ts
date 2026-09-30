/** Offset from the original date, so Jan 31 -> Feb 28 -> Mar 31. */
export function addMonthsClamped(value: string, offset: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1 + offset, 1);
  const targetYear = date.getUTCFullYear(), targetMonth = date.getUTCMonth();
  const last = new Date(0);
  last.setUTCFullYear(targetYear, targetMonth + 1, 0);
  if (targetYear < 1000 || targetYear > 9999) throw new Error("O período deve estar entre os anos 1000 e 9999.");
  date.setUTCDate(Math.min(day, last.getUTCDate()));
  return date.toISOString().slice(0, 10);
}
