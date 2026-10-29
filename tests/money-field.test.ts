import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMoneyInput, displayMoneyInput } from "../src/lib/finance/money-input";
import { plannedPreview } from "../src/lib/finance/planning-preview";
import { transactionSchema } from "../src/lib/validations/finance";
import { accountSchema } from "../src/lib/validations/finance";
import { planningSchema } from "../src/lib/validations/planning";
import { recurringSchema, transferSchema, installmentSchema } from "../src/lib/validations/advanced";
import { goalSchema, contributionSchema } from "../src/lib/validations/goals";
import { currency } from "../src/lib/finance/client";

test("normalização compartilhada aceita formatos e espaços sem perder precisão", () => {
  const fields = [transactionSchema.shape.amount, accountSchema.shape.initialBalance,
    planningSchema.shape.referenceIncome, recurringSchema.shape.amount, transferSchema.shape.amount,
    installmentSchema.shape.amount, goalSchema.shape.targetAmount, contributionSchema.shape.amount];
  for (const field of fields) {
    for (const input of ["5300,00", "5300.00", "5.300,00", "5300", "5300, 00", "  5.300 , 00  ", "5300 . 00", "5300,\u00a000"]) {
      assert.equal(field.parse(input), "5300.00");
      assert.equal(currency(field.parse(input)), "R$ 5.300,00");
    }
    assert.equal(field.parse("9.999.999.999.999,99"), "9999999999999.99");
    for (const input of ["1.234", "5.300", "1,234", "5300.001", "5.300,001", "5,300.00", "5.30,00", "53 00,00", "5 .300,00", "5300,0 0", "1e3", "-1", "+1", "", " ", "10000000000000", "00000000000000,01", "1,,00", "NaN", 5300, null]) {
      assert.equal(field.safeParse(input).success, false, String(input));
      if (typeof input === "string") assert.equal(field.safeParse(normalizeMoneyInput(input)).success, false, input);
    }
  }
});

test("zero continua permitido somente nas funcionalidades correspondentes", () => {
  assert.equal(accountSchema.shape.initialBalance.parse("0,00"), "0.00");
  const planning = { revision: 0, enabled: true, incomeSource: "REALIZED", referenceIncome: "0,00", groups: [] };
  assert.equal(planningSchema.safeParse(planning).success, true);
  assert.equal(planningSchema.safeParse({ ...planning, incomeSource: "MANUAL" }).success, false);
  for (const field of [transactionSchema.shape.amount, recurringSchema.shape.amount, transferSchema.shape.amount, goalSchema.shape.targetAmount, contributionSchema.shape.amount]) {
    assert.equal(field.safeParse("0,00").success, false);
  }
});
test("MoneyField: vazio não vira zero, inteiros e centavos brasileiros", () => {
  for (const [input, api, display] of [["", "", ""], ["5000", "5000.00", "5.000,00"], ["1250,50", "1250.50", "1.250,50"], ["10,5", "10.50", "10,50"], ["10", "10.00", "10,00"], ["0,00", "0.00", "0,00"], ["0,01", "0.01", "0,01"], ["1500.00", "1500.00", "1.500,00"], ["2000", "2000.00", "2.000,00"], ["R$ 1.234,56", "1234.56", "1.234,56"], ["1234,56", "1234.56", "1.234,56"], ["9999999999999,99", "9999999999999.99", "9.999.999.999.999,99"]]) {
    assert.equal(normalizeMoneyInput(input), api); assert.equal(displayMoneyInput(input), display);
    assert.equal(normalizeMoneyInput(display), api);
  }
});
test("MoneyField: entradas inválidas não são arredondadas ou truncadas", () => {
  for (const input of ["abc", "0,005000", "1,234", "-10", "10000000000000", "1.23,45"]) assert.equal(transactionSchema.shape.amount.safeParse(normalizeMoneyInput(input)).success, false);
  assert.equal(transactionSchema.shape.amount.safeParse(normalizeMoneyInput("0,00")).success, false);
  assert.equal(transactionSchema.shape.amount.safeParse(normalizeMoneyInput("")).success, false);
});
test("prévia de planejamento preserva percentuais humanos e precisão", () => {
  assert.equal(plannedPreview("5000.00", "30"), "1500.00");
  assert.equal(plannedPreview("5000.00", "80"), "4000.00");
  assert.equal(plannedPreview("9999999999999.99", "100"), "9999999999999.99");
  assert.equal(plannedPreview("0.01", "50"), "0.01");
  assert.equal(plannedPreview("", "20"), null);
});
