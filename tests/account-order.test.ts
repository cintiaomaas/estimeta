import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { financialService } from "../src/services/finance";

const a = "10000000-0000-4000-8000-000000000001";
const b = "10000000-0000-4000-8000-000000000002";
const foreign = "10000000-0000-4000-8000-000000000003";
function fixture() {
  const updates: unknown[] = [];
  const tx = { account: {
    findMany: async ({ where }: { where: { householdId: string } }) => {
      assert.equal(where.householdId, "home");
      return [{ id: a }, { id: b }];
    },
    update: async (input: unknown) => { updates.push(input); },
  } };
  const db = { $transaction: async (work: (client: typeof tx) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable");
    return work(tx);
  } } as unknown as PrismaClient;
  return { service: financialService(db, { userId: "user", householdId: "home" }), updates };
}
test("saves account positions in requested order scoped to the household", async () => {
  const { service, updates } = fixture();
  await service.reorderAccounts({ ids: [b, a] });
  assert.deepEqual(updates, [
    { where: { id: b, householdId: "home" }, data: { position: 0 } },
    { where: { id: a, householdId: "home" }, data: { position: 1 } },
  ]);
});
test("rejects foreign accounts, stale lists, duplicates and injected household before writing", async () => {
  for (const input of [{ ids: [a, foreign] }, { ids: [a] }, { ids: [a, b, foreign] }, { ids: [a, a] }, { ids: [] }, { ids: [a, b], householdId: "other" }]) {
    const { service, updates } = fixture();
    await assert.rejects(service.reorderAccounts(input));
    assert.equal(updates.length, 0);
  }
});
