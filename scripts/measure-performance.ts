import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { financialService } from "../src/services/finance";
import { reportService } from "../src/services/reports";
import { goalsService } from "../src/services/goals";
import { planningService } from "../src/services/planning";

async function main() {
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Medição permitida somente em banco local não produtivo.");
  // Count queries without recording SQL, parameters, identities or financial rows.
  const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  let queries = 0;
  db.$on("query", () => { queries++; });
  const userId = randomUUID(), householdId = randomUUID();
  const actor = { userId, householdId };
  try {
    await db.user.create({ data: { id: userId, name: "QA performance temporário", email: `perf-${userId}@example.invalid`, passwordHash: "not-a-login-hash", membership: { create: { role: "OWNER", household: { create: { id: householdId, name: "QA performance" } } } } } });
    const finance = financialService(db, actor), reports = reportService(db, actor), goals = goalsService(db, actor), planning = planningService(db, actor);
    const account = await finance.saveAccount({ name: "Conta fictícia", type: "CASH", initialBalance: "1000" });
    const category = await finance.saveCategory({ name: "Categoria fictícia", type: "EXPENSE" });
    await planning.save({ revision: 0, enabled: true, incomeSource: "MANUAL", referenceIncome: "5000", groups: [{ name: "Grupo fictício", percentage: "50", alertPercentage: "90", active: true, categoryIds: [category.id] }] });
    const goal = await goals.save({ name: "Meta fictícia", targetAmount: "10000", startDate: "2026-01-01" });
    await db.transaction.createMany({ data: Array.from({ length: 2400 }, (_, index) => ({ householdId, createdBy: userId, accountId: account.id, categoryId: category.id, type: "EXPENSE" as const, description: "Fixture de performance", amount: "10.25", status: "PAID" as const, competenceDate: new Date(Date.UTC(2026, index % 12, 1)), scheduledDate: new Date(Date.UTC(2026, index % 12, 10)), transactionDate: new Date(Date.UTC(2026, index % 12, 10)) })) });
    await db.goalContribution.createMany({ data: Array.from({ length: 120 }, (_, index) => ({ householdId, createdBy: userId, goalId: goal.id, amount: "10.25", competenceDate: new Date(Date.UTC(2026, index % 12, 1)), contributionDate: new Date(Date.UTC(2026, index % 12, 10)) })) });
    const measurements = [];
    for (const [name, run] of [
      ["Dashboard", () => reports.dashboard({ year: 2026, month: 9 })],
      ["Resumo anual", () => reports.annual({ year: 2026 })],
      ["Transações página 1/20", () => finance.transactions({ year: 2026, month: 9 })],
      ["Planejamento configuração", () => planning.config()],
      ["Metas com histórico", () => goals.list({ through: "2026-09-01" })],
    ] as const) {
      await run();
      const samples = [];
      for (let index = 0; index < 5; index++) {
        queries = 0; const start = performance.now(); const payload = await run();
        samples.push({ ms: Math.round((performance.now() - start) * 100) / 100, queries, bytes: Buffer.byteLength(JSON.stringify(payload)) });
      }
      const times = samples.map(s => s.ms).sort((a, b) => a - b);
      measurements.push({ name, medianMs: times[2], maxMs: times[4], samples });
    }
    const plan = await db.$queryRaw<Record<string, unknown>[]>`EXPLAIN FORMAT=TRADITIONAL SELECT id FROM Transaction WHERE householdId = ${householdId} AND competenceDate >= '2026-09-01' AND competenceDate < '2026-10-01'`;
    mkdirSync("docs/fase6", { recursive: true });
    // Prisma/MySQL may label EXPLAIN columns f0..f11 instead of their display names.
    writeFileSync("docs/fase6/performance.json", JSON.stringify({ measuredAt: new Date().toISOString(), environment: "MySQL local, serviços sem HTTP, cinco amostras após aquecimento; não é SLA nem ensaio de carga", fixture: { transactions: 2400, goals: 1, contributions: 120 }, measurements, explain: plan.map(row => ({ type: row.type ?? row.f4, possible_keys: row.possible_keys ?? row.f5, key: row.key ?? row.f6, rows: String(row.rows ?? row.f9), extra: row.Extra ?? row.f11 })) }, null, 2) + "\n");
    console.info(measurements.map(m => ({ name: m.name, medianMs: m.medianMs, queries: m.samples[0].queries, bytes: m.samples[0].bytes })));
  } finally {
    const where = { householdId };
    await db.goalContribution.deleteMany({ where }); await db.goalParticipant.deleteMany({ where }); await db.financialGoal.deleteMany({ where });
    await db.transaction.deleteMany({ where }); await db.incomePlanning.deleteMany({ where }); await db.category.deleteMany({ where }); await db.account.deleteMany({ where });
    await db.household.deleteMany({ where: { id: householdId } }); await db.user.deleteMany({ where: { id: userId } }); await db.$disconnect();
  }
}
main().catch(() => { console.error("Medição não concluída. Confira banco local e migrations; nenhum detalhe de conexão é registrado."); process.exitCode = 1; });
