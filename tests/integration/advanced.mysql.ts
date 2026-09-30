import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { financialService } from "../../src/services/finance";
import { advancedService } from "../../src/services/advanced";
import { planningService } from "../../src/services/planning";
import { reportService } from "../../src/services/reports";

test("fase 4 MySQL: centavos, competências, atomicidade, idempotência e isolamento", async (suite) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const db = new PrismaClient(), households = [randomUUID(), randomUUID()], users = [randomUUID(), randomUUID()];
  try {
    for (let i = 0; i < 2; i++) await db.user.create({ data: { id: users[i], name: "QA Fase 4", email: `phase4-${users[i]}@example.invalid`, passwordHash: "not-a-login-hash", membership: { create: { role: "OWNER", household: { create: { id: households[i], name: "QA Fase 4" } } } } } });
    const actor = { userId: users[0], householdId: households[0] }, foreignActor = { userId: users[1], householdId: households[1] };
    const f = financialService(db, actor), a = advancedService(db, actor), b = advancedService(db, foreignActor), foreign = financialService(db, foreignActor), reports = reportService(db, actor);
    const source = await f.saveAccount({ name: "A", type: "CHECKING", initialBalance: "1000" });
    const destination = await f.saveAccount({ name: "B", type: "SAVINGS", initialBalance: "500" });
    const accountB = await foreign.saveAccount({ name: "Outro Household", type: "CASH", initialBalance: "0" });
    const category = await f.saveCategory({ name: "Cartão de crédito", type: "EXPENSE" }), categoryB = await foreign.saveCategory({ name: "Outra", type: "EXPENSE" });
    const base = { type: "EXPENSE", description: "Cartão Nubank", amount: "2000", accountId: source.id, categoryId: category.id, status: "PENDING", transactionDate: null, competenceDate: "2027-01-01", scheduledDate: "2027-01-31" };
    const dashboard = (month: number, year = 2027) => reports.dashboard({ year, month });
    await planningService(db, actor).save({ revision: 0, enabled: true, incomeSource: "MANUAL", referenceIncome: "10000", groups: [{ name: "Diversos", percentage: "30", alertPercentage: "90", active: true, categoryIds: [category.id] }] });
    await suite.test("cartão pendente compromete planejamento e pago impacta saldo uma vez", async () => {
      const card = await f.saveTransaction(base);
      assert.equal((await dashboard(1)).balance, "1500.00");
      assert.equal((await dashboard(1)).planning.groups[0].committed, "2000.00");
      await f.saveTransaction({ ...base, status: "PAID", transactionDate: "2026-09-23" }, card.id);
      await f.saveTransaction({ ...base, status: "PAID", transactionDate: "2026-09-23" }, card.id);
      assert.equal((await dashboard(1)).expenses, "2000.00"); assert.equal((await dashboard(1)).balance, "-500.00");
      assert.equal((await dashboard(12, 2026)).balance, "1500.00");
      await f.removeTransaction(card.id);
    });
    const plan = await a.createInstallments({ ...base, description: "Notebook", amount: "1000", installmentCount: 3 });
    await suite.test("parcelas reais, vencimentos, planejamento e edição/exclusão individual", async () => {
      const rows = await db.transaction.findMany({ where: { installmentPlanId: plan.id }, orderBy: { installmentNumber: "asc" } });
      assert.deepEqual(rows.map((r) => r.amount.toFixed(2)), ["333.34", "333.33", "333.33"]);
      assert.deepEqual(rows.map((r) => r.scheduledDate.toISOString().slice(0, 10)), ["2027-01-31", "2027-02-28", "2027-03-31"]);
      for (let month = 1; month <= 3; month++) { assert.equal((await f.transactions({ year: 2027, month })).pagination.total, 1); assert.equal((await dashboard(month)).planning.groups[0].committed, month === 1 ? "333.34" : "333.33"); }
      assert.equal((await dashboard(12, 2026)).planning.groups[0].committed, "0.00");
      for (const row of rows) await f.saveTransaction({ ...base, description: row.description, amount: row.amount.toFixed(2), competenceDate: row.competenceDate.toISOString().slice(0, 10), scheduledDate: row.scheduledDate.toISOString().slice(0, 10), status: "PAID", transactionDate: "2027-01-01" }, row.id);
      const annual = await reports.annual({ year: 2027 });
      assert.deepEqual(annual.monthlySummary.slice(0, 3).map((m) => m.expenses), ["333.34", "333.33", "333.33"]);
      assert.equal(annual.annualTotals.expenses, "1000.00");
      await assert.rejects(f.saveTransaction({ ...base, type: "INCOME" }, rows[0].id));
      await f.removeTransaction(rows[1].id);
      assert.equal(await db.transaction.count({ where: { installmentPlanId: plan.id } }), 2);
      assert.equal((await f.transaction(rows[0].id)).amount, "333.34");
      await db.transaction.deleteMany({ where: { installmentPlanId: plan.id } });
    });
    const ruleInput = { description: "Internet", type: "EXPENSE", accountId: source.id, categoryId: category.id, amount: "120", startDate: "2027-01-01", dayOfMonth: 10 };
    await suite.test("geração explica meses já criados, fora da vigência, excluídos e cria dezembro", async () => {
      const sample = await a.saveRecurring({ ...ruleInput, description: "Regra de setembro a dezembro", startDate: "2027-09-26", endDate: "2027-12-26" });
      const id = String(sample.id);
      assert.equal(sample.nextScheduledDate, "2027-10-10");
      assert.equal((await a.generateRecurring(id, { competenceDate: "2027-09-01" })).reason, "BEFORE_START");
      const october = await a.generateRecurring(id, { competenceDate: "2027-10-01" });
      assert.equal(october.reason, "ALREADY_EXISTS"); assert.ok(october.transactionId);
      assert.equal((await a.generateRecurring(id, { competenceDate: "2027-11-01" })).reason, "ALREADY_EXISTS");
      const december = await a.generateRecurring(id, { competenceDate: "2027-12-01" });
      assert.equal(december.generated, true); assert.equal(december.reason, "CREATED"); assert.ok(december.transactionId);
      assert.equal((await f.transactions({ year: 2027, month: 12, search: "Regra de setembro" })).pagination.total, 1);
      assert.equal((await a.generateRecurring(id, { competenceDate: "2028-01-01" })).reason, "AFTER_END");
      await f.removeTransaction(december.transactionId!);
      const recreated = await Promise.all([a.generateRecurring(id, { competenceDate: "2027-12-01" }), a.generateRecurring(id, { competenceDate: "2027-12-01" })]);
      assert.equal(recreated.filter((r) => r.generated).length, 1);
      assert.equal(recreated.filter((r) => r.reason === "ALREADY_EXISTS").length, 1);
      assert.equal((await f.transactions({ year: 2027, month: 12, search: "Regra de setembro" })).pagination.total, 1);
      await a.deactivateRecurring(id);
      assert.equal((await a.generateRecurring(id, { competenceDate: "2027-12-01" })).reason, "INACTIVE");
      await db.transaction.deleteMany({ where: { recurringOccurrence: { recurringTransactionId: id } } });
      await db.recurringOccurrence.deleteMany({ where: { recurringTransactionId: id } });
      await db.recurringTransaction.delete({ where: { id } });
    });
    const rule = await a.saveRecurring(ruleInput), ruleId = String(rule.id);
    await suite.test("recorrência: concorrência, recriação explícita após exclusão, edição, término e desativação", async () => {
      assert.equal(await db.recurringOccurrence.count({ where: { recurringTransactionId: ruleId } }), 3);
      await Promise.all([a.generateRecurring(ruleId, { competenceDate: "2027-04-01" }), a.generateRecurring(ruleId, { competenceDate: "2027-04-01" })]);
      assert.equal(await db.recurringOccurrence.count({ where: { recurringTransactionId: ruleId } }), 4);
      const occurrence = await db.recurringOccurrence.findFirstOrThrow({ where: { recurringTransactionId: ruleId, competenceDate: new Date("2027-02-01") }, include: { transaction: true } });
      await f.removeTransaction(occurrence.transaction!.id);
      assert.equal((await a.generateRecurring(ruleId, { competenceDate: "2027-02-01" })).generated, true);
      const updated = await a.saveRecurring({ ...ruleInput, amount: "150", revision: rule.revision, endDate: "2027-05-31" }, ruleId);
      assert.equal((await a.generateRecurring(ruleId, { competenceDate: "2027-05-01" })).generated, true);
      assert.equal((await a.generateRecurring(ruleId, { competenceDate: "2027-06-01" })).generated, false);
      const january = await db.transaction.findFirstOrThrow({ where: { householdId: households[0], description: "Internet", competenceDate: new Date("2027-01-01") } });
      assert.equal(january.amount.toFixed(2), "120.00");
      await assert.rejects(a.saveRecurring({ ...ruleInput, revision: rule.revision }, ruleId));
      await a.deactivateRecurring(ruleId);
      assert.equal((await a.generateRecurring(ruleId, { competenceDate: "2027-07-01" })).generated, false);
      assert.ok(updated.revision);
      assert.equal((await dashboard(1)).balance, "1500.00");
      assert.equal((await dashboard(1)).planning.groups[0].committed, "120.00");
    });
    const transferInput = { sourceAccountId: source.id, destinationAccountId: destination.id, amount: "200", transferDate: "2026-09-23", competenceDate: "2027-01-01" };
    const transfer = await a.saveTransfer(transferInput), transferId = String(transfer.id);
    await suite.test("transferência não altera receita/despesa/economia e respeita todas as inclusões", async () => {
      const rows = await f.accounts({ year: 2027, month: 1 });
      assert.equal(rows.find((r) => r.id === source.id)!.balance, "800.00"); assert.equal(rows.find((r) => r.id === destination.id)!.balance, "700.00");
      const report = await dashboard(1);
      assert.equal(report.balance, "1500.00"); assert.equal(report.income, "0.00"); assert.equal(report.expenses, "0.00"); assert.equal(report.netSavings, "0.00");
      await f.saveAccount({ name: "B", type: "SAVINGS", initialBalance: "500", includeInTotalBalance: false }, destination.id);
      assert.equal((await dashboard(1)).balance, "800.00");
      assert.equal((await dashboard(12, 2026)).balance, "1000.00");
      await a.saveTransfer({ ...transferInput, sourceAccountId: destination.id, destinationAccountId: source.id, competenceDate: "2027-02-01" });
      assert.equal((await dashboard(2)).balance, "1000.00");
      const annual = await reports.annual({ year: 2027 });
      assert.equal(annual.monthlySummary[0].balance, "800.00"); assert.equal(annual.monthlySummary[1].balance, "1000.00");
      assert.equal(annual.annualTotals.netSavings, "0.00");
      await f.saveAccount({ name: "A", type: "CHECKING", initialBalance: "1000", includeInTotalBalance: false }, source.id);
      assert.equal((await dashboard(1)).balance, "0.00");
      await f.saveAccount({ name: "B", type: "SAVINGS", initialBalance: "500", includeInTotalBalance: true }, destination.id);
      assert.equal((await dashboard(1)).balance, "700.00");
    });
    await suite.test("Household bloqueia IDOR, referências cruzadas, payload injetado e mantém atomicidade", async () => {
      for (const action of [() => b.installment(plan.id), () => b.recurringById(ruleId), () => b.transfer(transferId), () => b.removeTransfer(transferId), () => b.deactivateRecurring(ruleId), () => b.generateRecurring(ruleId, { competenceDate: "2027-08-01" }), () => b.saveRecurring(ruleInput, ruleId), () => b.saveTransfer(transferInput, transferId)]) await assert.rejects(action());
      const plans = await db.installmentPlan.count({ where: { householdId: households[0] } });
      for (const changes of [{ accountId: accountB.id }, { categoryId: categoryB.id }]) {
        await assert.rejects(a.createInstallments({ ...base, ...changes, installmentCount: 3 }));
        await assert.rejects(a.saveRecurring({ ...ruleInput, ...changes }));
      }
      assert.equal(await db.installmentPlan.count({ where: { householdId: households[0] } }), plans);
      await assert.rejects(a.saveTransfer({ ...transferInput, destinationAccountId: accountB.id }));
      await assert.rejects(a.saveTransfer({ ...transferInput, householdId: households[1] }));
      await assert.rejects(db.transfer.create({ data: { ...transferInput, transferDate: new Date("2027-01-01"), competenceDate: new Date("2027-01-01"), householdId: households[0], createdBy: users[0], destinationAccountId: accountB.id, description: "FK cruzada" } }));
      assert.equal((await b.transfers()).pagination.total, 0);
      const otherConnection = new PrismaClient();
      try { assert.equal((await advancedService(otherConnection, actor).transfer(transferId)).amount, "200.00"); } finally { await otherConnection.$disconnect(); }
    });
    await suite.test("recorrências de receita, dia 31, desativação de referências e edição de transferência", async () => {
      const income = await f.saveCategory({ name: "Salário", type: "INCOME" });
      const salary = await a.saveRecurring({ ...ruleInput, type: "INCOME", description: "Salário", categoryId: income.id, startDate: "2028-01-01", dayOfMonth: 31 });
      const rows = await db.transaction.findMany({ where: { householdId: households[0], description: "Salário" }, orderBy: { competenceDate: "asc" } });
      assert.deepEqual(rows.map((r) => r.scheduledDate.toISOString().slice(0, 10)), ["2028-01-31", "2028-02-29", "2028-03-31"]);
      assert.ok(rows.every((r) => r.status === "PENDING"));
      assert.equal((await f.removeCategory(income.id)).deactivated, true);
      await assert.rejects(a.generateRecurring(String(salary.id), { competenceDate: "2028-04-01" }));
      assert.equal(await db.recurringOccurrence.count({ where: { recurringTransactionId: String(salary.id) } }), 3);
      await a.saveTransfer({ ...transferInput, amount: "50" }, transferId);
      assert.equal((await f.accounts({ year: 2027, month: 1 })).find((r) => r.id === source.id)!.balance, "950.00");
      await a.removeTransfer(transferId);
      assert.equal((await f.accounts({ year: 2027, month: 1 })).find((r) => r.id === source.id)!.balance, "1000.00");
    });
  } finally {
    const where = { householdId: { in: households } };
    await db.transaction.deleteMany({ where }); await db.transfer.deleteMany({ where }); await db.recurringOccurrence.deleteMany({ where }); await db.recurringTransaction.deleteMany({ where }); await db.installmentPlan.deleteMany({ where });
    await db.category.deleteMany({ where }); await db.account.deleteMany({ where }); await db.household.deleteMany({ where: { id: { in: households } } }); await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect();
  }
});
