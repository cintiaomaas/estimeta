import { Prisma } from "@prisma/client";
import { decimal, money, monthDate } from "../lib/finance/report-math";

/** Read the history once, retaining the same snapshot and account inclusion rules. */
export async function annualBalances(tx: Prisma.TransactionClient, householdId: string, year: number) {
  const accounts = await tx.account.findMany({ where: { householdId, includeInTotalBalance: true }, select: { id: true, initialBalance: true } });
  const accountIds = accounts.map((row) => row.id);
  let opening = accounts.reduce((sum, row) => sum.plus(row.initialBalance), decimal());
  const changes = Array.from({ length: 12 }, () => decimal());
  const start = monthDate(year, 1), end = monthDate(year + 1, 1);
  const add = (date: Date, amount: Prisma.Decimal.Value, sign: number) => {
    const value = decimal(amount).mul(sign);
    if (date < start) opening = opening.plus(value);
    else changes[date.getUTCMonth()] = changes[date.getUTCMonth()].plus(value);
  };
  if (accountIds.length) {
    const transactions = await tx.transaction.groupBy({ by: ["competenceDate", "type"], where: { householdId, accountId: { in: accountIds }, competenceDate: { lt: end }, OR: [{ type: "INCOME", status: "RECEIVED" }, { type: "EXPENSE", status: "PAID" }] }, _sum: { amount: true } });
    for (const row of transactions) add(row.competenceDate, row._sum.amount ?? 0, row.type === "INCOME" ? 1 : -1);
    for (const field of ["sourceAccountId", "destinationAccountId"] as const) {
      const transfers = await tx.transfer.groupBy({ by: ["competenceDate"], where: { householdId, [field]: { in: accountIds }, competenceDate: { lt: end } }, _sum: { amount: true } });
      for (const row of transfers) add(row.competenceDate, row._sum.amount ?? 0, field === "sourceAccountId" ? -1 : 1);
    }
  }
  return changes.map((change) => { opening = opening.plus(change); return money(opening); });
}

/** One competence cutoff for accounts, dashboard and annual report. */
export async function accountBalances(tx: Prisma.TransactionClient, householdId: string, before: Date) {
  const rows = await tx.account.findMany({ where: { householdId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  const values = new Map(rows.map((row) => [row.id, decimal(row.initialBalance)]));
  const transactions = await tx.transaction.groupBy({ by: ["accountId", "type"], where: { householdId, competenceDate: { lt: before }, OR: [{ type: "INCOME", status: "RECEIVED" }, { type: "EXPENSE", status: "PAID" }] }, _sum: { amount: true } });
  for (const row of transactions) values.set(row.accountId, values.get(row.accountId)!.plus(decimal(row._sum.amount ?? 0).mul(row.type === "INCOME" ? 1 : -1)));
  for (const field of ["sourceAccountId", "destinationAccountId"] as const) {
    const transfers = await tx.transfer.groupBy({ by: [field], where: { householdId, competenceDate: { lt: before } }, _sum: { amount: true } });
    for (const row of transfers) values.set(row[field], values.get(row[field])!.plus(decimal(row._sum.amount ?? 0).mul(field === "sourceAccountId" ? -1 : 1)));
  }
  return rows.map((row) => ({ ...row, initialBalance: money(row.initialBalance), balance: money(values.get(row.id)!) }));
}
export async function consolidatedBalance(tx: Prisma.TransactionClient, householdId: string, before: Date) {
  const rows = await accountBalances(tx, householdId, before);
  return { value: money(rows.filter((row) => row.includeInTotalBalance).reduce((sum, row) => sum.plus(row.balance), decimal())), accountCount: rows.length };
}
