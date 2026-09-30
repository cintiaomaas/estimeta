import { Prisma, type PrismaClient } from "@prisma/client";
import type { FinancialActor } from "./finance";
import { atomic } from "./atomic";
import { AppError } from "../lib/api/errors";
import { goalSchema, goalFilters, participantSchema, contributionSchema, goalStateSchema, goalPeriod } from "../lib/validations/goals";
import { databaseDate, dateOnly, todayInBrazil } from "../lib/finance/dates";
import { goalProgress, monthlyEvolution } from "../lib/finance/goal-math";
import { decimal, money, percentage } from "../lib/finance/report-math";

const missing = () => new AppError("NOT_FOUND", "Registro não encontrado neste espaço familiar.", 404);
const invalid = (message: string) => new AppError("INVALID_INPUT", message, 400);
const include = { account: { select: { name: true } }, participants: { orderBy: { createdAt: "asc" as const } }, contributions: { orderBy: [{ contributionDate: "desc" as const }, { id: "desc" as const }], include: { account: { select: { name: true } } } } } satisfies Prisma.FinancialGoalInclude;
type Goal = Prisma.FinancialGoalGetPayload<{ include: typeof include }>;
function serialize(row: Goal, through: string, today: string) {
  const contributions = row.contributions.map(c => ({ id: c.id, participantId: c.participantId, accountId: c.accountId, transferId: c.transferId, amount: money(c.amount), contributionDate: dateOnly(c.contributionDate), competenceDate: dateOnly(c.competenceDate), description: c.description, account: c.account }));
  const visible = contributions.filter(c => c.competenceDate.slice(0, 7) <= through.slice(0, 7));
  const progress = goalProgress(money(row.targetAmount), visible.map(c => c.amount), row.targetDate ? dateOnly(row.targetDate) : null, today, dateOnly(row.startDate));
  return { id: row.id, name: row.name, description: row.description, icon: row.icon, targetAmount: money(row.targetAmount), startDate: dateOnly(row.startDate), targetDate: row.targetDate ? dateOnly(row.targetDate) : null, status: row.status, accountId: row.accountId, account: row.account, through, ...progress,
    participants: row.participants.map(p => { const total = visible.filter(c => c.participantId === p.id).reduce((s, c) => s.plus(c.amount), decimal()); return { id: p.id, name: p.name, isActive: p.isActive, totalContributed: money(total), percentage: percentage(total, progress.totalContributed) }; }),
    canDelete: !row.hasHistory && !row.contributions.length,
    contributions, evolution: monthlyEvolution(visible, through),
  };
}
export async function goalsSummary(tx: Prisma.TransactionClient, householdId: string, through: string) {
  const rows = await tx.financialGoal.findMany({ where: { householdId, status: "ACTIVE", startDate: { lte: databaseDate(through) } }, include: { contributions: { where: { competenceDate: { lte: databaseDate(through) } }, select: { amount: true } } }, orderBy: [{ targetDate: "asc" }, { id: "asc" }] });
  const planned = rows.reduce((s, r) => s.plus(r.targetAmount), decimal());
  const items = rows.map(r => ({ id: r.id, name: r.name, targetAmount: money(r.targetAmount), ...goalProgress(money(r.targetAmount), r.contributions.map(c => money(c.amount)), null, through) }));
  const accumulated = items.reduce((s, r) => s.plus(r.totalContributed), decimal());
  return { activeCount: rows.length, targetAmount: money(planned), totalContributed: money(accumulated), progressPercentage: percentage(accumulated, planned), items: items.slice(0, 3) };
}
export function goalsService(db: PrismaClient, actor: FinancialActor, today = todayInBrazil()) {
  const { householdId, userId: createdBy } = actor;
  const scoped = (id: string) => ({ id, householdId });
  async function goal(tx: Prisma.TransactionClient, id: string, active = false) {
    const row = await tx.financialGoal.findFirst({ where: scoped(id) });
    if (!row) throw missing();
    if (active && row.status !== "ACTIVE") throw invalid("Reative a meta antes de alterar participantes ou contribuições.");
    return row;
  }
  async function account(tx: Prisma.TransactionClient, id: string | null, oldId?: string | null) {
    if (!id) return;
    const row = await tx.account.findFirst({ where: scoped(id) });
    if (!row || (!row.isActive && oldId !== id)) throw invalid("Selecione uma conta ativa do seu espaço familiar.");
  }
  return {
    async list(input: unknown = {}) {
      const f = goalFilters.parse(input);
      const where: Prisma.FinancialGoalWhereInput = { householdId, status: f.status, name: f.search ? { contains: f.search } : undefined, accountId: f.accountId,
        participants: f.participant ? { some: { name: { contains: f.participant } } } : undefined,
        ...(f.deadline === "NONE" ? { targetDate: null } : f.deadline ? { targetDate: f.deadline === "OVERDUE" ? { lt: databaseDate(today) } : { gte: databaseDate(today) } } : {}),
      };
      return db.$transaction(async tx => ({ data: (await tx.financialGoal.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (f.page - 1) * f.limit, take: f.limit })).map(r => serialize(r, f.through ?? today, today)), pagination: { total: await tx.financialGoal.count({ where }), page: f.page, limit: f.limit } }), { isolationLevel: "RepeatableRead" });
    },
    async detail(id: string, input: unknown = {}) {
      const f = goalPeriod.parse(input);
      return db.$transaction(async tx => {
        const row = await tx.financialGoal.findFirst({ where: scoped(id), include });
        if (!row) throw missing();
        return serialize(row, f.through ?? today, today);
      }, { isolationLevel: "RepeatableRead" });
    },
    async save(input: unknown, id?: string) {
      const { participants, ...data } = goalSchema.parse(input);
      return atomic(db, async tx => {
        const previous = id ? await goal(tx, id, true) : null;
        if (id && participants.length) throw invalid("Use a seção Participantes para alterar a participação.");
        await account(tx, data.accountId, previous?.accountId);
        const values = { ...data, targetAmount: new Prisma.Decimal(data.targetAmount), startDate: databaseDate(data.startDate), targetDate: data.targetDate ? databaseDate(data.targetDate) : null };
        const saved = id ? await tx.financialGoal.update({ where: scoped(id), data: values }) : await tx.financialGoal.create({ data: { ...values, householdId, createdBy } });
        if (!id && participants.length) await tx.goalParticipant.createMany({ data: participants.map(p => ({ ...p, goalId: saved.id, householdId })) });
        return { id: saved.id };
      });
    },
    async state(id: string, input: unknown) {
      const data = goalStateSchema.parse(input);
      return atomic(db, async tx => { await goal(tx, id); await tx.financialGoal.update({ where: scoped(id), data }); return { id }; });
    },
    async remove(id: string) {
      return atomic(db, async tx => {
        const row = await goal(tx, id);
        if (row.hasHistory || await tx.goalContribution.count({ where: { goalId: id, householdId } })) throw new AppError("GOAL_HAS_HISTORY", "Esta meta possui histórico e não pode ser excluída definitivamente.", 409);
        await tx.goalParticipant.deleteMany({ where: { goalId: id, householdId } });
        await tx.financialGoal.delete({ where: scoped(id) });
        return { message: "Meta excluída definitivamente." };
      });
    },
    async participant(id: string, input: unknown, participantId?: string) {
      const data = participantSchema.parse(input);
      return atomic(db, async tx => {
        await goal(tx, id, true);
        if (participantId && !await tx.goalParticipant.findFirst({ where: { ...scoped(participantId), goalId: id } })) throw missing();
        const row = participantId ? await tx.goalParticipant.update({ where: scoped(participantId), data }) : await tx.goalParticipant.create({ data: { ...data, householdId, goalId: id } });
        return { id: row.id };
      });
    },
    async contribution(id: string, input: unknown, contributionId?: string) {
      const data = contributionSchema.parse(input);
      return atomic(db, async tx => {
        await goal(tx, id, true);
        const old = contributionId ? await tx.goalContribution.findFirst({ where: { ...scoped(contributionId), goalId: id } }) : null;
        if (contributionId && !old) throw missing();
        if (data.participantId) {
          const p = await tx.goalParticipant.findFirst({ where: { ...scoped(data.participantId), goalId: id } });
          if (!p || (!p.isActive && old?.participantId !== p.id)) throw invalid("Selecione um participante ativo desta meta.");
        }
        await account(tx, data.accountId, old?.accountId);
        if (data.transferId) {
          const transfer = await tx.transfer.findFirst({ where: scoped(data.transferId) });
          if (!transfer) throw invalid("Selecione uma transferência do seu espaço familiar.");
          if (!transfer.amount.equals(data.amount) || dateOnly(transfer.transferDate) !== data.contributionDate || dateOnly(transfer.competenceDate) !== data.competenceDate || data.accountId !== transfer.destinationAccountId) throw invalid("Valor, data, competência e conta devem corresponder à transferência vinculada.");
          if (await tx.goalContribution.findFirst({ where: { transferId: data.transferId, ...(contributionId ? { id: { not: contributionId } } : {}) } })) throw new AppError("CONFLICT", "Esta transferência já está vinculada a uma meta.", 409);
        }
        const values = { ...data, amount: new Prisma.Decimal(data.amount), contributionDate: databaseDate(data.contributionDate), competenceDate: databaseDate(data.competenceDate) };
        await tx.financialGoal.update({ where: scoped(id), data: { hasHistory: true } });
        const row = contributionId ? await tx.goalContribution.update({ where: scoped(contributionId), data: values }) : await tx.goalContribution.create({ data: { ...values, goalId: id, householdId, createdBy } });
        return { id: row.id };
      });
    },
    async removeContribution(id: string, contributionId: string) {
      return atomic(db, async tx => { await goal(tx, id, true); const result = await tx.goalContribution.deleteMany({ where: { ...scoped(contributionId), goalId: id } }); if (!result.count) throw missing(); await tx.financialGoal.update({ where: scoped(id), data: { hasHistory: true } }); return { message: "Contribuição removida. Eventual transferência foi preservada." }; });
    },
  };
}
export type GoalRecord = Awaited<ReturnType<ReturnType<typeof goalsService>["detail"]>>;
export type GoalContributionRecord = GoalRecord["contributions"][number];
