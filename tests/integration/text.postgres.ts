import "./postgres-target";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { financialService } from "../../src/services/finance";
import { advancedService } from "../../src/services/advanced";
import { goalsService } from "../../src/services/goals";

test("PostgreSQL: MEMBER writes normally; accent searches and unique indexes preserve text rules", async () => {
  const db = new PrismaClient();
  const userId = randomUUID(), householdId = randomUUID();
  const actor = { userId, householdId };
  const finance = financialService(db, actor), advanced = advancedService(db, actor), goals = goalsService(db, actor);
  try {
    await db.user.create({ data: { id: userId, name: "QA texto", email: `text-${userId}@example.invalid`, passwordHash: "not-a-login", membership: { create: { role: "MEMBER", household: { create: { id: householdId, name: "QA texto" } } } } } });
    const account = await finance.saveAccount({ name: "Conta", type: "CASH", initialBalance: "100" });
    const other = await finance.saveAccount({ name: "Outra", type: "CASH", initialBalance: "0" });
    const category = await finance.saveCategory({ name: "Água", type: "EXPENSE" });
    await assert.rejects(finance.saveCategory({ name: "agua", type: "EXPENSE" }), { code: "DUPLICATE_CATEGORY" });
    await assert.rejects(db.category.create({ data: { householdId, name: "A\u0301GUA ", type: "EXPENSE" } }), { code: "P2002" });
    await assert.rejects(db.user.create({ data: { name: "Duplicado", email: `TEXT-${userId}@EXAMPLE.INVALID`, passwordHash: "not-a-login" } }), { code: "P2002" });
    await finance.saveTransaction({ accountId: account.id, categoryId: category.id, type: "EXPENSE", description: "Água", amount: "1", status: "PAID", competenceDate: "2026-11-01", scheduledDate: "2026-11-01", transactionDate: "2026-11-01" });
    assert.equal((await finance.transactions({ search: "AGUA" })).pagination.total, 1);
    await advanced.saveRecurring({ accountId: account.id, categoryId: category.id, type: "EXPENSE", description: "Água", amount: "1", startDate: "2026-11-01", dayOfMonth: 1, isActive: false });
    assert.equal((await advanced.recurring({ search: "agua" })).pagination.total, 1);
    await advanced.saveTransfer({ sourceAccountId: account.id, destinationAccountId: other.id, description: "Poupança", amount: "1", transferDate: "2026-11-01", competenceDate: "2026-11-01" });
    assert.equal((await advanced.transfers({ search: "POUPANCA" })).pagination.total, 1);
    const goal = await goals.save({ name: "Férias", targetAmount: "100", startDate: "2026-11-01" });
    await goals.participant(goal.id, { name: "José" });
    await assert.rejects(goals.participant(goal.id, { name: "JOSE" }), { code: "P2002" });
    assert.equal((await goals.list({ search: "FERIAS", participant: "jose" })).pagination.total, 1);
    assert.equal((await finance.transactions({ search: "' OR 1=1 --" })).pagination.total, 0);
  } finally {
    const where = { householdId };
    await db.goalParticipant.deleteMany({ where }); await db.financialGoal.deleteMany({ where });
    await db.transaction.deleteMany({ where }); await db.recurringTransaction.deleteMany({ where });
    await db.transfer.deleteMany({ where }); await db.category.deleteMany({ where }); await db.account.deleteMany({ where });
    await db.household.deleteMany({ where: { id: householdId } }); await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
});
