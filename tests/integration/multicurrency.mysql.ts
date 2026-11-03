import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { financialService } from "../../src/services/finance";
import { advancedService } from "../../src/services/advanced";
import { readQuote } from "../../src/services/exchange-rates";
import { todayInBrazil } from "../../src/lib/finance/dates";

test("multicurrency persists native balances, BRL movements, transfers and installments", async () => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const db = new PrismaClient();
  const householdId = randomUUID(), userId = randomUUID();
  const actor = { householdId, userId }, finance = financialService(db, actor), advanced = advancedService(db, actor);
  const today = todayInBrazil();
  try {
    await db.user.create({ data: { id: userId, name: "Teste moedas", email: `currency-${userId}@example.invalid`, passwordHash: "not-a-login", membership: { create: { role: "OWNER", household: { create: { id: householdId, name: "Teste temporário moedas" } } } } } });
    const real = await finance.saveAccount({ name: "Reais", type: "CHECKING", initialBalance: "20000" });
    const usd = await finance.saveAccount({ name: "Dólares", type: "INVESTMENT", currency: "USD", initialBalance: "1000" });
    const eur = await finance.saveAccount({ name: "Euros", type: "INVESTMENT", currency: "EUR", initialBalance: "0", includeInTotalBalance: false });
    const category = await finance.saveCategory({ name: "Despesa teste", type: "EXPENSE" });
    const quote = await readQuote(db, "USD");
    assert.ok(quote && !quote.stale);
    const rate = new Prisma.Decimal(quote.rate);
    const input = { accountId: usd.id, categoryId: category.id, type: "EXPENSE", description: "Saída em dólar", amount: "1100", status: "PAID", scheduledDate: today, transactionDate: today, competenceDate: today };
    const expense = await finance.saveTransaction(input);
    assert.equal(expense.originalAmount, "1100.00");
    assert.equal(expense.amount, rate.mul(1100).toFixed(2));
    let accounts = await finance.accounts();
    assert.equal(accounts.find(a => a.id === usd.id)?.originalBalance, "-100.00");
    assert.equal(accounts.find(a => a.id === usd.id)?.balance, rate.mul(-100).toFixed(2));
    const edited = await finance.saveTransaction({ ...input, description: "Descrição alterada" }, expense.id);
    assert.equal(edited.amount, expense.amount);
    await assert.rejects(finance.saveAccount({ name: usd.name, type: usd.type, currency: "EUR", initialBalance: "1000" }, usd.id), { code: "INVALID_INPUT" });
    await advanced.saveTransfer({ sourceAccountId: real.id, destinationAccountId: usd.id, amount: "500", destinationAmount: "90", transferDate: today, competenceDate: today });
    accounts = await finance.accounts();
    assert.equal(accounts.find(a => a.id === real.id)?.balance, "19500.00");
    assert.equal(accounts.find(a => a.id === usd.id)?.originalBalance, "-10.00");
    await advanced.saveTransfer({ sourceAccountId: usd.id, destinationAccountId: eur.id, amount: "10", destinationAmount: "8", transferDate: today, competenceDate: today });
    accounts = await finance.accounts();
    assert.equal(accounts.find(a => a.id === usd.id)?.originalBalance, "-20.00");
    assert.equal(accounts.find(a => a.id === eur.id)?.originalBalance, "8.00");
    const plan = await advanced.createInstallments({ ...input, amount: "100", status: "PENDING", transactionDate: null, installmentCount: 3 });
    const parts = await db.transaction.findMany({ where: { householdId, installmentPlanId: plan.id } });
    assert.equal(parts.reduce((sum, p) => sum.plus(p.originalAmount!), new Prisma.Decimal(0)).toFixed(2), "100.00");
    assert.equal(parts.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0)).toFixed(2), plan.totalAmount);
    assert.equal((await finance.accounts()).find(a => a.id === usd.id)?.originalBalance, "-20.00", "pending installments do not affect balance");
  } finally {
    // Only records belonging to this randomly generated fixture are removed.
    await db.transaction.deleteMany({ where: { householdId } });
    await db.installmentPlan.deleteMany({ where: { householdId } });
    await db.transfer.deleteMany({ where: { householdId } });
    await db.category.deleteMany({ where: { householdId } });
    await db.account.deleteMany({ where: { householdId } });
    await db.household.deleteMany({ where: { id: householdId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  }
});
