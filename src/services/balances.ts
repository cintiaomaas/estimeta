import { readQuote, valuationDate } from "./exchange-rates";
import { Prisma, type Account } from "@prisma/client";
import { decimal, money, monthDate } from "../lib/finance/report-math";

/** Read the history once, retaining the same snapshot and account inclusion rules. */
export async function annualBalances(tx: Prisma.TransactionClient, householdId: string, year: number, exchangeStatus = { incomplete: false, stale: false }) {
  const accounts = await tx.account.findMany({ where: { householdId, includeInTotalBalance: true }, select: { id: true, initialBalance: true, currency: true } });
  if (accounts.some(a => a.currency && a.currency !== "BRL")) {
    const results = [];
    for (let month = 1; month <= 12; month++) {
      const balance = await consolidatedBalance(tx, householdId, monthDate(year, month + 1));
      results.push(balance.value);
      exchangeStatus.incomplete ||= balance.exchangeIncomplete;
      exchangeStatus.stale ||= balance.exchangeStale;
    }
    return results;
  }
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
        SELECT accountId, SUM(CASE WHEN type = 'INCOME' THEN COALESCE(originalAmount, amount) ELSE -COALESCE(originalAmount, amount) END) AS amount
        FROM Transaction
        WHERE householdId = ${householdId} AND competenceDate < ${before}
          AND ((type = 'INCOME' AND status = 'RECEIVED') OR (type = 'EXPENSE' AND status = 'PAID'))
        GROUP BY accountId
        UNION ALL
        SELECT sourceAccountId AS accountId, -SUM(COALESCE(sourceAmount, amount)) AS amount FROM Transfer
        WHERE householdId = ${householdId} AND competenceDate < ${before} GROUP BY sourceAccountId
        UNION ALL
        SELECT destinationAccountId AS accountId, SUM(COALESCE(destinationAmount, amount)) AS amount FROM Transfer
        WHERE householdId = ${householdId} AND competenceDate < ${before} GROUP BY destinationAccountId
      ) movements GROUP BY accountId
    ) m ON m.accountId = a.id
    WHERE a.householdId = ${householdId}
    ORDER BY a.position ASC, a.isActive DESC, a.name ASC, a.id ASC
  `);
  const quotes = new Map(await Promise.all([...new Set(rows.map(r => r.currency ?? "BRL"))].map(async code => [code, await readQuote(tx, code, valuationDate(before))] as const)));
  return rows.map(({ movement, ...row }) => {
    const code = row.currency ?? "BRL", quote = quotes.get(code) ?? null;
    const native = decimal(row.initialBalance).plus(movement);
    const rate = code === "BRL" ? "1" : quote?.rate;
    return { ...row, currency: code,
      isActive: Boolean(row.isActive), includeInTotalBalance: Boolean(row.includeInTotalBalance),
      initialBalance: money(row.initialBalance), initialBalanceBRL: rate ? money(decimal(row.initialBalance).mul(rate)) : null,
      balance: rate ? money(native.mul(rate)) : null, originalBalance: money(native), exchange: quote,
    };
  });
}
export async function consolidatedBalance(tx: Prisma.TransactionClient, householdId: string, before: Date) {
  const rows = await accountBalances(tx, householdId, before);
  return { value: money(rows.filter((row) => row.includeInTotalBalance).reduce((sum, row) => sum.plus(row.balance ?? 0), decimal())), accountCount: rows.length, exchangeIncomplete: rows.some(row => row.includeInTotalBalance && row.balance === null), exchangeStale: rows.some(row => row.includeInTotalBalance && row.exchange?.stale) };
}
