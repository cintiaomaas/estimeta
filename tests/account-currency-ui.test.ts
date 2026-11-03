import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountBalance } from "../src/components/finance/account-balance";
import type { AccountRecord } from "../src/lib/finance/client";

const account: AccountRecord = { id: "usd", name: "Investimentos", type: "INVESTMENT", initialBalance: "1000.00", isActive: true, includeInTotalBalance: true, currency: "USD", balance: "-520.00", originalBalance: "-100.00", exchange: { rate: "5.2000000000", referenceDate: "2026-11-03", source: "Test", stale: false, checkedAt: "2026-11-03T12:00:00Z" } };
test("BRL remains the main negative balance and foreign details remain small", () => {
  const html = renderToStaticMarkup(createElement(AccountBalance, { account }));
  assert.match(html, /<dd class="negative">-R\$ 520,00<\/dd>/);
  assert.match(html, /<small>Equivalente a −USD 100,00<\/small>/);
  assert.match(html, /Cotação: 1 USD = R\$ 5,2/);
  assert.match(html, /03\/11\/2026/);
});
test("BRL accounts show no exchange detail and missing conversions never display native money as BRL", () => {
  const brl = renderToStaticMarkup(createElement(AccountBalance, { account: { ...account, currency: "BRL" } }));
  assert.doesNotMatch(brl, /Equivalente|Cotação/);
  const missing = renderToStaticMarkup(createElement(AccountBalance, { account: { ...account, balance: null, exchange: null } }));
  assert.match(missing, /Conversão indisponível/);
  assert.doesNotMatch(missing, /R\$/);
});
