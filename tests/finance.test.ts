import { test } from "node:test";
import assert from "node:assert/strict";
import { accountSchema, categorySchema, transactionSchema, transactionFilterSchema } from "../src/lib/validations/finance";
import { databaseDate, dateOnly, displayDate, displayStatus, todayInBrazil } from "../src/lib/finance/dates";
import { currency, moneyInput, formatMoneyInput } from "../src/lib/finance/client";
const input = { accountId: "10000000-0000-4000-8000-000000000001", categoryId: "10000000-0000-4000-8000-000000000002", type: "INCOME", description: "Salário", amount: "5000.01", scheduledDate: "2027-02-05", transactionDate: "2027-02-05", competenceDate: "2027-01-25", status: "RECEIVED" };
test("entrada monetária formata reais inteiros, agrupamento brasileiro e centavos sem arredondamento", () => {
  for (const [typed, formatted, stored] of [
    ["5000", "5.000,00", "5000.00"], ["5.000", "5.000,00", "5000.00"],
    ["5.000,00", "5.000,00", "5000.00"], ["5000,5", "5.000,50", "5000.50"],
    ["5000.59", "5.000,59", "5000.59"], ["0,01", "0,01", "0.01"],
    ["9999999999999,99", "9.999.999.999.999,99", "9999999999999.99"],
  ]) {
    assert.equal(formatMoneyInput(typed), formatted);
    assert.equal(moneyInput(formatted), stored);
  }
  assert.equal(formatMoneyInput(""), "");
  for (const invalid of ["5.00,00", "1,234", "1.234,567", "5000.9999", "-10", "abc"]) {
    assert.equal(formatMoneyInput(invalid), invalid);
    assert.equal(transactionSchema.safeParse({ ...input, amount: moneyInput(invalid) }).success, false);
  }
});
test("valida conta e categoria sem aceitar propriedade enviada pelo cliente", () => {
  assert.equal(accountSchema.parse({ name: " Carteira ", type: "CASH", initialBalance: "0.00" }).name, "Carteira");
  assert.equal(categorySchema.parse({ name: " Renda   extra ", type: "INCOME" }).name, "Renda extra");
  assert.equal(categorySchema.safeParse({ name: "Teste", type: "TRANSFER" }).success, false);
  for (const field of ["householdId", "createdBy", "userId"]) assert.equal(transactionSchema.safeParse({ ...input, [field]: "injetado" }).success, false);
});
test("valores preservam centavos e rejeitam zero, negativos e precisão indevida", () => {
  assert.equal(transactionSchema.parse(input).amount, "5000.01");
  for (const amount of ["0", "0.00", "-1", "1.001", "10000000000000", "1e2", "NaN", 10]) assert.equal(transactionSchema.safeParse({ ...input, amount }).success, false);
  assert.equal(transactionSchema.safeParse({ ...input, amount: "9999999999999.99" }).success, true);
  assert.equal(currency("9999999999999.99"), "R$ 9.999.999.999.999,99");
  assert.equal(moneyInput("1.234,56"), "1234.56");
});
test("receita e despesa validam combinações de status e data efetiva", () => {
  assert.equal(transactionSchema.safeParse({ ...input, status: "PAID" }).success, false);
  assert.equal(transactionSchema.safeParse({ ...input, type: "EXPENSE" }).success, false);
  assert.equal(transactionSchema.safeParse({ ...input, type: "EXPENSE", status: "PAID" }).success, true);
  assert.equal(transactionSchema.safeParse({ ...input, type: "EXPENSE", status: "OVERDUE" }).success, false);
  assert.equal(transactionSchema.safeParse({ ...input, transactionDate: null }).success, false);
  assert.equal(transactionSchema.safeParse({ ...input, status: "PENDING", transactionDate: null }).success, true);
  assert.equal(transactionSchema.safeParse({ ...input, status: "PENDING" }).success, false);
});
test("competência é normalizada, datas inexistentes são rejeitadas e UTC não muda o dia", () => {
  assert.equal(transactionSchema.parse(input).competenceDate, "2027-01-01");
  for (const scheduledDate of ["2027-02-29", "2027-04-31", "2027-13-01", "0000-01-01"]) assert.equal(transactionSchema.safeParse({ ...input, scheduledDate }).success, false);
  assert.equal(displayDate(dateOnly(databaseDate("2027-01-01"))), "01/01/2027");
  assert.equal(todayInBrazil(new Date("2027-01-01T02:00:00Z")), "2026-12-31");
});
test("atraso é derivado sem alterar status persistido e exclui receitas e despesas pagas", () => {
  const row = { type: "EXPENSE", status: "PENDING", scheduledDate: "2027-01-01" };
  assert.equal(displayStatus(row, "2027-01-02"), "OVERDUE");
  assert.equal(row.status, "PENDING");
  assert.equal(displayStatus(row, "2027-01-01"), "PENDING");
  assert.equal(displayStatus({ ...row, type: "INCOME" }, "2027-01-02"), "PENDING");
  assert.equal(displayStatus({ ...row, status: "PAID" }, "2027-01-02"), "PAID");
});
test("filtros validam período, paginação e impedem injeção de Household", () => {
  for (const filters of [{ month: 1 }, { month: 13, year: 2027 }, { limit: 101 }, { page: 0 }, { householdId: "outro" }, { startDate: "2027-02-01", endDate: "2027-01-01" }]) assert.equal(transactionFilterSchema.safeParse(filters).success, false);
  assert.equal(transactionFilterSchema.parse({ year: "2027", month: "1" }).limit, 20);
});
