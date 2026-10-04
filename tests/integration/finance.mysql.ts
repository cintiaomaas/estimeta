import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { financialService } from "../../src/services/finance";
import { initializeFinancialDefaults } from "../../src/services/financial-defaults";
import { defaultCategories } from "../../src/lib/finance/defaults";
import { AppError } from "../../src/lib/api/errors";

test("núcleo financeiro integrado ao MySQL: persistência, integridade e isolamento", async (suite) => {
  assert.notEqual(process.env.NODE_ENV, "production", "Não execute testes no ambiente de produção.");
  const db = new PrismaClient();
  const householdIds = [randomUUID(), randomUUID()];
  const userIds = [randomUUID(), randomUUID()];
  try {
    for (let index = 0; index < 2; index++) {
      await db.user.create({ data: { id: userIds[index], name: "Teste financeiro temporário", email: `finance-test-${userIds[index]}@example.invalid`, passwordHash: "not-a-login-hash", membership: { create: { role: "OWNER", household: { create: { id: householdIds[index], name: "Teste financeiro temporário" } } } } } });
    }
    const a = financialService(db, { householdId: householdIds[0], userId: userIds[0] });
    const b = financialService(db, { householdId: householdIds[1], userId: userIds[1] });
    let accountA: Awaited<ReturnType<typeof a.saveAccount>>;
    let categoryA: Awaited<ReturnType<typeof a.saveCategory>>;
    let incomeA: Awaited<ReturnType<typeof a.saveCategory>>;
    let accountB: Awaited<ReturnType<typeof b.saveAccount>>;
    let categoryB: Awaited<ReturnType<typeof b.saveCategory>>;
    let expense: Awaited<ReturnType<typeof a.saveTransaction>>;
    const rejectsCode = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: unknown) => error instanceof AppError && error.code === code);
    await suite.test("categorias padrão inicializam Households existentes uma única vez", async () => {
      await initializeFinancialDefaults(db, householdIds);
      assert.equal(await db.category.count({ where: { householdId: householdIds[0] } }), defaultCategories.length);
      const category = await db.category.findFirstOrThrow({ where: { householdId: householdIds[0], name: "Lazer" } });
      await db.category.delete({ where: { id: category.id } });
      await initializeFinancialDefaults(db, householdIds);
      assert.equal(await db.category.count({ where: { householdId: householdIds[0] } }), defaultCategories.length - 1);
    });
    await suite.test("cria contas e categorias nos respectivos Households, saldo sem perda de centavos", async () => {
      accountA = await a.saveAccount({ name: "Conta teste A", type: "CHECKING", initialBalance: "9999999999999.99" });
      accountB = await b.saveAccount({ name: "Conta teste B", type: "CASH", initialBalance: "0" });
      categoryA = await a.saveCategory({ name: "Categoria teste A", type: "EXPENSE" });
      incomeA = await a.saveCategory({ name: "Receita teste A", type: "INCOME" });
      categoryB = await b.saveCategory({ name: "Categoria teste B", type: "EXPENSE" });
      assert.equal(accountA.initialBalance, "9999999999999.99");
      assert.equal((await b.accounts()).some((row) => row.id === accountA.id), false);
      await rejectsCode(b.account(accountA.id), "NOT_FOUND");
      await rejectsCode(b.category(categoryA.id), "NOT_FOUND");
    });
    await suite.test("instituição persiste, pode mudar e clientes antigos preservam a associação", async () => {
      const input = { name: "Conta banco", type: "CHECKING", initialBalance: "25.50" };
      const created = await a.saveAccount({ ...input, bankCode: "nubank" });
      const fresh = new PrismaClient();
      try {
        assert.equal((await fresh.account.findUniqueOrThrow({ where: { id: created.id } })).bankCode, "nubank");
        await a.saveAccount({ ...input, bankCode: "viacredi" }, created.id);
        assert.equal((await a.account(created.id)).bankCode, "viacredi");
        await a.saveAccount(input, created.id);
        assert.equal((await a.account(created.id)).bankCode, "viacredi");
        assert.equal((await a.accounts()).find((row) => row.id === created.id)?.bankCode, "viacredi");
        await a.saveAccount({ ...input, bankCode: null }, created.id);
        assert.equal((await a.account(created.id)).bankCode, null);
        assert.equal((await b.account(accountB.id)).bankCode, null);
        assert.equal((await a.account(created.id)).initialBalance, "25.50");
      } finally { await fresh.$disconnect(); await a.removeAccount(created.id); }
    });
    await suite.test("unicidade de categoria ignora caixa e acentos, mas permite outro tipo e Household", async () => {
      await rejectsCode(a.saveCategory({ name: "CATEGORIA TESTE A", type: "EXPENSE" }), "DUPLICATE_CATEGORY");
      await a.saveCategory({ name: "Categoria teste A", type: "INCOME" });
      await a.saveCategory({ name: "Água teste", type: "EXPENSE" });
      await rejectsCode(a.saveCategory({ name: "agua teste", type: "EXPENSE" }), "DUPLICATE_CATEGORY");
      await b.saveCategory({ name: "Categoria teste A", type: "EXPENSE" });
    });
    const pending = () => ({ accountId: accountA.id, categoryId: categoryA.id, type: "EXPENSE", description: "Internet integração", amount: "120.59", scheduledDate: "2027-02-10", transactionDate: null, competenceDate: "2027-01-21", status: "PENDING" });
    await suite.test("cria INCOME e EXPENSE com competência independente da data efetiva", async () => {
      expense = await a.saveTransaction(pending());
      assert.equal(expense.competenceDate, "2027-01-01");
      assert.equal(expense.createdBy, userIds[0]);
      assert.equal(expense.amount, "120.59");
      const income = await a.saveTransaction({ ...pending(), type: "INCOME", categoryId: incomeA.id, status: "RECEIVED", transactionDate: "2027-02-05" });
      assert.equal(income.status, "RECEIVED");
      assert.equal(income.transactionDate, "2027-02-05");
      const freshConnection = new PrismaClient();
      try { assert.equal((await freshConnection.transaction.findUniqueOrThrow({ where: { id: expense.id } })).amount.toFixed(2), "120.59"); }
      finally { await freshConnection.$disconnect(); }
    });
    await suite.test("rejeita valores não positivos, status incompatível e os dois sentidos de categoria incorreta", async () => {
      for (const amount of ["0", "-10"]) await assert.rejects(a.saveTransaction({ ...pending(), amount }));
      await assert.rejects(a.saveTransaction({ ...pending(), status: "RECEIVED" }));
      await assert.rejects(a.saveTransaction({ ...pending(), type: "INCOME", status: "PAID" }));
      await rejectsCode(a.saveTransaction({ ...pending(), categoryId: incomeA.id }), "INVALID_INPUT");
      await rejectsCode(a.saveTransaction({ ...pending(), type: "INCOME" }), "INVALID_INPUT");
    });
    await suite.test("rejeita conta e categoria de outro Household na criação e na edição", async () => {
      for (const injected of [{ accountId: accountB.id }, { categoryId: categoryB.id }]) {
        await rejectsCode(a.saveTransaction({ ...pending(), ...injected }), "INVALID_INPUT");
        await rejectsCode(a.saveTransaction({ ...pending(), ...injected }, expense.id), "INVALID_INPUT");
      }
    });
    await suite.test("não permite ler, editar ou excluir transações de outro Household", async () => {
      await rejectsCode(b.transaction(expense.id), "NOT_FOUND");
      await rejectsCode(b.saveTransaction({ ...pending(), accountId: accountB.id, categoryId: categoryB.id }, expense.id), "NOT_FOUND");
      await rejectsCode(b.removeTransaction(expense.id), "NOT_FOUND");
      assert.equal((await b.transactions({})).pagination.total, 0);
      assert.equal((await a.transaction(expense.id)).amount, "120.59");
      await rejectsCode(b.saveAccount({ name: "Invasão", type: "CASH", initialBalance: "0" }, accountA.id), "NOT_FOUND");
      await rejectsCode(b.removeAccount(accountA.id), "NOT_FOUND");
      await rejectsCode(b.saveCategory({ name: "Invasão", type: "EXPENSE" }, categoryA.id), "NOT_FOUND");
      await rejectsCode(b.removeCategory(categoryA.id), "NOT_FOUND");
    });
    await suite.test("edição própria preserva createdBy e filtros/paginação usam competência", async () => {
      const updated = await a.saveTransaction({ ...pending(), amount: "135.42", status: "PAID", transactionDate: "2027-02-15" }, expense.id);
      assert.equal(updated.amount, "135.42"); assert.equal(updated.createdBy, userIds[0]);
      const list = await a.transactions({ year: 2027, month: 1, search: "internet", type: "EXPENSE", categoryId: categoryA.id, accountId: accountA.id, status: "PAID", limit: 1 });
      assert.equal(list.pagination.total, 1); assert.equal(list.data[0].id, expense.id);
      assert.equal((await a.transactions({ year: 2027, month: 2 })).pagination.total, 0);
      assert.equal((await a.transactions({ year: 2027, month: 1, page: 2, limit: 1 })).data.length, 1);
    });
    await suite.test("atraso dinâmico e filtros previstos não se sobrepõem", async () => {
      const overdue = await a.saveTransaction({ ...pending(), scheduledDate: "2000-01-01" });
      assert.equal(overdue.status, "PENDING"); assert.equal(overdue.displayStatus, "OVERDUE");
      assert.equal((await a.transactions({ status: "OVERDUE" })).data.some((row) => row.id === overdue.id), true);
      assert.equal((await a.transactions({ status: "PENDING" })).data.some((row) => row.id === overdue.id), false);
      assert.equal((await a.transactions({ status: "OVERDUE", type: "INCOME" })).pagination.total, 0);
      await a.removeTransaction(overdue.id);
    });
    await suite.test("desativa registros usados, preserva histórico e bloqueia novos usos", async () => {
      await rejectsCode(a.saveCategory({ name: categoryA.name, type: "INCOME" }, categoryA.id), "CATEGORY_IN_USE");
      assert.equal((await a.removeCategory(categoryA.id)).deactivated, true);
      assert.equal((await a.removeAccount(accountA.id)).deactivated, true);
      assert.equal((await a.transaction(expense.id)).category.name, categoryA.name);
      await rejectsCode(a.saveTransaction(pending()), "INVALID_INPUT");
      const edited = await a.saveTransaction({ ...pending(), description: "Histórico preservado" }, expense.id);
      assert.equal(edited.description, "Histórico preservado");
      const unused = await a.saveCategory({ name: "Nunca utilizada", type: "EXPENSE" });
      assert.equal((await a.removeCategory(unused.id)).deactivated, false);
    });
    await suite.test("chave estrangeira composta bloqueia vínculo cruzado mesmo sem serviço", async () => {
      await assert.rejects(db.transaction.update({ where: { id: expense.id }, data: { accountId: accountB.id } }));
      await assert.rejects(db.transaction.update({ where: { id: expense.id }, data: { categoryId: categoryB.id } }));
    });
    await suite.test("exclusão remove apenas o lançamento solicitado", async () => {
      const before = (await a.transactions({})).pagination.total;
      await a.removeTransaction(expense.id);
      await rejectsCode(a.transaction(expense.id), "NOT_FOUND");
      assert.equal((await a.transactions({})).pagination.total, before - 1);
    });
  } finally {
    // Cleanup is scoped exclusively to random fixtures owned by this test run.
    await db.transaction.deleteMany({ where: { householdId: { in: householdIds } } });
    await db.category.deleteMany({ where: { householdId: { in: householdIds } } });
    await db.account.deleteMany({ where: { householdId: { in: householdIds } } });
    await db.household.deleteMany({ where: { id: { in: householdIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
