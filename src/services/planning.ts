import { Prisma, type PrismaClient } from "@prisma/client";
import type { FinancialActor } from "./finance";
import { planningSchema, type PlanningInput } from "../lib/validations/planning";
import { calculatePlanning } from "../lib/finance/planning-math";
import { money, monthDate } from "../lib/finance/report-math";
import { AppError } from "../lib/api/errors";

export async function planningConfig(tx: Prisma.TransactionClient, householdId: string): Promise<PlanningInput> {
  type Row = {
    enabled: boolean | number; incomeSource: PlanningInput["incomeSource"]; referenceIncome: Prisma.Decimal; revision: number;
    groupId: string | null; name: string | null; percentage: Prisma.Decimal | null;
    alertPercentage: Prisma.Decimal | null; active: boolean | number | null; categoryId: string | null;
  };
  const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
    SELECT p.enabled, p.incomeSource, p.referenceIncome, p.revision,
      g.id AS groupId, g.name, g.percentage, g.alertPercentage, g.active, l.categoryId
    FROM IncomePlanning p
    LEFT JOIN PlanningGroup g ON g.householdId = p.householdId
    LEFT JOIN PlanningGroupCategory l ON l.planningGroupId = g.id AND l.householdId = g.householdId
    WHERE p.householdId = ${householdId}
    ORDER BY g.position ASC, l.categoryId ASC
  `);
  if (!rows.length) return { enabled: false, incomeSource: "REALIZED", referenceIncome: "0.00", revision: 0, groups: [] };
  const groups = new Map<string, PlanningInput["groups"][number]>();
  for (const row of rows) {
    if (row.groupId === null) continue;
    let group = groups.get(row.groupId);
    if (!group) {
      group = { name: row.name!, percentage: money(row.percentage!), alertPercentage: money(row.alertPercentage!), active: Boolean(row.active), categoryIds: [] };
      groups.set(row.groupId, group);
    }
    if (row.categoryId !== null) group.categoryIds.push(row.categoryId);
  }
  const row = rows[0];
  return { enabled: Boolean(row.enabled), incomeSource: row.incomeSource, referenceIncome: money(row.referenceIncome), revision: row.revision, groups: [...groups.values()] };
}
export async function planningReport(tx: Prisma.TransactionClient, householdId: string, year: number, month: number, realizedIncome: string) {
  const config = await planningConfig(tx, householdId);
  const rows = config.enabled ? await tx.transaction.groupBy({ by: ["categoryId"], where: { householdId, type: "EXPENSE", status: { in: ["PAID", "PENDING"] }, competenceDate: { gte: monthDate(year, month), lt: monthDate(year, month + 1) } }, _sum: { amount: true } }) : [];
  return calculatePlanning(config, realizedIncome, rows.map((r) => ({ categoryId: r.categoryId, amount: money(r._sum.amount ?? 0) })));
}
export function planningService(db: PrismaClient, actor: FinancialActor) {
  const householdId = actor.householdId;
  return {
    config: () => db.$transaction((tx) => planningConfig(tx, householdId), { isolationLevel: "RepeatableRead" }),
    async save(input: unknown) {
      const data = planningSchema.parse(input);
      for (let attempt = 0; ; attempt++) {
        try {
          return await db.$transaction(async (tx) => {
            const categoryIds = [...new Set(data.groups.flatMap((g) => g.categoryIds))];
            const categories = await tx.category.findMany({ where: { householdId, id: { in: categoryIds }, type: "EXPENSE" }, select: { id: true } });
            if (categories.length !== categoryIds.length) throw new AppError("INVALID_INPUT", "Associe somente categorias de despesa do seu espaço familiar.", 400);
            const previous = await tx.incomePlanning.findUnique({ where: { householdId } });
            if ((previous?.revision ?? 0) !== data.revision) throw new AppError("CONFLICT", "O planejamento foi alterado em outra sessão. Recarregue a configuração antes de salvar.", 409);
            const values = { enabled: data.enabled, incomeSource: data.incomeSource, referenceIncome: data.referenceIncome, revision: data.revision + 1 };
            await tx.incomePlanning.upsert({ where: { householdId }, create: { householdId, ...values }, update: values });
            await tx.planningGroup.deleteMany({ where: { householdId } });
            for (const [position, group] of data.groups.entries()) {
              const saved = await tx.planningGroup.create({ data: { householdId, position, name: group.name, percentage: group.percentage, alertPercentage: group.alertPercentage, active: group.active } });
              if (group.categoryIds.length) await tx.planningGroupCategory.createMany({ data: group.categoryIds.map((categoryId) => ({ householdId, planningGroupId: saved.id, categoryId })) });
            }
            return planningConfig(tx, householdId);
          }, { isolationLevel: "Serializable", timeout: 15000 });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code) && attempt < 2) continue;
          throw error;
        }
      }
    },
  };
}
export type PlanningReport = Awaited<ReturnType<typeof planningReport>>;
