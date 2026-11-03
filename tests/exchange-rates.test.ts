import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma, type PrismaClient } from "@prisma/client";
import { accountBalances, consolidatedBalance } from "../src/services/balances";
import { movementMoney, parseQuote, refreshQuote, valuationDate } from "../src/services/exchange-rates";
import { todayInBrazil } from "../src/lib/finance/dates";

const today = todayInBrazil();
const quote = { currency: "USD", requestedDate: today, referenceDate: today, rate: new Prisma.Decimal("5.20"), source: "Test", checkedAt: new Date() };
const before = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
before.setUTCMonth(before.getUTCMonth() + 1);
function fixture(rate: typeof quote | null = quote) {
  const rows = [
    { id: "dollar", currency: "USD", initialBalance: "1000", movement: new Prisma.Decimal("-1100"), includeInTotalBalance: true, isActive: true },
    { id: "real", currency: "BRL", initialBalance: "1000", movement: new Prisma.Decimal("100"), includeInTotalBalance: true, isActive: false },
    { id: "excluded", currency: "USD", initialBalance: "9999", movement: new Prisma.Decimal(0), includeInTotalBalance: false, isActive: true },
  ];
  return { $queryRaw: async () => rows, exchangeRate: { findFirst: async () => rate } } as unknown as Prisma.TransactionClient;
}
test("negative foreign balances keep their sign, BRL balances and inclusion rules", async () => {
  const tx = fixture();
  const rows = await accountBalances(tx, "home", before);
  assert.equal(rows[0].originalBalance, "-100.00");
  assert.equal(rows[0].balance, "-520.00");
  assert.equal(rows[1].balance, "1100.00");
  assert.equal((await consolidatedBalance(tx, "home", before)).value, "580.00");
  const changed = await accountBalances(fixture({ ...quote, rate: new Prisma.Decimal("5.30") }), "home", before);
  assert.equal(changed[0].balance, "-530.00");
  assert.equal(changed[0].originalBalance, "-100.00");
});
test("missing quotes cannot masquerade as BRL and produce an explicitly incomplete subtotal", async () => {
  const tx = fixture(null);
  assert.equal((await accountBalances(tx, "home", before))[0].balance, null);
  assert.deepEqual(await consolidatedBalance(tx, "home", before), { value: "1100.00", accountCount: 3, exchangeIncomplete: true, exchangeStale: false });
});
test("stale quotes are flagged while retaining their actual reference date", async () => {
  const rows = await accountBalances(fixture({ ...quote, requestedDate: "2020-01-01", referenceDate: "2019-12-31" }), "home", before);
  assert.equal(rows[0].exchange?.stale, true);
  assert.equal(rows[0].exchange?.referenceDate, "2019-12-31");
});
test("movement conversion is decimal and unchanged edits retain their original rate", async () => {
  const tx = fixture();
  const result = await movementMoney(tx, "USD", "100.00");
  assert.equal(result.amount.toFixed(2), "520.00");
  const retained = await movementMoney(fixture(null), "USD", "100", result);
  assert.equal(retained.amount.toFixed(2), "520.00");
  await assert.rejects(movementMoney(fixture(null), "USD", "101"), { code: "EXCHANGE_UNAVAILABLE" });
  assert.equal((await movementMoney(fixture(null), "BRL", "50")).amount.toFixed(2), "50.00");
});
test("quote validation rejects inverted, nonpositive and future observations", () => {
  const input = { base: "USD", quote: "BRL", date: "2026-01-02", rate: 5.2 };
  assert.equal(parseQuote(input, "USD", "2026-01-03").rate.toString(), "5.2");
  for (const change of [{ rate: 0 }, { rate: -1 }, { rate: "NaN" }, { base: "BRL" }, { date: "2027-01-01" }]) assert.throws(() => parseQuote({ ...input, ...change }, "USD", "2026-01-03"));
  assert.equal(valuationDate(new Date("2026-02-01"), "2026-11-03"), "2026-01-31");
  assert.equal(valuationDate(new Date("2027-02-01"), "2026-11-03"), "2026-11-03");
});
test("daily cache avoids repeat requests and upstream failure retains stored quotes", async () => {
  const oldFetch = globalThis.fetch;
  let requests = 0, writes = 0;
  const db = { exchangeRate: { findUnique: async () => quote, upsert: async () => { writes++; } } } as unknown as PrismaClient;
  globalThis.fetch = async () => { requests++; throw new Error("offline"); };
  try {
    await refreshQuote(db, "USD", today);
    assert.equal(requests, 0);
    await refreshQuote(db, "USD", today, true);
    assert.equal(requests, 1);
    assert.equal(writes, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test("small ARS movements preserve native precision even below one BRL cent", async () => {
  const result = await movementMoney(fixture({ ...quote, rate: new Prisma.Decimal("0.0035348") }), "ARS", "0.01");
  assert.equal(result.originalAmount?.toFixed(2), "0.01");
  assert.equal(result.amount.toFixed(2), "0.00");
});
