import { annualBalances, consolidatedBalance } from "./balances";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { FinancialActor } from "./finance";
import { dateOnly, displayStatus, todayInBrazil } from "../lib/finance/dates";
import { averageMonths, comparison, decimal, money, monthDate, net, percentage } from "../lib/finance/report-math";
import { reportFilters } from "../lib/validations/reports";
import { goalsSummary } from "./goals";
import { planningReport } from "./planning";

const realized: Prisma.TransactionWhereInput = { OR: [{ type: "INCOME", status: "RECEIVED" }, { type: "EXPENSE", status: "PAID" }] };
const detail = { id: true, type: true, description: true, amount: true, status: true, scheduledDate: true, competenceDate: true, transactionDate: true, account: { select: { name: true } }, category: { select: { name: true } } } satisfies Prisma.TransactionSelect;
type Detail = Prisma.TransactionGetPayload<{ select: typeof detail }>;
const serialize = (row: Detail, today: string) => ({ ...row, amount: money(row.amount), scheduledDate: dateOnly(row.scheduledDate), competenceDate: dateOnly(row.competenceDate), transactionDate: row.transactionDate ? dateOnly(row.transactionDate) : null, displayStatus: displayStatus({ ...row, scheduledDate: dateOnly(row.scheduledDate) }, today) });

/** Only server entry points may construct this service, using authenticated membership. */
export function reportService(db: PrismaClient, actor: FinancialActor, now = new Date()) {
  const householdId = actor.householdId;
  const today = todayInBrazil(now);
  const snapshot = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(work, { isolationLevel: "RepeatableRead", timeout: 15000 });
  async function years(tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<{ year: number }[]>(Prisma.sql`SELECT DISTINCT YEAR(competenceDate) AS year FROM Transaction WHERE householdId = ${householdId} UNION SELECT DISTINCT YEAR(competenceDate) AS year FROM Transfer WHERE householdId = ${householdId} ORDER BY year`);
    return [...new Set([...rows.map((row) => Number(row.year)), Number(today.slice(0, 4))])].sort((a, b) => b - a);
  }
  async function balance(tx: Prisma.TransactionClient, before: Date) {
    return consolidatedBalance(tx, householdId, before);
  }
  const periodWhere = (year: number, month: number) => ({ competenceDate: { gte: monthDate(year, month), lt: monthDate(year, month + 1) } });
  return {
    async dashboard(input: unknown) {
      const { year, month } = reportFilters(input, true, today);
      return snapshot(async (tx) => {
        const period = periodWhere(year, month);
        const history = await tx.transaction.groupBy({ by: ["competenceDate", "type"], where: { householdId, AND: [realized], competenceDate: { gte: monthDate(year, month - 5), lt: monthDate(year, month + 1) } }, _sum: { amount: true } });
        const trend = Array.from({ length: 6 }, (_, index) => {
          const date = monthDate(year, month - 5 + index);
          const rows = history.filter((row) => row.competenceDate.getUTCFullYear() === date.getUTCFullYear() && row.competenceDate.getUTCMonth() === date.getUTCMonth());
          const sum = (type: string) => rows.filter((row) => row.type === type).reduce((total, row) => total.plus(row._sum.amount ?? 0), decimal());
          const income = sum("INCOME"), expenses = sum("EXPENSE");
          return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, income: money(income), expenses: money(expenses), netSavings: money(net(income, expenses)) };
        });
        const { income, expenses, netSavings } = trend[5];
        const current = { income, expenses, netSavings };
        const goals = await goalsSummary(tx, householdId, dateOnly(new Date(monthDate(year, month + 1).getTime() - 86400000)));
        const planning = await planningReport(tx, householdId, year, month, current.income);
        const previous = trend[4];
        const accountBalance = await balance(tx, monthDate(year, month + 1));
        const pending = await tx.transaction.groupBy({ by: ["type", "scheduledDate"], where: { householdId, ...period, status: "PENDING" }, _sum: { amount: true } });
        let pendingIncome = decimal(), pendingExpenses = decimal(), overdueExpenses = decimal();
        for (const row of pending) {
          const amount = row._sum.amount ?? 0;
          if (row.type === "INCOME") pendingIncome = pendingIncome.plus(amount);
          else if (displayStatus({ type: row.type, status: "PENDING", scheduledDate: dateOnly(row.scheduledDate) }, today) === "OVERDUE") overdueExpenses = overdueExpenses.plus(amount);
          else pendingExpenses = pendingExpenses.plus(amount);
        }
        const grouped = await tx.transaction.groupBy({ by: ["categoryId"], where: { householdId, ...period, type: "EXPENSE", status: "PAID" }, _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } } });
        const categories = await tx.category.findMany({ where: { householdId, id: { in: grouped.map((r) => r.categoryId) } }, select: { id: true, name: true } });
        const expensesByCategory = grouped.map((row) => ({ id: row.categoryId, name: categories.find((c) => c.id === row.categoryId)!.name, amount: money(row._sum.amount ?? 0), percentage: percentage(row._sum.amount ?? 0, current.expenses) }));
        const top = await tx.transaction.findMany({ where: { householdId, ...period, type: "EXPENSE", status: "PAID" }, select: detail, orderBy: [{ amount: "desc" }, { id: "asc" }], take: 5 });
        const recent = await tx.transaction.findMany({ where: { householdId, ...period }, select: detail, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5 });
        return { goals, planning, period: { year, month }, asOf: today, balance: accountBalance.value, balanceKind: "period" as const, accountCount: accountBalance.accountCount, ...current, pendingIncome: money(pendingIncome), pendingExpenses: money(pendingExpenses), overdueExpenses: money(overdueExpenses), comparison: { income: comparison(current.income, previous.income), expenses: comparison(current.expenses, previous.expenses), netSavings: comparison(current.netSavings, previous.netSavings) }, expensesByCategory, topExpenses: top.map((r) => serialize(r, today)), recentTransactions: recent.map((r) => serialize(r, today)), trend, availableYears: await years(tx) };
      });
    },
    async annual(input: unknown) {
      const { year } = reportFilters(input, false, today);
      return snapshot(async (tx) => {
        const groups = await tx.transaction.groupBy({ by: ["competenceDate", "categoryId", "type"], where: { householdId, AND: [realized], competenceDate: { gte: monthDate(year, 1), lt: monthDate(year + 1, 1) } }, _sum: { amount: true } });
        const categories = await tx.category.findMany({ where: { householdId, OR: [{ isActive: true }, { id: { in: groups.map((r) => r.categoryId) } }] }, select: { id: true, name: true, type: true, isActive: true }, orderBy: { name: "asc" } });
        const divisor = averageMonths(year, today);
        const average = (values: string[]) => divisor ? money(values.slice(0, divisor).reduce((sum, v) => sum.plus(v), decimal()).div(divisor)) : null;
        const balances = await annualBalances(tx, householdId, year);
        const monthlySummary: { month: number; income: string; expenses: string; netSavings: string; balance: string }[] = [];
        for (let index = 0; index < 12; index++) {
          const rows = groups.filter((r) => r.competenceDate.getUTCMonth() === index);
          const sum = (type: string) => rows.filter((r) => r.type === type).reduce((s, r) => s.plus(r._sum.amount ?? 0), decimal());
          const income = sum("INCOME"), expenses = sum("EXPENSE"), savings = net(income, expenses);
          monthlySummary.push({ month: index + 1, income: money(income), expenses: money(expenses), netSavings: money(savings), balance: balances[index] });
        }
        const categoryRows = categories.map((category) => {
          const months = Array.from({ length: 12 }, (_, i) => money(groups.filter((r) => r.categoryId === category.id && r.competenceDate.getUTCMonth() === i).reduce((sum, row) => sum.plus(row._sum.amount ?? 0), decimal())));
          return { ...category, months, total: money(months.reduce((sum, v) => sum.plus(v), decimal())), average: average(months) };
        });
        const annualTotals = Object.fromEntries((["income", "expenses", "netSavings"] as const).map((key) => [key, money(monthlySummary.reduce((sum, row) => sum.plus(row[key]), decimal()))])) as { income: string; expenses: string; netSavings: string };
        return { year, averageMonths: divisor, availableYears: await years(tx), monthlySummary, annualTotals: { ...annualTotals, balance: balances[11] }, averages: { income: average(monthlySummary.map((r) => r.income)), expenses: average(monthlySummary.map((r) => r.expenses)), netSavings: average(monthlySummary.map((r) => r.netSavings)) }, incomeCategories: categoryRows.filter((c) => c.type === "INCOME"), expenseCategories: categoryRows.filter((c) => c.type === "EXPENSE") };
      });
    },
  };
}
export type DashboardReport = Awaited<ReturnType<ReturnType<typeof reportService>["dashboard"]>>;
export type AnnualReport = Awaited<ReturnType<ReturnType<typeof reportService>["annual"]>>;


