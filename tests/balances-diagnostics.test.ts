import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { accountBalances } from "../src/services/balances";
import { safeFailure } from "../src/lib/api/diagnostics";

test("account balance SQL errors preserve their identity and safe diagnostic stage", async () => {
  const error = new Prisma.PrismaClientKnownRequestError("private query and values", {
    code: "P2010", clientVersion: "test", meta: { code: "42703", message: "private identifier" },
  });
  const tx = { $queryRaw: async () => { throw error; } } as unknown as Prisma.TransactionClient;
  await assert.rejects(accountBalances(tx, "private-household", new Date("2026-12-01T00:00:00Z")), e => e === error);
  assert.deepEqual(safeFailure(error), { stage: "balances.query", type: "prisma_known", code: "P2010", databaseCode: "42703" });
});
