import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMoneyInput, displayMoneyInput } from "../src/lib/finance/money-input";
import { plannedPreview } from "../src/lib/finance/planning-preview";
import { transactionSchema } from "../src/lib/validations/finance";
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
