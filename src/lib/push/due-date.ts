import { databaseDate, todayInBrazil } from "../finance/dates";

export function tomorrowInBrazil(now = new Date()) {
  const date = databaseDate(todayInBrazil(now));
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
