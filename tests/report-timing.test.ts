import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma, PrismaClient } from "@prisma/client";
import { reportService } from "../src/services/reports";
import { requestTiming } from "../src/lib/api/timing";

function fixture(failure?: Error) {
  let calls = 0;
  const empty = async () => { calls++; return []; };
  const tx = {
    $queryRaw: empty,
    account: { findMany: empty }, category: { findMany: empty },
    financialGoal: { findMany: empty },
    transaction: { groupBy: async () => { if (failure) throw failure; return empty(); } },
  } as unknown as Prisma.TransactionClient;
  const db = { $transaction: async (work: (tx: Prisma.TransactionClient) => Promise<unknown>, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: "RepeatableRead", timeout: 15000 });
    return work(tx);
  } } as unknown as PrismaClient;
  return { db, calls: () => calls };
}
const actor = { userId: "private-user", householdId: "private-household" };
const now = new Date("2026-10-10T12:00:00Z");

for (const [method, stages] of [
  ["dashboard", ["history", "goals", "planning", "balances", "pending", "expense_categories", "top_expenses", "recent_transactions", "available_years", "snapshot", "data", "total"]],
  ["annual", ["annual_groups", "annual_categories", "annual_balances", "wealth", "available_years", "snapshot", "data", "total"]],
] as const) {
  test(`${method}: instrumentation preserves results and query count, and exposes only fixed stages`, async () => {
    const baseline = fixture(), measured = fixture();
    const timing = requestTiming();
    const input = { year: 2026, ...(method === "dashboard" ? { month: 10 } : {}) };
    const expected = await reportService(baseline.db, actor, now)[method](input);
    const actual = await timing.measure<unknown>("data", () => reportService(measured.db, actor, now, timing.measure)[method](input));
    assert.deepEqual(actual, expected);
    assert.equal(measured.calls(), baseline.calls());
    const header = timing.finish(Response.json(actual)).headers.get("Server-Timing")!;
    assert.deepEqual(header.split(", ").map(part => part.split(";")[0]), stages);
    assert.ok(header.split(", ").every(part => /^[a-z_]+;dur=\d+\.\d$/.test(part)));
    assert.ok(!header.includes("private"));
  });
}

test("failed report retains stage durations and propagates the original error without exposing it", async () => {
  const failure = new Error("private SQL failure");
  const { db } = fixture(failure);
  const timing = requestTiming();
  await assert.rejects(timing.measure("data", () => reportService(db, actor, now, timing.measure).dashboard({ year: 2026, month: 10 })), error => error === failure);
  const header = timing.finish(new Response(null, { status: 500 })).headers.get("Server-Timing")!;
  assert.deepEqual(header.split(", ").map(part => part.split(";")[0]), ["history", "snapshot", "data", "total"]);
  assert.ok(!header.includes(failure.message));
});

test("requests do not share their stage measurements", async () => {
  const a = requestTiming(), b = requestTiming();
  await Promise.all([a.measure("history", async () => 1), b.measure("wealth", async () => 2)]);
  assert.ok(!a.finish(new Response()).headers.get("Server-Timing")!.includes("wealth"));
  assert.ok(!b.finish(new Response()).headers.get("Server-Timing")!.includes("history"));
});
