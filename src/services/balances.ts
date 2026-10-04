import { Prisma, type Account } from "@prisma/client";
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
  // Aggregate each source before joining: no multiplication of transactions by transfers.
  // All three branches and the account lookup are scoped to the same Household/cutoff.
  type BalanceRow = Omit<Account, "isActive" | "includeInTotalBalance"> & {
    isActive: boolean | number; includeInTotalBalance: boolean | number; movement: Prisma.Decimal;
  };
  const rows = await tx.$queryRaw<BalanceRow[]>(Prisma.sql`
    SELECT a.*, COALESCE(m.movement, 0) AS movement
    FROM Account a
    LEFT JOIN (
      SELECT accountId, SUM(amount) AS movement FROM (
        SELECT accountId, SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) AS amount
        FROM Transaction
        WHERE householdId = ${householdId} AND competenceDate < ${before}
          AND ((type = 'INCOME' AND status = 'RECEIVED') OR (type = 'EXPENSE' AND status = 'PAID'))
        GROUP BY accountId
        UNION ALL
        SELECT sourceAccountId AS accountId, -SUM(amount) AS amount FROM Transfer
        WHERE householdId = ${householdId} AND competenceDate < ${before} GROUP BY sourceAccountId
        UNION ALL
        SELECT destinationAccountId AS accountId, SUM(amount) AS amount FROM Transfer
        WHERE householdId = ${householdId} AND competenceDate < ${before} GROUP BY destinationAccountId
      ) movements GROUP BY accountId
    ) m ON m.accountId = a.id
    WHERE a.householdId = ${householdId}
    ORDER BY a.isActive DESC, a.name ASC
  `);
  return rows.map(({ movement, ...row }) => ({ ...row,
    isActive: Boolean(row.isActive), includeInTotalBalance: Boolean(row.includeInTotalBalance),
    initialBalance: money(row.initialBalance), balance: money(decimal(row.initialBalance).plus(movement)),
  }));
}
export async function consolidatedBalance(tx: Prisma.TransactionClient, householdId: string, before: Date) {
  const rows = await accountBalances(tx, householdId, before);
  return { value: money(rows.filter((row) => row.includeInTotalBalance).reduce((sum, row) => sum.plus(row.balance), decimal())), accountCount: rows.length };
}
