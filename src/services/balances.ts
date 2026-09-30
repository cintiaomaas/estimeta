import { Prisma } from "@prisma/client";
import { decimal, money } from "../lib/finance/report-math";

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
