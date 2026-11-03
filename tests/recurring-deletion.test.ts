import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { advancedService } from "../src/services/advanced";

function fixture(exists = true) {
  const calls: string[] = [];
  const tx = {
    recurringTransaction: {
      findFirst: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, { id: "rule", householdId: "home" });
        return exists ? { id: "rule" } : null;
      },
      delete: async ({ where }: { where: unknown }) => {
        assert.deepEqual(where, { id: "rule", householdId: "home" });
        calls.push("rule");
      },
    },
    transaction: { updateMany: async (input: unknown) => {
      assert.deepEqual(input, { where: { householdId: "home", recurringOccurrence: { recurringTransactionId: "rule", householdId: "home" } }, data: { recurringOccurrenceId: null } });
      calls.push("detach");
    } },
    recurringOccurrence: { deleteMany: async ({ where }: { where: unknown }) => {
      assert.deepEqual(where, { recurringTransactionId: "rule", householdId: "home" });
      calls.push("occurrences");
    } },
  };
  const db = { $transaction: async (work: (client: typeof tx) => Promise<unknown>, options: unknown) => {
    assert.deepEqual(options, { isolationLevel: "Serializable", timeout: 20000 });
    return work(tx);
  } } as unknown as PrismaClient;
  return { service: advancedService(db, { userId: "user", householdId: "home" }), calls };
}

test("recurrence deletion preserves transaction fields and removes links before deleting the rule atomically", async () => {
  const { service, calls } = fixture();
  await service.deleteRecurring("rule");
  assert.deepEqual(calls, ["detach", "occurrences", "rule"]);
});

test("missing or foreign recurrence cannot change any records", async () => {
  const { service, calls } = fixture(false);
  await assert.rejects(service.deleteRecurring("rule"), { code: "NOT_FOUND" });
  assert.deepEqual(calls, []);
});
