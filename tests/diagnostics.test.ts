import { test } from "node:test";
import assert from "node:assert/strict";
import { safeFailure } from "../src/lib/api/diagnostics";
import { Prisma } from "@prisma/client";
import { runInNewContext } from "node:vm";

test("classifies unknown Prisma errors and errors from another runtime without raw text", () => {
  const unknown = new Prisma.PrismaClientUnknownRequestError("private SQL and credentials", { clientVersion: "test" });
  assert.equal(safeFailure(unknown).type, "prisma_unknown");
  const foreign = runInNewContext(`Object.assign(new Error('private-data'), {name:'PrismaClientKnownRequestError', code:'P2028', meta:{code:'57014',message:'secret'}})`);
  assert.ok(!(foreign instanceof Error));
  assert.deepEqual(safeFailure(foreign), { stage: "api", type: "prisma_known", code: "P2028", databaseCode: "57014" });
  const validation = { name: "PrismaClientInitializationError", errorCode: "P1001" };
  assert.equal(safeFailure(validation).code, "P1001");
  const missingQuery = new Prisma.PrismaClientValidationError("private SQL; Argument `query` is missing.", { clientVersion: "test" });
  assert.equal(safeFailure(missingQuery).validationReason, "raw_query_missing");
  assert.doesNotMatch(JSON.stringify(safeFailure(missingQuery)), /private|SQL|message|stack/);
  assert.deepEqual(safeFailure({ name: "secret", code: "private", meta: { code: "12345" } }), { stage: "api", type: "unknown", code: "UNKNOWN" });
  assert.doesNotThrow(() => safeFailure(new Proxy({}, { get() { throw new Error("secret"); } })));
  assert.doesNotMatch(JSON.stringify(safeFailure(foreign)), /private|secret|message|stack/);
});

