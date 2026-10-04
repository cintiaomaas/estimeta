// Original paginated reader, used only for differential MySQL regression.
import { Prisma, type PrismaClient } from "@prisma/client";
import { transactionFilterSchema } from "../../src/lib/validations/finance";
import { databaseDate, dateOnly, displayStatus, todayInBrazil } from "../../src/lib/finance/dates";
const include = { account: { select: { id: true, name: true, isActive: true } }, category: { select: { id: true, name: true, isActive: true } } } satisfies Prisma.TransactionInclude;
function serializeTransaction(row: Prisma.TransactionGetPayload<{ include: typeof include }>) {
  const result = { ...row, amount: row.amount.toFixed(2), scheduledDate: dateOnly(row.scheduledDate), transactionDate: row.transactionDate ? dateOnly(row.transactionDate) : null, competenceDate: dateOnly(row.competenceDate) };
  return { ...result, displayStatus: displayStatus(result) };
}

export async function referenceTransactions(db: PrismaClient, householdId: string, input: unknown) {
  const atomic = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(work, { isolationLevel: "Serializable" });
      const filters = transactionFilterSchema.parse(input);
      const { page, limit, sort, order } = filters;
      const today = databaseDate(todayInBrazil());
      const where: Prisma.TransactionWhereInput = {
        householdId, type: filters.type, accountId: filters.accountId, categoryId: filters.categoryId,
        description: filters.search ? { contains: filters.search } : undefined,
      };
      if (filters.status === "OVERDUE") {
        where.AND = [{ type: "EXPENSE", status: "PENDING", scheduledDate: { lt: today } }];
      } else if (filters.status === "PENDING") {
        where.status = "PENDING";
        where.OR = [{ type: "INCOME" }, { scheduledDate: { gte: today } }];
      } else if (filters.status) where.status = filters.status;
      if (filters.year) {
        const year = String(filters.year).padStart(4, "0");
        const month = filters.month ? String(filters.month).padStart(2, "0") : "01";
        const lastMonth = filters.month ? month : "12";
        where.competenceDate = { gte: databaseDate(`${year}-${month}-01`), lte: databaseDate(`${year}-${lastMonth}-01`) };
      }
      // Date range refers to scheduled dates; monthly filters always use competence.
      if (filters.startDate || filters.endDate) where.scheduledDate = { ...(filters.startDate ? { gte: databaseDate(filters.startDate) } : {}), ...(filters.endDate ? { lte: databaseDate(filters.endDate) } : {}) };
      const field = sort === "date" ? "scheduledDate" : sort;
      return atomic(async (tx) => {
        const total = await tx.transaction.count({ where });
        const rows = await tx.transaction.findMany({ where, include, orderBy: [{ [field]: order }, { id: "desc" }], skip: (page - 1) * limit, take: limit });
        return { data: rows.map(serializeTransaction), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
      });
    }
