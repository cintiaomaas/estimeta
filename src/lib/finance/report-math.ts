import { Prisma } from "@prisma/client";
// A private Decimal constructor avoids changing precision elsewhere in the app.
const Decimal = Prisma.Decimal.clone({ precision: 40 });
export const decimal = (value: Prisma.Decimal.Value = 0) => new Decimal(value);
export const money = (value: Prisma.Decimal.Value) => decimal(value).toFixed(2);
export const net = (income: Prisma.Decimal.Value, expense: Prisma.Decimal.Value) => decimal(income).minus(expense);
export function percentage(value: Prisma.Decimal.Value, total: Prisma.Decimal.Value) {
  return decimal(total).isZero() ? "0.00" : decimal(value).div(total).mul(100).toFixed(2);
}
export function comparison(current: Prisma.Decimal.Value, previous: Prisma.Decimal.Value) {
  return decimal(previous).isZero() ? null : decimal(current).minus(previous).div(decimal(previous).abs()).mul(100).toFixed(2);
}
export function averageMonths(year: number, today: string) {
  const current = Number(today.slice(0, 4));
  return year < current ? 12 : year === current ? Number(today.slice(5, 7)) : 0;
}
export function monthDate(year: number, month: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
