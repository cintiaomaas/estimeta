import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { financialService } from "../src/services/finance";
import { advancedService } from "../src/services/advanced";
import { goalsService } from "../src/services/goals";
import { planningService } from "../src/services/planning";
import { accountBalances } from "../src/services/balances";

// In-memory engine only: real services, validation and Prisma query extensions.
// It does not stand in for PostgreSQL FK/transaction integration validation.
type Row = Record<string, unknown>;
test("offline write lifecycle: CRUD, balance invariants, transfers, recurrence, goals and planning", async () => {
  const actor = { userId: randomUUID(), householdId: randomUUID() };
  const tables = new Map<string, Row[]>();
  const rows = (model: string) => { if (!tables.has(model)) tables.set(model, []); return tables.get(model)!; };
  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (key === "OR") return (value as Row[]).some(w => matches(row, w));
      if (value && typeof value === "object" && !(value instanceof Date)) {
        const filter = value as Row;
        if ("in" in filter) return (filter.in as unknown[]).includes(row[key]);
        if ("not" in filter) return row[key] !== filter.not;
        if (key === "recurringOccurrence") return rows("RecurringOccurrence").some(r => r.id === row.recurringOccurrenceId && matches(r, filter));
        return Object.entries(filter).every(([nested, expected]) => row[nested] === expected);
      }
      return value instanceof Date ? +(row[key] as Date) === +value : row[key] === value;
    });
  }
  function normalize(data: Row): Row {
    const result = { ...data };
    for (const key of ["initialBalance", "amount", "targetAmount", "referenceIncome", "percentage", "alertPercentage"]) {
      if (result[key] !== undefined) result[key] = new Prisma.Decimal(result[key] as Prisma.Decimal.Value);
    }
    return result;
  }
  const base = new PrismaClient();
  const engine = base.$extends({ query: { async $allOperations({ model, operation, args }) {
    if (operation === "$queryRaw") {
      const sql = args as Prisma.Sql;
      if (sql.text.includes('FROM "IncomePlanning"')) return [];
      assert.ok(sql.text.includes('FROM "Account"'));
      return rows("Account").filter(r => r.householdId === sql.values[0]).map(a => {
        let movement = new Prisma.Decimal(0);
        for (const t of rows("Transaction").filter(r => r.accountId === a.id)) {
          if (t.status === "RECEIVED") movement = movement.plus(t.amount as Prisma.Decimal);
          if (t.status === "PAID") movement = movement.minus(t.amount as Prisma.Decimal);
        }
        for (const t of rows("Transfer")) {
          if (t.sourceAccountId === a.id) movement = movement.minus(t.amount as Prisma.Decimal);
          if (t.destinationAccountId === a.id) movement = movement.plus(t.amount as Prisma.Decimal);
        }
        return { ...a, movement };
      });
    }
    const input = args as { where?: Row; data?: Row | Row[]; create?: Row; update?: Row };
    const table = rows(model!); const found = table.filter(r => matches(r, input.where));
    if (operation === "findMany") return found;
    if (operation === "count") return found.length;
    if (["findFirst", "findUnique", "findFirstOrThrow"].includes(operation)) return found[0] ?? null;
    if (operation === "create" || operation === "createMany" || (operation === "upsert" && !found.length)) {
      const data = operation === "upsert" ? input.create! : input.data!;
      const created = (Array.isArray(data) ? data : [data]).map(row => normalize({ id: randomUUID(), currency: "BRL", initialBalance: "0", isActive: true, includeInTotalBalance: true, status: "ACTIVE", revision: 0, hasHistory: false, createdAt: new Date(), updatedAt: new Date(), ...row }));
      table.push(...created); return operation === "createMany" ? { count: created.length } : created[0];
    }
    if (["update", "updateMany", "upsert"].includes(operation)) {
      for (const row of found) Object.assign(row, normalize(operation === "upsert" ? input.update! : input.data as Row));
      return operation === "updateMany" ? { count: found.length } : found[0];
    }
    if (["delete", "deleteMany"].includes(operation)) {
      tables.set(model!, table.filter(r => !found.includes(r))); return operation === "deleteMany" ? { count: found.length } : found[0];
    }
    throw new Error("Unsupported offline operation");
  } } });
  const db = new Proxy(engine, { get(target, key, receiver) {
    if (key === "$transaction") return async (work: (tx: unknown) => unknown) => work(engine);
    return Reflect.get(target, key, receiver);
  } }) as unknown as PrismaClient;
  try {
    const finance = financialService(db, actor), advanced = advancedService(db, actor), goals = goalsService(db, actor);
    const a = await finance.saveAccount({ name: "QA A", type: "CASH", initialBalance: "100.00" });
    const b = await finance.saveAccount({ name: "QA B", type: "CASH", initialBalance: "0.00" });
    await finance.saveAccount({ name: "QA renamed", type: "CASH", initialBalance: "100.00" }, a.id);
    const category = await finance.saveCategory({ name: "QA income", type: "INCOME" });
    const income = await finance.saveTransaction({ accountId: a.id, categoryId: category.id, type: "INCOME", description: "QA", amount: "10.25", status: "RECEIVED", competenceDate: "2026-11-01", scheduledDate: "2026-11-01", transactionDate: "2026-11-01" });
    const transferInput = { sourceAccountId: a.id, destinationAccountId: b.id, amount: "20.10", transferDate: "2026-11-01", competenceDate: "2026-11-01" };
    const transfer = await advanced.saveTransfer(transferInput);
    const balances = async () => accountBalances(engine as unknown as Prisma.TransactionClient, actor.householdId, new Date("2026-12-01"));
    assert.deepEqual((await balances()).map(r => r.balance), ["90.15", "20.10"]);
    await advanced.saveTransfer({ ...transferInput, amount: "15.00" }, String(transfer.id));
    assert.deepEqual((await balances()).map(r => r.balance), ["95.25", "15.00"]);
    await assert.rejects(advanced.saveTransfer({ ...transferInput, destinationAccountId: randomUUID() }));
    await advanced.removeTransfer(String(transfer.id));
    await finance.removeTransaction(income.id);
    assert.deepEqual((await balances()).map(r => r.balance), ["100.00", "0.00"]);
    const rule = await advanced.saveRecurring({ accountId: a.id, categoryId: category.id, type: "INCOME", description: "QA rule", amount: "1.00", startDate: "2026-11-01", dayOfMonth: 1, isActive: false });
    await advanced.saveRecurring({ accountId: a.id, categoryId: category.id, type: "INCOME", description: "QA edited", amount: "2.00", startDate: "2026-11-01", dayOfMonth: 1, isActive: false, revision: 1 }, String(rule.id));
    await advanced.deleteRecurring(String(rule.id));
    const goalInput = { name: "QA goal", targetAmount: "100.00", startDate: "2026-11-01" };
    const goal = await goals.save(goalInput); await goals.save({ ...goalInput, targetAmount: "200.00" }, goal.id); await goals.remove(goal.id);
    const planning = planningService(db, actor);
    await planning.save({ revision: 0, enabled: true, incomeSource: "MANUAL", referenceIncome: "100.00", groups: [] });
    await planning.save({ revision: 1, enabled: false, incomeSource: "MANUAL", referenceIncome: "200.00", groups: [] });
    assert.equal(rows("IncomePlanning")[0].revision, 2);
    await finance.removeCategory(category.id); await finance.removeAccount(a.id); await finance.removeAccount(b.id);
    assert.equal(rows("Account").length, 0); assert.equal(rows("Transfer").length, 0); assert.equal(rows("Transaction").length, 0);
  } finally {
    await base.$disconnect();
  }
});

test("financial foreign keys in generated schema carry household identity", () => {
  const protectedModels = new Set(["Account", "Category", "Transfer", "FinancialGoal", "GoalParticipant", "PlanningGroup", "RecurringTransaction", "RecurringOccurrence", "InstallmentPlan"]);
  for (const model of Prisma.dmmf.datamodel.models) for (const field of model.fields) {
    if (field.kind === "object" && protectedModels.has(field.type) && field.relationFromFields?.length && model.name !== "NotificationLog") {
      assert.ok(field.relationFromFields.includes("householdId"), `${model.name}.${field.name}`);
      assert.ok(field.relationToFields?.includes("householdId"), `${model.name}.${field.name}`);
    }
  }
});
