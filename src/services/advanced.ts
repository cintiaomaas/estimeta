import { Prisma, type PrismaClient } from "@prisma/client";
import type { FinancialActor } from "./finance";
import { AppError } from "../lib/api/errors";
import { advancedFilters, generationSchema, installmentSchema, recurringSchema, transferSchema } from "../lib/validations/advanced";
import { databaseDate, dateOnly, todayInBrazil } from "../lib/finance/dates";
import { addMonthsClamped } from "../lib/finance/months";
import { splitInstallments } from "../lib/finance/installments";
import { monthDate } from "../lib/finance/report-math";
import { atomic } from "./atomic";
import { monthlyDueDate, nextScheduledDate } from "../lib/finance/recurrence";
import { displayDate, displayCompetence } from "../lib/finance/dates";

const missing = () => new AppError("NOT_FOUND", "Registro não encontrado neste espaço familiar.", 404);
const invalid = (message: string) => new AppError("INVALID_INPUT", message, 400);
const accountNames = { sourceAccount: { select: { name: true } }, destinationAccount: { select: { name: true } } };
const ruleNames = { account: { select: { name: true } }, category: { select: { name: true } } };
function serialize<T extends { amount: Prisma.Decimal }>(row: T) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? dateOnly(value) : key === "amount" ? row.amount.toFixed(2) : value]));
}
function serializeRule<T extends { amount: Prisma.Decimal; isActive: boolean; startDate: Date; endDate: Date | null; dayOfMonth: number }>(row: T): Record<string, unknown> & { nextScheduledDate: string | null } {
  return { ...serialize(row), nextScheduledDate: nextScheduledDate({ ...row, startDate: dateOnly(row.startDate), endDate: row.endDate ? dateOnly(row.endDate) : null }, todayInBrazil()) };
}
export function advancedService(db: PrismaClient, actor: FinancialActor) {
  const { householdId, userId: createdBy } = actor;
  const scoped = (id: string) => ({ id, householdId });
  async function references(tx: Prisma.TransactionClient, data: { accountId: string; categoryId: string; type: string }, previous?: { accountId: string; categoryId: string } | null) {
    const account = await tx.account.findFirst({ where: scoped(data.accountId) });
    const category = await tx.category.findFirst({ where: scoped(data.categoryId) });
    if (!account || (!account.isActive && previous?.accountId !== account.id)) throw invalid("Selecione uma conta ativa do seu espaço familiar.");
    if (!category || category.type !== data.type || (!category.isActive && previous?.categoryId !== category.id)) throw invalid("Selecione uma categoria ativa compatível do seu espaço familiar.");
  }
  async function generate(tx: Prisma.TransactionClient, id: string, competence: string, recreateDeleted = false) {
    const rule = await tx.recurringTransaction.findFirst({ where: scoped(id) });
    if (!rule) throw missing();
    const outcome = (reason: string, message: string, transactionId: string | null = null) => ({ generated: reason === "CREATED", reason, message, transactionId, competenceDate: competence });
    if (!rule.isActive) return outcome("INACTIVE", "Esta recorrência está desativada. Ative-a antes de gerar um lançamento.");
    const due = monthlyDueDate(competence, rule.dayOfMonth);
    if (due < dateOnly(rule.startDate)) return outcome("BEFORE_START", `O vencimento de ${displayDate(due)} é anterior ao início da recorrência (${displayDate(dateOnly(rule.startDate))}). Escolha outro mês ou revise o início da regra.`);
    if (rule.endDate && due > dateOnly(rule.endDate)) return outcome("AFTER_END", `O vencimento de ${displayDate(due)} é posterior ao término da recorrência (${displayDate(dateOnly(rule.endDate))}). Escolha outro mês ou revise o término da regra.`);
    const competenceDate = databaseDate(`${competence.slice(0, 7)}-01`);
    const existing = await tx.recurringOccurrence.findUnique({ where: { recurringTransactionId_competenceDate: { recurringTransactionId: id, competenceDate } }, include: { transaction: { select: { id: true } } } });
    if (existing && (existing.transaction || !recreateDeleted)) return existing.transaction
      ? outcome("ALREADY_EXISTS", `O lançamento de ${displayCompetence(competence)} já existe em Transações. Nenhuma cópia foi criada.`, existing.transaction.id)
      : outcome("DELETED", `O lançamento de ${displayCompetence(competence)} foi excluído anteriormente. Ele não será recriado automaticamente; se necessário, cadastre um lançamento avulso.`);
    await references(tx, rule);
    const occurrence = existing ?? await tx.recurringOccurrence.create({ data: { householdId, recurringTransactionId: id, competenceDate } });
    const transaction = await tx.transaction.create({ data: { householdId, createdBy, accountId: rule.accountId, categoryId: rule.categoryId, type: rule.type, description: rule.description, amount: rule.amount, notes: rule.notes, competenceDate, scheduledDate: databaseDate(due), status: "PENDING", recurringOccurrenceId: occurrence.id } });
    return outcome("CREATED", `Lançamento pendente de ${displayCompetence(competence)} criado, com vencimento em ${displayDate(due)}.`, transaction.id);
  }
  return {
    async createInstallments(input: unknown) {
      const data = installmentSchema.parse(input);
      return atomic(db, async (tx) => {
        await references(tx, data);
        const plan = await tx.installmentPlan.create({ data: { householdId, createdBy, description: data.description, totalAmount: data.amount, installmentCount: data.installmentCount, firstCompetenceDate: databaseDate(data.competenceDate) } });
        const amounts = splitInstallments(data.amount, data.installmentCount);
        await tx.transaction.createMany({ data: amounts.map((amount, index) => ({ householdId, createdBy, accountId: data.accountId, categoryId: data.categoryId, type: "EXPENSE", description: data.description, amount, status: "PENDING", notes: data.notes, competenceDate: databaseDate(addMonthsClamped(data.competenceDate, index)), scheduledDate: databaseDate(addMonthsClamped(data.scheduledDate, index)), installmentPlanId: plan.id, installmentNumber: index + 1, installmentCount: data.installmentCount })) });
        return { ...plan, totalAmount: plan.totalAmount.toFixed(2), firstCompetenceDate: dateOnly(plan.firstCompetenceDate) };
      });
    },
    async installment(id: string) {
      const row = await db.installmentPlan.findFirst({ where: scoped(id), include: { transactions: { orderBy: { installmentNumber: "asc" } } } });
      if (!row) throw missing();
      return { ...row, totalAmount: row.totalAmount.toFixed(2), firstCompetenceDate: dateOnly(row.firstCompetenceDate), transactions: row.transactions.map(serialize) };
    },
    async recurring(input: unknown = {}) {
      const filters = advancedFilters.parse(input);
      const where = { householdId, accountId: filters.accountId, description: filters.search ? { contains: filters.search } : undefined };
      return db.$transaction(async (tx) => ({ data: (await tx.recurringTransaction.findMany({ where, include: ruleNames, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (filters.page - 1) * filters.limit, take: filters.limit })).map(serializeRule), pagination: { page: filters.page, total: await tx.recurringTransaction.count({ where }), limit: filters.limit } }), { isolationLevel: "RepeatableRead" });
    },
    async recurringById(id: string) {
      const row = await db.recurringTransaction.findFirst({ where: scoped(id), include: ruleNames });
      if (!row) throw missing(); return serializeRule(row);
    },
    async saveRecurring(input: unknown, id?: string) {
      const data = recurringSchema.parse(input);
      return atomic(db, async (tx) => {
        const previous = id ? await tx.recurringTransaction.findFirst({ where: scoped(id) }) : null;
        if (id && !previous) throw missing();
        if (previous && previous.revision !== data.revision) throw new AppError("CONFLICT", "A recorrência foi alterada. Reabra antes de salvar.", 409);
        await references(tx, data, previous);
        const values = { ...data, startDate: databaseDate(data.startDate), endDate: data.endDate ? databaseDate(data.endDate) : null, revision: (previous?.revision ?? 0) + 1 };
        const rule = id ? await tx.recurringTransaction.update({ where: scoped(id), data: values, include: ruleNames }) : await tx.recurringTransaction.create({ data: { ...values, householdId, createdBy }, include: ruleNames });
        if (!id) {
          const first = data.startDate.slice(0, 7) > todayInBrazil().slice(0, 7) ? data.startDate.slice(0, 7) : todayInBrazil().slice(0, 7);
          for (let offset = 0; offset < 3; offset++) {
            // At the supported calendar boundary, generate only existing months.
            if (Number(first.slice(0, 4)) * 12 + Number(first.slice(5, 7)) - 1 + offset > 9999 * 12 + 11) break;
            await generate(tx, rule.id, addMonthsClamped(`${first}-01`, offset));
          }
        }
        return serializeRule(rule);
      });
    },
    async deactivateRecurring(id: string) {
      return atomic(db, async (tx) => {
        if (!await tx.recurringTransaction.findFirst({ where: scoped(id) })) throw missing();
        await tx.recurringTransaction.update({ where: scoped(id), data: { isActive: false, revision: { increment: 1 } } });
        return { message: "Recorrência desativada. Os lançamentos existentes foram preservados." };
      });
    },
    async generateRecurring(id: string, input: unknown) {
      const data = generationSchema.parse(input);
      return atomic(db, async (tx) => generate(tx, id, data.competenceDate, true));
    },
    async transfers(input: unknown = {}) {
      const filters = advancedFilters.parse(input);
      const where: Prisma.TransferWhereInput = { householdId, description: filters.search ? { contains: filters.search } : undefined,
        ...(filters.accountId ? { OR: [{ sourceAccountId: filters.accountId }, { destinationAccountId: filters.accountId }] } : {}),
        ...(filters.year ? { competenceDate: { gte: monthDate(filters.year, filters.month ?? 1), lt: monthDate(filters.year, filters.month ? filters.month + 1 : 13) } } : {}) };
      return db.$transaction(async (tx) => ({ data: (await tx.transfer.findMany({ where, include: accountNames, orderBy: [{ competenceDate: "desc" }, { id: "desc" }], skip: (filters.page - 1) * filters.limit, take: filters.limit })).map(serialize), pagination: { page: filters.page, total: await tx.transfer.count({ where }), limit: filters.limit } }), { isolationLevel: "RepeatableRead" });
    },
    async transfer(id: string) {
      const row = await db.transfer.findFirst({ where: scoped(id), include: accountNames });
      if (!row) throw missing(); return serialize(row);
    },
    async saveTransfer(input: unknown, id?: string) {
      const data = transferSchema.parse(input);
      return atomic(db, async (tx) => {
        const previous = id ? await tx.transfer.findFirst({ where: scoped(id) }) : null;
        if (id && !previous) throw missing();
        if (id && await tx.goalContribution.findFirst({ where: { transferId: id, householdId } })) throw new AppError("CONFLICT", "Remova o vínculo na meta antes de editar esta transferência.", 409);
        for (const field of ["sourceAccountId", "destinationAccountId"] as const) {
          const account = await tx.account.findFirst({ where: scoped(data[field]) });
          if (!account || (!account.isActive && previous?.[field] !== account.id)) throw invalid("Selecione contas ativas do seu espaço familiar.");
        }
        const values = { ...data, amount: new Prisma.Decimal(data.amount), transferDate: databaseDate(data.transferDate), competenceDate: databaseDate(data.competenceDate) };
        return serialize(id ? await tx.transfer.update({ where: scoped(id), data: values, include: accountNames }) : await tx.transfer.create({ data: { ...values, householdId, createdBy }, include: accountNames }));
      });
    },
    async removeTransfer(id: string) {
      if (await db.goalContribution.findFirst({ where: { transferId: id, householdId } })) throw new AppError("CONFLICT", "Remova o vínculo na meta antes de excluir esta transferência.", 409);
      const result = await db.transfer.deleteMany({ where: scoped(id) });
      if (!result.count) throw missing();
      return { message: "Transferência excluída. Os saldos foram recalculados." };
    },
  };
}

