import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError, handleApiError } from "../src/lib/api/errors";
import { Prisma } from "@prisma/client";
import { failureStage, safeFailure } from "../src/lib/api/diagnostics";

test("erros esperados mantêm contrato/status e não permitem cache", async () => {
  const response = handleApiError(new AppError("NOT_FOUND", "Registro não encontrado neste espaço familiar.", 404));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { error: { code: "NOT_FOUND", message: "Registro não encontrado neste espaço familiar." } });
});

test("falha inesperada não expõe detalhes na resposta nem no log", async context => {
  const logs: string[] = [];
  context.mock.method(console, "error", (message: string) => logs.push(message));
  const response = handleApiError(new Error("mysql://private:secret@internal/db SELECT financial-data session-token"));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const body = await response.json();
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.equal(logs.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(logs[0])).sort(), ["code", "event", "stage", "type"]);
  assert.equal(JSON.parse(logs[0]).event, "api.unexpected_error");
  assert.doesNotMatch(JSON.stringify(body) + logs.join(), /secret|internal\/db|SELECT|financial-data|session-token|stack/);
});

test("database diagnostics retain only codes and the innermost fixed stage", async context => {
  const logs: string[] = [];
  context.mock.method(console, "error", (message: string) => logs.push(message));
  const error = new Prisma.PrismaClientKnownRequestError("secret SQL financial-data", {
    clientVersion: "test", code: "P2010", meta: { code: "42804", message: "private data" },
  });
  await assert.rejects(failureStage("accounts.data", () => failureStage("balances.query", () => { throw error; })), e => e === error);
  assert.equal(handleApiError(error).status, 500);
  assert.deepEqual(JSON.parse(logs[0]), { event: "api.unexpected_error", stage: "balances.query", type: "prisma_known", code: "P2010", databaseCode: "42804" });
  assert.deepEqual(safeFailure({ code: "secret", name: "private", meta: { code: "12345" } }), { stage: "api", type: "unknown", code: "UNKNOWN" });
  assert.doesNotMatch(logs.join(), /secret|SQL|financial-data|private|stack/);
});
