import { accountBalances } from "./balances";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/api/errors";
import { accountSchema, categorySchema, transactionSchema, transactionFilterSchema, categoryFilterSchema } from "../lib/validations/finance";
import { databaseDate, dateOnly, displayStatus, todayInBrazil } from "../lib/finance/dates";
import { monthDate } from "../lib/finance/report-math";

export type FinancialActor = { userId: string; householdId: string };
const notFound = () => new AppError("NOT_FOUND", "Registro não encontrado neste espaço familiar.", 404);
const invalid = (message: string) => new AppError("INVALID_INPUT", message, 400);
const include = { account: { select: { id: true, name: true, isActive: true } }, category: { select: { id: true, name: true, isActive: true } } } satisfies Prisma.TransactionInclude;
function serializeTransaction(row: Prisma.TransactionGetPayload<{ include: typeof include }>) {
  const result = { ...row, amount: row.amount.toFixed(2), scheduledDate: dateOnly(row.scheduledDate), transactionDate: row.transactionDate ? dateOnly(row.transactionDate) : null, competenceDate: dateOnly(row.competenceDate) };
  return { ...result, displayStatus: displayStatus(result) };
}

/** Called only by server routes with an actor resolved from the authenticated membership. */
export function financialService(db: PrismaClient, actor: FinancialActor) {
  const householdId = actor.householdId;
  const whereId = (id: string) => ({ id, householdId });
  async function atomic<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
  }
  return {
    async accounts(input: unknown = {}) {
      const filters = z.object({ year: transactionFilterSchema.shape.year, month: transactionFilterSchema.shape.month }).strict().parse(input);
      if (filters.month && !filters.year) throw invalid("Informe o ano ao filtrar por mês.");
      return db.$transaction(async (tx) => {
        const period = filters.year ? `${filters.year}-${String(filters.month ?? 12).padStart(2, "0")}` : todayInBrazil().slice(0, 7);
        return (await accountBalances(tx, householdId, monthDate(Number(period.slice(0, 4)), Number(period.slice(5, 7)) + 1))).map((row) => ({ ...row, balancePeriod: period }));
      }, { isolationLevel: "RepeatableRead" });
    },
    async account(id: string) {
      const row = await db.account.findFirst({ where: whereId(id) });
      if (!row) throw notFound();
      return { ...row, initialBalance: row.initialBalance.toFixed(2) };
    },
    async saveAccount(input: unknown, id?: string) {
      const data = accountSchema.parse(input);
      return atomic(async (tx) => {
        if (id && !await tx.account.findFirst({ where: whereId(id) })) throw notFound();
        const row = id ? await tx.account.update({ where: { id, householdId }, data }) : await tx.account.create({ data: { ...data, householdId } });
        return { ...row, initialBalance: row.initialBalance.toFixed(2) };
      });
    },
    async removeAccount(id: string) {
      return atomic(async (tx) => {
        if (!await tx.account.findFirst({ where: whereId(id) })) throw notFound();
        if (await tx.financialGoal.count({ where: { householdId, accountId: id } }) || await tx.goalContribution.count({ where: { householdId, accountId: id } }) || await tx.transaction.count({ where: { householdId, accountId: id } }) || await tx.recurringTransaction.count({ where: { householdId, accountId: id } }) || await tx.transfer.count({ where: { householdId, OR: [{ sourceAccountId: id }, { destinationAccountId: id }] } })) {
          await tx.account.update({ where: { id, householdId }, data: { isActive: false } });
          return { message: "Conta desativada para preservar os lançamentos existentes.", deactivated: true };
        }
        await tx.account.delete({ where: { id, householdId } });
        return { message: "Conta excluída com sucesso.", deactivated: false };
      });
    },
    async categories(input: unknown = {}) {
      const filters = categoryFilterSchema.parse(input);
      return db.category.findMany({ where: { householdId, ...filters }, orderBy: [{ type: "asc" }, { name: "asc" }] });
    },
    async category(id: string) {
      const row = await db.category.findFirst({ where: whereId(id) });
      if (!row) throw notFound();
      return row;
    },
    async saveCategory(input: unknown, id?: string) {
      const data = categorySchema.parse(input);
      return atomic(async (tx) => {
        if (id) {
          const previous = await tx.category.findFirst({ where: whereId(id) });
          if (!previous) throw notFound();
          if (previous.type !== data.type && await tx.planningGroupCategory.count({ where: { householdId, categoryId: id } })) throw invalid("Remova esta categoria dos grupos de planejamento antes de mudar seu tipo.");
          if (previous.type !== data.type && (await tx.transaction.count({ where: { householdId, categoryId: id } }) || await tx.recurringTransaction.count({ where: { householdId, categoryId: id } }))) throw new AppError("CATEGORY_IN_USE", "Uma categoria utilizada não pode mudar de tipo. Crie outra categoria.", 409);
        }
        if (await tx.category.findFirst({ where: { householdId, type: data.type, name: data.name, ...(id ? { id: { not: id } } : {}) } })) throw new AppError("DUPLICATE_CATEGORY", "Já existe uma categoria com esse nome e tipo, inclusive entre as desativadas.", 409);
        return id ? tx.category.update({ where: { id, householdId }, data }) : tx.category.create({ data: { ...data, householdId } });
      });
    },
    async removeCategory(id: string) {
      return atomic(async (tx) => {
        if (!await tx.category.findFirst({ where: whereId(id) })) throw notFound();
        if ((await tx.transaction.count({ where: { householdId, categoryId: id } }) || await tx.recurringTransaction.count({ where: { householdId, categoryId: id } }))) {
          await tx.category.update({ where: { id, householdId }, data: { isActive: false } });
          return { message: "Categoria desativada para preservar o histórico dos lançamentos.", deactivated: true };
        }
        await tx.category.delete({ where: { id, householdId } });
        return { message: "Categoria excluída com sucesso.", deactivated: false };
      });
    },
    async transactions(input: unknown) {
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
    },
    async transaction(id: string) {
      const row = await db.transaction.findFirst({ where: whereId(id), include });
      if (!row) throw notFound();
      return serializeTransaction(row);
    },
    async saveTransaction(input: unknown, id?: string) {
      const data = transactionSchema.parse(input);
      return atomic(async (tx) => {
        const previous = id ? await tx.transaction.findFirst({ where: whereId(id) }) : null;
        if (id && !previous) throw notFound();
        if (previous?.installmentPlanId && data.type !== "EXPENSE") throw invalid("Uma parcela deve permanecer como despesa.");
        if (previous?.recurringOccurrenceId && data.type !== previous.type) throw invalid("Preserve o tipo da ocorrência. Crie outro lançamento para mudar o tipo.");
        const account = await tx.account.findFirst({ where: { householdId, id: data.accountId } });
        const category = await tx.category.findFirst({ where: { householdId, id: data.categoryId } });
        if (!account || (!account.isActive && previous?.accountId !== account.id)) throw invalid("Selecione uma conta ativa do seu espaço familiar.");
        if (!category || (!category.isActive && previous?.categoryId !== category.id)) throw invalid("Selecione uma categoria ativa do seu espaço familiar.");
        if (category.type !== data.type) throw invalid("A categoria deve corresponder ao tipo de lançamento.");
        const values = { ...data, amount: new Prisma.Decimal(data.amount), scheduledDate: databaseDate(data.scheduledDate), transactionDate: data.transactionDate ? databaseDate(data.transactionDate) : null, competenceDate: databaseDate(data.competenceDate) };
        const row = id ? await tx.transaction.update({ where: { id, householdId }, data: values, include }) : await tx.transaction.create({ data: { ...values, householdId, createdBy: actor.userId }, include });
        return serializeTransaction(row);
      });
    },
    async removeTransaction(id: string) {
      const result = await db.transaction.deleteMany({ where: whereId(id) });
      if (!result.count) throw notFound();
      return { message: "Lançamento excluído com sucesso." };
    },
  };
}

