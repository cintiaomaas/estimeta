import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { goalsService } from "../../src/services/goals";
import { financialService } from "../../src/services/finance";
import { advancedService } from "../../src/services/advanced";
import { reportService } from "../../src/services/reports";
test("fase 5 MySQL: progresso, competência, isolamento e regressão financeira", async suite => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const db = new PrismaClient(), households = [randomUUID(), randomUUID()], users = [randomUUID(), randomUUID()];
  try {
    for (let i = 0; i < 2; i++) await db.user.create({ data: { id: users[i], name: "QA metas", email: `goals-${users[i]}@example.invalid`, passwordHash: "not-a-login", membership: { create: { role: "OWNER", household: { create: { id: households[i], name: "QA metas" } } } } } });
    const actor = { userId: users[0], householdId: households[0] }, other = { userId: users[1], householdId: households[1] };
    const s = goalsService(db, actor, "2026-09-27"), b = goalsService(db, other, "2026-09-27"), f = financialService(db, actor), bf = financialService(db, other), a = advancedService(db, actor);
    const reports = reportService(db, actor), base = { name: "Viagem Itália", targetAmount: "10000", startDate: "2026-09-01", targetDate: "2027-05-31" };
    const { id } = await s.save({ ...base, participants: [{ name: "Cintia" }, { name: "João" }] });
    const goal = await s.detail(id), p = goal.participants[0].id, q = goal.participants[1].id;
    const input = { amount: "1500", participantId: p, contributionDate: "2026-09-10", competenceDate: "2026-09-01" };
    const source = await f.saveAccount({ name: "Corrente", type: "CHECKING", initialBalance: "10000" });
    const dest = await f.saveAccount({ name: "Reserva", type: "SAVINGS", initialBalance: "0", includeInTotalBalance: false });
    const foreign = await bf.saveAccount({ name: "Outra", type: "CASH", initialBalance: "0" });
    const foreignGoal = await b.save(base), foreignParticipant = await b.participant(foreignGoal.id, { name: "Outro" });
    const before = await reports.dashboard({ year: 2026, month: 9 });
    await suite.test("exclusão definitiva somente sem histórico, com isolamento e participantes atômicos", async () => {
      const fresh = await s.save({ ...base, participants: [{ name: "Sem histórico" }] });
      assert.equal((await s.detail(fresh.id)).canDelete, true);
      await assert.rejects(() => b.remove(fresh.id));
      await s.remove(fresh.id); await assert.rejects(() => s.detail(fresh.id));
      assert.equal(await db.goalParticipant.count({ where: { goalId: fresh.id } }), 0);
      const historical = await s.save(base);
      const contribution = await s.contribution(historical.id, { ...input, participantId: null });
      await s.removeContribution(historical.id, contribution.id);
      assert.equal((await s.detail(historical.id)).canDelete, false);
      await assert.rejects(() => s.remove(historical.id), /histórico/);
      await s.state(historical.id, { status: "ARCHIVED" });
    });
    await suite.test("criação, contribuições e dashboard/planejamento inalterados", async () => {
      assert.equal(goal.progressPercentage, "0.00"); assert.equal(goal.remainingAmount, "10000.00");
      await s.contribution(id, input); await s.contribution(id, { ...input, amount: "1000", participantId: q });
      const g = await s.detail(id); assert.equal(g.totalContributed, "2500.00"); assert.equal(g.progressPercentage, "25.00"); assert.equal(g.remainingAmount, "7500.00"); assert.equal(g.participants[0].totalContributed, "1500.00");
      const after = await reports.dashboard({ year: 2026, month: 9 }); for (const key of ["balance", "income", "expenses", "netSavings", "planning"] as const) assert.deepEqual(after[key], before[key]);
      assert.equal(after.goals.totalContributed, "2500.00");
    });
    await suite.test("edição/exclusão recalculam participante, evolução e alvo", async () => {
      const c = (await s.detail(id)).contributions.find(c => c.participantId === q)!;
      await s.contribution(id, { ...input, participantId: q, amount: "1500" }, c.id);
      let g = await s.detail(id); assert.equal(g.totalContributed, "3000.00"); assert.equal(g.evolution[0].accumulated, "3000.00");
      await s.save({ ...base, targetAmount: "2000" }, id); g = await s.detail(id); assert.equal(g.progressPercentage, "150.00"); assert.equal(g.remainingAmount, "0.00"); assert.equal(g.status, "ACTIVE");
      await s.removeContribution(id, c.id); assert.equal((await s.detail(id)).totalContributed, "1500.00"); await s.save(base, id);
    });
    await suite.test("competência futura e progresso ponderado", async () => {
      await s.contribution(id, { ...input, amount: "500", competenceDate: "2026-10-01" });
      assert.equal((await s.detail(id, { through: "2026-09-30" })).totalContributed, "1500.00"); assert.equal((await s.detail(id, { through: "2026-10-31" })).totalContributed, "2000.00");
      const second = await s.save({ ...base, targetAmount: "2000" }); await s.contribution(second.id, { ...input, participantId: null, amount: "1000" });
      const summary = (await reports.dashboard({ year: 2026, month: 10 })).goals; assert.equal(summary.targetAmount, "12000.00"); assert.equal(summary.totalContributed, "3000.00"); assert.equal(summary.progressPercentage, "25.00");
      await s.state(second.id, { status: "ARCHIVED" });
    });
    await suite.test("IDOR: metas, participantes, contribuições, contas e transferências", async () => {
      for (const call of [() => b.detail(id), () => b.save(base, id), () => b.state(id, { status: "ARCHIVED" }), () => b.participant(id, { name: "Intruso" }), () => b.contribution(id, input), () => s.contribution(id, { ...input, participantId: foreignParticipant.id }), () => s.contribution(id, { ...input, accountId: foreign.id }), () => s.save({ ...base, accountId: foreign.id })]) await assert.rejects(call);
      const c = (await s.detail(id)).contributions[0]; await assert.rejects(() => b.removeContribution(id, c.id)); await assert.rejects(() => b.contribution(id, input, c.id));
      const foreignDest = await bf.saveAccount({ name: "Destino", type: "CASH", initialBalance: "0" });
      const t = await advancedService(db, other).saveTransfer({ sourceAccountId: foreign.id, destinationAccountId: foreignDest.id, amount: "1500", transferDate: input.contributionDate, competenceDate: input.competenceDate });
      await assert.rejects(() => s.contribution(id, { ...input, transferId: t.id }));
      await assert.rejects(() => db.goalContribution.create({ data: { householdId: households[0], goalId: id, participantId: foreignParticipant.id, amount: "1", contributionDate: new Date("2026-09-01"), competenceDate: new Date("2026-09-01"), createdBy: users[0] } }));
    });
    await suite.test("transferência vinculada uma vez, sem duplicação e exclusão preserva movimento", async () => {
      const data = { sourceAccountId: source.id, destinationAccountId: dest.id, amount: "500", transferDate: "2026-09-20", competenceDate: "2026-09-01" };
      const transfer = await a.saveTransfer(data);
      const link = { ...input, amount: "500", transferId: transfer.id, accountId: dest.id, contributionDate: data.transferDate };
      const c = await s.contribution(id, link);
      assert.equal(await db.transfer.count({ where: { householdId: households[0] } }), 1); assert.equal((await reports.dashboard({ year: 2026, month: 9 })).balance, "9500.00");
      await assert.rejects(() => s.contribution(id, link)); await assert.rejects(() => a.saveTransfer({ ...data, amount: "700" }, String(transfer.id))); await assert.rejects(() => a.removeTransfer(String(transfer.id)));
      await s.removeContribution(id, c.id); assert.equal(await db.transfer.count({ where: { id: String(transfer.id) } }), 1); await a.saveTransfer(data, String(transfer.id));
      const attempts = await Promise.allSettled([s.contribution(id, link), s.contribution(id, link)]);
      assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
      assert.equal(await db.goalContribution.count({ where: { transferId: String(transfer.id) } }), 1);
      const linked = await db.goalContribution.findFirstOrThrow({ where: { transferId: String(transfer.id) } });
      await s.removeContribution(id, linked.id);
    });
    await suite.test("desativação de participante e arquivamento preservam histórico", async () => {
      await s.participant(id, { name: "Cintia", isActive: false }, p); await assert.rejects(() => s.contribution(id, input));
      const g = await s.detail(id); assert.ok(g.contributions.length); await s.state(id, { status: "COMPLETED" }); await assert.rejects(() => s.contribution(id, input)); await s.state(id, { status: "ARCHIVED" }); assert.equal((await s.detail(id)).contributions.length, g.contributions.length);
      await s.state(id, { status: "ACTIVE" });
    });
    await suite.test("criação atômica e conta referenciada é desativada", async () => {
      const count = await db.financialGoal.count({ where: { householdId: households[0] } });
      await assert.rejects(() => s.save({ ...base, participants: [{ name: "Duplicado" }, { name: "Duplicado" }] })); assert.equal(await db.financialGoal.count({ where: { householdId: households[0] } }), count);
      const account = await f.saveAccount({ name: "Contexto", type: "CASH", initialBalance: "0" }); await s.save({ ...base, accountId: account.id }, id); assert.equal((await f.removeAccount(account.id)).deactivated, true);
    });
  } finally {
    for (const householdId of households) {
      await db.goalContribution.deleteMany({ where: { householdId } }); await db.goalParticipant.deleteMany({ where: { householdId } }); await db.financialGoal.deleteMany({ where: { householdId } }); await db.transfer.deleteMany({ where: { householdId } }); await db.account.deleteMany({ where: { householdId } }); await db.household.deleteMany({ where: { id: householdId } });
    }
    await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect();
  }
});
