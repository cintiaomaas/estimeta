/** Financial dates are YYYY-MM-DD strings at the API boundary and MySQL DATEs. */
export function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }
export function databaseDate(date: string) { return new Date(`${date}T00:00:00.000Z`); }
export function todayInBrazil(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function displayDate(value: string | null) { return value ? value.split("-").reverse().join("/") : "—"; }
export function displayCompetence(value: string) { return `${value.slice(5, 7)}/${value.slice(0, 4)}`; }
export function displayStatus(record: { type: string; status: string; scheduledDate: string }, today = todayInBrazil()) {
  return record.type === "EXPENSE" && record.status === "PENDING" && record.scheduledDate < today ? "OVERDUE" : record.status;
}
